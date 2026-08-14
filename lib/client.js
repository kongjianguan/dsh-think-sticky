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
 *   [data-slot="conversation.session"] [data-disclosure-row] { position: sticky; top: 0 }
 *   [data-slot="conversation.session"] [data-variant="bash"][role="button"] { ... }
 * Every block type in the message flow renders its expand/collapse header as a
 * DisclosureRow (ReasoningRow think, GenericCommandCard, ContextInjectionRow,
 * ToolRow for all tool variants) — except BashRow, which uses a custom row
 * (data-variant="bash" + role="button"). The row's nearest scrollport is the
 * conversation scroller, and no intermediate ancestor establishes an overflow
 * clip, so the sticky row parks at the top of the chat viewport while the
 * expanded body scrolls underneath. A solid theme background keeps scrolled
 * content from showing through.
 *
 * Collapsed blocks are naturally unaffected: their containing block is only
 * as tall as the row itself, so sticky has no room to pin and the row scrolls
 * away exactly as before.
 *
 * Degradation is graceful: if upstream ever wraps the row in an
 * overflow-hidden ancestor, sticky silently stops working and the button
 * scrolls away exactly as before — nothing breaks.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-think-sticky',
  factory: function () {
    var module = { exports: {} }

    function apply(ctx) {
      var CSS = [
        '/* dsh-think-sticky: keep block header rows (expand/collapse) visible while scrolling */',
        '[data-slot="conversation.session"] [data-disclosure-row],',
        '[data-slot="conversation.session"] [data-variant="bash"][role="button"]{',
        '  position: sticky;',
        '  top: 0;',
        '  z-index: 1;',
        '  background: var(--dsw-alias-bg-base);',
        '}'
      ].join('\n')

      // Idempotent: skip if the same style tag is already present (HMR reloads).
      if (document.querySelector('style[data-plugin="dsh-think-sticky"]') === null) {
        var styleTag = document.createElement('style')
        styleTag.setAttribute('data-plugin', 'dsh-think-sticky')
        styleTag.textContent = CSS
        document.head.appendChild(styleTag)
        ctx.effect(function () {
          return function () {
            if (styleTag.parentNode) styleTag.parentNode.removeChild(styleTag)
          }
        })
      }
    }

    module.exports = { name: 'dsh-think-sticky', apply: apply }
    return module.exports
  }
})
