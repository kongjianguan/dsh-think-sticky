/**
 * Smoke test: the plugin's full apply() lifecycle against a fake DOM,
 * mirroring how the dsh web client hosts the bundle: load via
 * window.__ModuleLoader__, call apply(ctx), scroll rows over the top edge,
 * and dispose.
 */
import assert from "node:assert/strict";

let passed = 0;
function test(label, fn) {
	fn();
	passed++;
	console.log(`ok - ${label}`);
}

function makeEl({ rect = { top: 0, bottom: 0 }, attrs = {}, parent = null, overflowY = "visible", scrollHeight = 0, clientHeight = 0 } = {}) {
	const el = {
		rect,
		attrs,
		overflowY,
		scrollHeight,
		clientHeight,
		parentElement: parent,
		classSet: new Set(),
		getBoundingClientRect: () => el.rect,
		getAttribute: (k) => attrs[k] ?? null,
		classList: {
			toggle: (c, force) => (force ? el.classSet.add(c) : el.classSet.delete(c)),
			remove: (c) => el.classSet.delete(c),
			contains: (c) => el.classSet.has(c)
		}
	};
	return el;
}

// --- fake browser environment ---
const styleTags = [];
const docListeners = {};
const winListeners = {};
let rows = [];
let raf = null;

const document = {
	scrollingElement: null,
	documentElement: { getBoundingClientRect: () => ({ top: 0, bottom: 0 }) },
	head: {
		appendChild(el) {
			el.parentNode = this;
			styleTags.push(el);
		},
		removeChild(el) {
			el.parentNode = null;
			const i = styleTags.indexOf(el);
			if (i >= 0) styleTags.splice(i, 1);
		}
	},
	createElement(tag) {
		return { tagName: tag, attrs: {}, textContent: "", parentNode: null, setAttribute(k, v) { this.attrs[k] = v; } };
	},
	querySelector() {
		return styleTags.find((t) => t.attrs["data-plugin"] === "dsh-think-sticky") ?? null;
	},
	querySelectorAll() {
		return rows;
	},
	addEventListener(type, fn) {
		(docListeners[type] ??= []).push(fn);
	},
	removeEventListener(type, fn) {
		docListeners[type] = (docListeners[type] ?? []).filter((f) => f !== fn);
	}
};

const window = {
	addEventListener(type, fn) {
		(winListeners[type] ??= []).push(fn);
	},
	removeEventListener(type, fn) {
		winListeners[type] = (winListeners[type] ?? []).filter((f) => f !== fn);
	}
};

globalThis.window = window;
globalThis.document = document;
globalThis.requestAnimationFrame = (fn) => {
	raf = fn;
};
globalThis.getComputedStyle = (el) => ({ overflowY: el.overflowY });

// load the bundle through the loader contract, exactly like the browser
const loadCalls = [];
window.__ModuleLoader__ = { load: (d) => loadCalls.push(d) };
await import("../lib/client.js");
assert.equal(loadCalls.length, 1);
const plugin = loadCalls[0].factory();

const ctx = { disposers: [], effect(fn) { this.disposers.push(fn()); } };

// --- fixture: one expanded disclosure row inside a scrolling container ---
const scroller = makeEl({ overflowY: "auto", scrollHeight: 1000, clientHeight: 200, rect: { top: 0, bottom: 200 } });
const row1 = makeEl({ rect: { top: 50, bottom: 90 }, attrs: { "aria-expanded": "true" }, parent: scroller });
const row2 = makeEl({ rect: { top: 120, bottom: 160 }, attrs: { "aria-expanded": "false" }, parent: scroller });
rows = [row1, row2];

function scrollAndFlush() {
	for (const fn of docListeners["scroll"] ?? []) fn();
	const pending = raf;
	raf = null;
	if (pending) pending();
}

test("apply: injects one style tag and registers listeners", () => {
	plugin.apply(ctx);
	assert.equal(styleTags.length, 1);
	assert.equal(styleTags[0].attrs["data-plugin"], "dsh-think-sticky");
	assert.ok(styleTags[0].textContent.length > 500, "style tag must carry the CSS");
	assert.equal(docListeners["scroll"]?.length, 1);
	assert.equal(winListeners["resize"]?.length, 1);
	assert.equal(winListeners["load"]?.length, 1);
});

test("apply: idempotent under HMR re-apply", () => {
	plugin.apply(ctx);
	assert.equal(styleTags.length, 1, "second apply must not duplicate the style tag");
});

test("pin state: straddling top edge + expanded => dsh-pinned", () => {
	// rows start below the scroller top: nothing pinned
	assert.equal(row1.classList.contains("dsh-pinned"), false);
	assert.equal(row2.classList.contains("dsh-pinned"), false);

	// row1 scrolls up to straddle the top edge (expanded)
	row1.rect = { top: -30, bottom: 10 };
	scrollAndFlush();
	assert.equal(row1.classList.contains("dsh-pinned"), true);
	// row2 straddles too but is collapsed: must stay unpinned
	assert.equal(row2.classList.contains("dsh-pinned"), false);

	// collapsing row1 unpins it even while it straddles
	row1.attrs["aria-expanded"] = "false";
	scrollAndFlush();
	assert.equal(row1.classList.contains("dsh-pinned"), false);

	// expanding it again re-pins
	row1.attrs["aria-expanded"] = "true";
	scrollAndFlush();
	assert.equal(row1.classList.contains("dsh-pinned"), true);
});

test("cleanup: removes listeners, classes, and the style tag", () => {
	for (const dispose of ctx.disposers) dispose();
	assert.equal(styleTags.length, 0);
	assert.equal(docListeners["scroll"]?.length ?? 0, 0);
	assert.equal(winListeners["resize"]?.length ?? 0, 0);
	assert.equal(winListeners["load"]?.length ?? 0, 0);
	assert.equal(row1.classList.contains("dsh-pinned"), false, "pinned class must be stripped");
	assert.equal(row2.classList.contains("dsh-pinned"), false);
});

console.log(`\n${passed} smoke checks passed`);
