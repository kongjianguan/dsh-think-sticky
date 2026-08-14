/**
 * @local/dsh-think-sticky — browser bundle (module-factory form, mirrors
 * the dsh client loader contract used by @local/dsh-opencode-usage).
 *
 * Problem: block header rows (Think reasoning, command cards, context
 * injection, tool rows, bash rows) live at the top of their block. When an
 * expanded block is taller than the viewport, scrolling pushes the row —
 * and its expand/collapse button — out of view.
 *
 * Approach (mirrors the official DeepSeek chat UI): the row is sticky at
 * the top of the conversation scroller, but stays visually transparent.
 * While the row is actually pinned (and its block is expanded), a mask
 * layer (::after, page background color) fades in underneath the text so
 * scrolled content never shows through — no persistent background blocks,
 * no borders, no shadows.
 *
 * The pin state is tracked with a scroll listener (capture phase, rAF
 * throttled): a row is "pinned" when its box straddles the top edge of its
 * nearest scrolling container. Only expanded rows (aria-expanded="true")
 * get the mask, so collapsed rows scroll past cleanly.
 *
 * Degradation is graceful: if upstream ever wraps the row in an
 * overflow-hidden ancestor, sticky silently stops working and the row
 * scrolls away exactly as before — the mask simply never appears.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-think-sticky',
  factory: function () {
    var module = { exports: {} }

    function apply(ctx) {
      var ROWS_A = '[data-slot="conversation.session"] [data-disclosure-row]'
      var ROWS_B = '[data-slot="conversation.session"] [data-variant="bash"][role="button"]'
      var ROWS = ROWS_A + ',' + ROWS_B
      // NOTE: selector lists cannot share a ::after suffix — each selector must
      // carry its own, otherwise the bare element also receives the pseudo
      // styles (position:absolute would clobber sticky).
      var MASK = ROWS_A + '::after,' + ROWS_B + '::after'
      var MASK_PINNED = ROWS_A + '.dsh-pinned::after,' + ROWS_B + '.dsh-pinned::after'

      var CSS = [
        '/* dsh-think-sticky: pin block header rows; fade-out mask appears below the row only while pinned (mirrors official chat.deepseek.com) */',
        ROWS + '{',
        '  position: sticky;',
        '  top: 0;',
        '  z-index: 7;',
        '  /* taller pinned header: 24px content + 5px*2 padding = 34px, matching official --collapsible-area-title-height */',
        '  padding-block: 5px;',
        '}',
        MASK + '{',
        '  content: "";',
        '  pointer-events: none;',
        '  width: calc(100% + 10px);',
        '  background-color: var(--dsw-alias-bg-base);',
        '  opacity: 0;',
        '  position: absolute;',
        '  /* the row box itself must stay opaque (no content behind the label), and',
        '     the fade starts exactly at the row bottom: solid 0% -> row bottom',
        '     (34px of 82px = 41.5%), then a 48px fade below */',
        '  inset: 0 0 -48px 0;',
        '  right: 0;',
        '  transform: translateZ(0);',
        '  -webkit-mask-image: linear-gradient(#000 0%, #000 41.5%, transparent 100%);',
        '  mask-image: linear-gradient(#000 0%, #000 41.5%, transparent 100%);',
        '  mask-size: 100% 100%;',
        '  mask-repeat: repeat-x;',
        '  transition: opacity 120ms ease-out;',
        '}',
        MASK_PINNED + '{',
        '  opacity: 1;',
        '}',
        // While pinned the row itself must be opaque: scrolled content passes
        // through the row box (the fade mask only covers the 24px below it),
        // and without a background it shows through and mixes with the label.
        // No box-shadow: on the official site the "shadow" is only the bg-colored
        // fade mask dissolving scrolled text — the background stays seamless. A
        // black drop shadow would paint a visible band on the flat dsh background.
        // The mask (below) already covers the row box and fades below it.
      ].join('\n')

      // Idempotent: skip if the same style tag is already present (HMR reloads).
      if (document.querySelector('style[data-plugin="dsh-think-sticky"]') === null) {
        var styleTag = document.createElement('style')
        styleTag.setAttribute('data-plugin', 'dsh-think-sticky')
        styleTag.textContent = CSS
        document.head.appendChild(styleTag)
      }

      var ticking = false
      var scrollerCache = new WeakMap()

      function scrollerOf(el) {
        var cached = scrollerCache.get(el)
        if (cached) return cached
        var p = el.parentElement
        while (p) {
          var cs = getComputedStyle(p)
          var ov = cs.overflowY
          if ((ov === 'auto' || ov === 'scroll') && p.scrollHeight > p.clientHeight + 1) {
            scrollerCache.set(el, p)
            return p
          }
          p = p.parentElement
        }
        var root = document.scrollingElement || document.documentElement
        scrollerCache.set(el, root)
        return root
      }

      function update() {
        ticking = false
        var rows = document.querySelectorAll(ROWS)
        for (var i = 0; i < rows.length; i++) {
          var row = rows[i]
          var sc = scrollerOf(row)
          var scRect = sc.getBoundingClientRect()
          var rect = row.getBoundingClientRect()
          var pinned = rect.top <= scRect.top + 2 && rect.bottom > scRect.top + 2
          var expanded = row.getAttribute('aria-expanded') === 'true'
          row.classList.toggle('dsh-pinned', pinned && expanded)
        }
      }

      function schedule() {
        if (ticking) return
        ticking = true
        requestAnimationFrame(update)
      }

      document.addEventListener('scroll', schedule, true)
      window.addEventListener('resize', schedule)
      window.addEventListener('load', schedule)
      update()

      ctx.effect(function () {
        return function () {
          document.removeEventListener('scroll', schedule, true)
          window.removeEventListener('resize', schedule)
          window.removeEventListener('load', schedule)
          var rows = document.querySelectorAll(ROWS)
          for (var i = 0; i < rows.length; i++) rows[i].classList.remove('dsh-pinned')
          if (styleTag && styleTag.parentNode) styleTag.parentNode.removeChild(styleTag)
        }
      })
    }

    module.exports = { name: 'dsh-think-sticky', apply: apply }
    return module.exports
  }
})
