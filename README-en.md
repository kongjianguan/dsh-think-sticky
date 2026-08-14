# dsh-think-sticky

A DeepSeek Harness (`dsh web`) client plugin that **pins the Think disclosure row (the expand/collapse control) to the top of the viewport** while long reasoning text scrolls past — the interaction and look are faithful to the official chat.deepseek.com collapsible header.

中文版：[README.md](https://github.com/kongjianguan/dsh-think-sticky/blob/main/README.md)

## Install

1. Symlink this directory into the dsh web profile's module directory (so the loader can resolve it):

   ```bash
   ln -sfn "$PWD" ~/.dsh/profiles/node_modules/@kongjianguan/dsh-think-sticky
   ```

2. Append to `~/.dsh/profiles/web/cordis.patch.yml`:

   ```yaml
   - insert:
       - id: dsh-think-sticky
         name: '@kongjianguan/dsh-think-sticky'
   ```

   (The `cordis.patch.yml` at this repo's root is exactly the step-2 snippet.)

3. **Restart `dsh web`** (client modules are scanned at startup; hot reload works afterwards).

## Features

- **Sticky rows**: the header rows of Think disclosure blocks and of command-card/tool/bash blocks (`data-disclosure-row`, `data-variant="bash"`) stick to the top of the conversation scroller (`top: 0`) — once a block is taller than the viewport, its expand/collapse button never scrolls out of sight.
- **Transparent by default**: unpinned rows are fully transparent, indistinguishable from normal content; the mask appears only while a row is **actually pinned and its block is expanded** (`aria-expanded="true"`).
- **Official-style fade**: while pinned, a 24px gradient fade band (`linear-gradient(var(--dsw-alias-bg-base), transparent)`, the official .c99b79f8 curve) sits below the row, so scrolled content visibly melts under it instead of hitting a hard edge — no borders, no shadows, no persistent background blocks.
- **Theme-aware**: every color comes from dsh web design tokens (`--dsw-alias-bg-base`), following dark/light themes automatically.
- **JS-driven pin state**: a scroll listener (capture phase, rAF-throttled) checks each row against the top edge of its scrolling container and toggles the `dsh-pinned` class; the mask fades in over 120ms.
- **Graceful degradation**: if upstream ever wraps a row in an overflow-hidden ancestor, sticky silently stops working and the row scrolls away exactly as before — the mask simply never appears.

## How it works

- **Client-only**: `lib/index.js` is an empty Host plugin that exists only to satisfy the Cordis loader contract; all behavior lives in `lib/client.js` (browser bundle via `window.__ModuleLoader__.load(...)`, discovered through the `dsh.client` declaration in `package.json`).
- **Injected styles**: on startup a `<style data-plugin="dsh-think-sticky">` tag is injected — idempotent (no duplicates on HMR reloads) and removed on teardown.
- **Pin detection**: `scrollerOf()` walks the ancestor chain to find the first scrollable container (cached in a WeakMap); a row is pinned when its box straddles the container's top edge.
- **Mask layers**: the row's `::after` (page background color, z-index -1) keeps scrolled content from showing through the text while pinned; `::before` (the gradient fade band) extends 24px below the row.

## License

MIT — see [LICENSE](./LICENSE)
