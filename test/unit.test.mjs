/**
 * Unit tests for lib/client.js — the browser bundle's pure logic.
 *
 * The bundle is loaded exactly like the browser does (window.__ModuleLoader__
 * -> factory()), then the test-only __internals seam is exercised. The CSS
 * checks are regression guards for the historical selector-list comma bugs
 * and the tuning-iteration leftover duplicates.
 */
import assert from "node:assert/strict";

let passed = 0;
function test(label, fn) {
	fn();
	passed++;
	console.log(`ok - ${label}`);
}

// --- load the bundle through the real loader contract ---
const loadCalls = [];
globalThis.window = {
	__ModuleLoader__: { load: (descriptor) => loadCalls.push(descriptor) },
	addEventListener() {},
	removeEventListener() {}
};
await import("../lib/client.js");
assert.equal(loadCalls.length, 1, "bundle must call __ModuleLoader__.load exactly once");
const descriptor = loadCalls[0];
const plugin = descriptor.factory();
const I = plugin.__internals;

test("loader contract: descriptor id, plugin shape, internals seam", () => {
	assert.equal(descriptor.id, "@kongjianguan/dsh-think-sticky");
	assert.equal(typeof descriptor.factory, "function");
	assert.equal(plugin.name, "dsh-think-sticky");
	assert.equal(typeof plugin.apply, "function");
	for (const k of ["ROWS", "BG", "FADE", "FADE_PINNED", "buildCss", "isPinned", "scrollerOf"]) {
		assert.ok(I[k] !== undefined, `__internals must expose ${k}`);
	}
});

// --- CSS contract (regression guards) ---
function parseRules(css) {
	// strip comments first, otherwise a leading comment block merges with the
	// next selector into one rule
	const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
	const rules = [];
	const re = /([^{}]+)\{([^{}]*)\}/g;
	let m;
	while ((m = re.exec(clean)) !== null) rules.push({ selector: m[1].trim(), body: m[2] });
	return rules;
}

test("css: sticky rule for the combined selector list", () => {
	const rules = parseRules(I.buildCss());
	const sticky = rules.find((r) => r.selector === I.ROWS);
	assert.ok(sticky, "combined ROWS rule must exist");
	assert.match(sticky.body, /position:\s*sticky/);
	assert.match(sticky.body, /top:\s*0/);
	assert.match(sticky.body, /z-index:\s*7/);
	assert.match(sticky.body, /padding-block:\s*5px/);
});

test("css: every pseudo rule carries its own per-selector suffix (comma-bug regression)", () => {
	for (const rule of parseRules(I.buildCss())) {
		const selectors = rule.selector.split(",").map((s) => s.trim());
		if (rule.selector.includes("::after")) {
			assert.ok(
				selectors.every((s) => s.endsWith("::after")),
				`::after rule leaks bare selectors: ${rule.selector}`
			);
		}
		if (rule.selector.includes("::before")) {
			assert.ok(
				selectors.every((s) => s.endsWith("::before")),
				`::before rule leaks bare selectors: ${rule.selector}`
			);
		}
	}
	// and the bare ROWS rule itself must stay sticky — never absolute
	const sticky = parseRules(I.buildCss()).find((r) => r.selector === I.ROWS);
	assert.ok(!/position:\s*absolute/.test(sticky.body), "bare ROWS rule must stay sticky, not absolute");
});

test("css: fade rule has exactly one background declaration (dedupe regression)", () => {
	const fade = parseRules(I.buildCss()).find((r) => r.selector === I.FADE);
	assert.ok(fade, "FADE rule must exist");
	const backgrounds = fade.body.match(/background\s*:/g) ?? [];
	assert.equal(backgrounds.length, 1, `expected exactly one background declaration, got ${backgrounds.length}`);
	assert.match(fade.body, /linear-gradient\(var\(--dsw-alias-bg-base\)\s*,\s*transparent\)/);
	assert.match(fade.body, /opacity:\s*0/);
});

test("css: pinned fade rule and overflow override", () => {
	const rules = parseRules(I.buildCss());
	const pinned = rules.find((r) => r.selector === I.FADE_PINNED);
	assert.ok(pinned, "FADE_PINNED rule must exist");
	assert.match(pinned.body, /opacity:\s*1/);
	const over = rules.find((r) => r.selector === I.ROWS + ".dsh-pinned");
	assert.ok(over, "ROWS.dsh-pinned rule must exist");
	assert.match(over.body, /overflow:\s*visible\s*!important/);
});

test("css: no hardcoded colors — design tokens only", () => {
	const css = I.buildCss();
	assert.ok(!/#[0-9a-f]{3,8}\b/i.test(css), "no hex colors allowed");
	assert.ok(!/rgba?\(/.test(css), "no rgb()/rgba() colors allowed");
	assert.match(css, /var\(--dsw-alias-bg-base\)/);
});

// --- isPinned predicate ---
test("isPinned: row straddling the scroller top edge", () => {
	const sc = { top: 0, bottom: 500 };
	assert.equal(I.isPinned({ top: 0, bottom: 40 }, sc), true);
	assert.equal(I.isPinned({ top: 2, bottom: 40 }, sc), true, "within the 2px tolerance");
	assert.equal(I.isPinned({ top: 3, bottom: 40 }, sc), false, "below the tolerance is not pinned");
	assert.equal(I.isPinned({ top: -50, bottom: -5 }, sc), false, "fully above the edge is not pinned");
	assert.equal(I.isPinned({ top: -50, bottom: 0 }, sc), false, "bottom exactly at the edge is not pinned");
});

// --- scrollerOf ---
globalThis.getComputedStyle = (el) => ({ overflowY: el.__ov ?? "visible" });
function makeEl({ overflowY, scrollHeight = 0, clientHeight = 0, parent = null }) {
	return { __ov: overflowY, scrollHeight, clientHeight, parentElement: parent };
}

test("scrollerOf: finds the first scrollable ancestor", () => {
	globalThis.document = { scrollingElement: { id: "root" }, documentElement: { id: "html" } };
	const scroller = makeEl({ overflowY: "auto", scrollHeight: 1000, clientHeight: 200 });
	const plain = makeEl({ parent: scroller });
	const leaf = makeEl({ parent: plain });
	assert.equal(I.scrollerOf(leaf), scroller, "must skip non-scrollable ancestors");
	assert.equal(I.scrollerOf(plain), scroller);
	assert.equal(I.scrollerOf(scroller), globalThis.document.scrollingElement, "the element itself is never its own scroller");
});

test("scrollerOf: scrollable-looking but non-scrolling ancestors are skipped", () => {
	globalThis.document = { scrollingElement: { id: "root" }, documentElement: { id: "html" } };
	const parent = makeEl({ overflowY: "auto", scrollHeight: 100, clientHeight: 100 });
	const leaf = makeEl({ parent });
	assert.equal(I.scrollerOf(leaf), globalThis.document.scrollingElement, "equal heights => not scrollable");
	assert.equal(I.scrollerOf(parent), globalThis.document.scrollingElement);
});

test("scrollerOf: falls back to the document root", () => {
	globalThis.document = { scrollingElement: { id: "root" }, documentElement: { id: "html" } };
	const leaf = makeEl({});
	assert.equal(I.scrollerOf(leaf), globalThis.document.scrollingElement);
});

test("scrollerOf: re-walks the ancestor chain on every call (no stale cache)", () => {
	globalThis.document = { scrollingElement: { id: "root" }, documentElement: { id: "html" } };
	const scroller = makeEl({ overflowY: "scroll", scrollHeight: 1000, clientHeight: 200 });
	const leaf = makeEl({ parent: scroller });
	assert.equal(I.scrollerOf(leaf), scroller);
	leaf.parentElement = null; // layout change: the scroller is no longer an ancestor
	assert.equal(I.scrollerOf(leaf), globalThis.document.scrollingElement, "re-walk must reflect the current tree");
});

console.log(`\n${passed} unit tests passed`);
