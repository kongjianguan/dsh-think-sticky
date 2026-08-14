/**
 * @local/dsh-think-sticky — browser bundle (module-factory form, mirrors
 * the dsh client loader contract used by @local/dsh-opencode-usage).
 *
 * Problem: the assistant reasoning (Think) disclosure row lives at the top
 * of its block. When the expanded reasoning text is taller than the
 * viewport, scrolling pushes the row — and its expand/collapse button —
 * out of view.
 *
 * Fix (pure CSS, no hash class names):
 *   [data-variant="think"] [data-disclosure-row] { position: sticky; top: 0 }
 * The row's nearest scrollport is the conversation scroller
 * (`.Md3f7G_scroll`, overflow-y: auto), and no intermediate ancestor
 * establishes an overflow clip, so the sticky row parks at the top of the
 * chat viewport while the reasoning body scrolls underneath. A solid
 * theme background keeps scrolled content from showing through.
 *
 * Degradation is graceful: if upstream ever wraps the row in an
 * overflow-hidden ancestor, sticky silently stops working and the button
 * scrolls away exactly as before — nothing breaks.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-think-sticky',
  factory: function () {
    var module = { exports: {} }

    var CSS = [
      '/* dsh-think-sticky: keep the Think row (expand/collapse) visible */',
      '[data-variant="think"] [data-disclosure-row]{',
      '  position: sticky;',
      '  top: 0;',
      '  z-index: 1;',
      '  background: var(--dsw-alias-bg-base);',
      '}'
    ].join('\n')

    // Idempotent: skip if the same style tag is already present (HMR reloads).
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin="dsh-think-sticky"]') === null) {
      var styleTag = document.createElement('style')
      styleTag.setAttribute('data-plugin', 'dsh-think-sticky')
      styleTag.textContent = CSS
      document.head.appendChild(styleTag)
    }

    return module.exports
  }
})
