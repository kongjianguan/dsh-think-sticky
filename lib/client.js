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
      var ROWS = '[data-slot="conversation.session"] [data-disclosure-row],' +
        '[data-slot="conversation.session"] [data-variant="bash"][role="button"]'

      var CSS = [
        '/* dsh-think-sticky: pin block header rows; mask fades in only while pinned */',
        ROWS + '{',
        '  position: sticky;',
        '  top: 0;',
        '  z-index: 1;',
        '  /* taller pinned header (hit area) */',
        '  padding-block: 4px;',
        '}',
        ROWS + '::after{',
        '  content: "";',
        '  position: absolute;',
        '  inset: 0;',
        '  background: var(--dsw-alias-bg-base);',
        '  opacity: var(--dsh-pinned, 0);',
        '  z-index: -1;',
        '  transition: opacity 120ms ease-out;',
        '}'
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
          row.style.setProperty('--dsh-pinned', pinned && expanded ? '1' : '0')
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
          for (var i = 0; i < rows.length; i++) rows[i].style.removeProperty('--dsh-pinned')
          if (styleTag && styleTag.parentNode) styleTag.parentNode.removeChild(styleTag)
        }
      })
    }

    module.exports = { name: 'dsh-think-sticky', apply: apply }
    return module.exports
  }
})
