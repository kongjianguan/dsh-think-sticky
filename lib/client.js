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
      // NOTE: selector lists cannot share a pseudo-element suffix — each selector
      // must carry its own, otherwise the bare element also receives the pseudo
      // styles (position:absolute would clobber sticky).
      var BG = ROWS_A + '::after,' + ROWS_B + '::after'
      var FADE = ROWS_A + '::before,' + ROWS_B + '::before'
      var FADE_PINNED = ROWS_A + '.dsh-pinned::before,' + ROWS_B + '.dsh-pinned::before'

      var CSS = [
        '/* dsh-think-sticky — faithful port of the official chat.deepseek.com',
        '   collapsible header:',
        '   - row: sticky, z-index 7, opaque via ::after bg layer (official _245c867:after)',
        '   - ::before: 24px fade mask below the row (official .c99b79f8), opacity',
        '     driven by JS while pinned */',
        ROWS + '{',
        '  position: sticky;',
        '  top: 0;',
        '  z-index: 7;',
        '  /* taller pinned header: 24px content + 5px*2 padding = 34px, matching official --collapsible-area-title-height */',
        '  padding-block: 5px;',
        '}',
        /* persistent opaque background layer — behind the row content */
        BG + '{',
        '  content: "";',
        '  pointer-events: none;',
        '  width: calc(100% + 10px);',
        '  background-color: var(--dsw-alias-bg-base);',
        '  z-index: -1;',
        '  height: calc(100% + 1px);',
        '  position: absolute;',
        '  top: -1px;',
        '  right: 0;',
        '}',
        /* fade mask below the row — official .c99b79f8 */
        FADE + '{',
        '  content: "";',
        '  pointer-events: none;',
        '  width: calc(100% + 10px);',
        '  /* gradient background = the official fade, drawn directly (no mask',
        '     image): solid bg at the row bottom dissolving to transparent —',
        '     scrolled text visibly melts instead of hitting a hard edge */',
        '  background: linear-gradient(var(--dsw-alias-bg-base), transparent);',
        '  opacity: 0;',
        '  /* user-confirmed via live tuner: tuneFade(24, 0, 0) — 24px, pure',
        '     bg-color gradient, no darkening — matches the official 24px fade */',
        '  background: linear-gradient(var(--dsw-alias-bg-base), transparent);',
        '  height: 24px;',
        '  position: absolute;',
        '  top: calc(100% - 1px);',
        '  right: 0;',
        '  transition: opacity 120ms ease-out;',
        '}',
        FADE_PINNED + '{',
        '  opacity: 1;',
        '}',
        ROWS + '.dsh-pinned{',
        '  /* CRITICAL: the row classes are overflow:hidden, which clips the',
        '     absolutely-positioned ::before fade band to the row box — only a',
        '     1px sliver ever showed. While pinned, let the fade extend below. */',
        '  overflow: visible !important;',
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
