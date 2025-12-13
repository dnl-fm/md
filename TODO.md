# TODO

## Bugs

- [ ] **Syntax highlighting not working in production build** - Code blocks render as black text after `bun run build`, but work correctly in dev mode. Shiki highlighter signal approach didn't fix it. Needs investigation into build-time vs runtime behavior differences.

- [x] **WASM Editor scrollbar disappears during scroll** - FIXED

  **Root cause:** WebView (Chromium/WebView2) scrollbar paint/compositor bug triggered by
  virtual-scroll layout using `position: absolute` + `transform: translateY()`.

  **Fix:** Use `translate3d(0, y, 0)` + `will-change: transform` instead of `translateY()`.
  This pins elements to a stable compositing layer, avoiding the paint bug.

  ```css
  .wasm-lines, .wasm-gutter-lines {
    will-change: transform;
  }
  ```
  ```tsx
  style={{ transform: `translate3d(0, ${offset}px, 0)` }}
  ```

  Also added `scrollbar-gutter: stable` to `.wasm-content` for good measure.
