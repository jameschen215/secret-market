# Project: Where's Waldo (A Photo Tagging App from The Odin Project)

A photo-tagging game built with SvelteKit, Svelte 5, and Tailwind CSS.

---

## What I've Learned

### SvelteKit & Svelte 5

- **Global CSS** belongs in `/src/app.css`, imported in the root `+layout.svelte`. Never put it in `/static/` — those files bypass Vite/PostCSS processing, breaking Tailwind.
- **`tick()`** (imported from `svelte`) returns a promise that resolves after Svelte has flushed all pending state changes to the DOM. Useful when you need to force a remount — e.g. `selectorOpen = false; await tick(); selectorOpen = true` guarantees the `{#if}` block is destroyed and recreated so CSS animations replay correctly.
- **`$derived` is writable in Svelte 5.25+** — you can temporarily override a derived value by reassigning it (e.g. `formResult = null`). Prior to 5.25 it was read-only.
- **`$state` + `$effect` to mirror a prop is an anti-pattern** — use `$derived` instead. The ESLint rule `svelte/prefer-writable-derived` enforces this.

### Coordinate Systems

When handling mouse clicks on a game board, there are multiple coordinate spaces in play:

- **Normalized image coordinates (0.0–1.0)** — click position as a fraction of the image dimensions. Used for hit detection and DB storage, so results are screen-size independent.
- **Viewport-absolute pixels** — used for positioning UI feedback (e.g. a popup bubble) via `clientX/clientY`.
- **Board-relative pixels** — viewport pixels minus the board element's `getBoundingClientRect()` origin. Used for CSS `left`/`top` on `position: absolute` children of the board.

### CSS Animations & Transforms

- **`translate`, `rotate`, `scale` are standalone CSS properties** separate from `transform`. The browser composes them together in the order `translate` → `rotate` → `scale` → `transform`. This means you can animate `translate` in a `@keyframes` without conflicting with `transform: translateY(...)` set by placement modifier classes — they run on completely separate tracks. For example, use `translate: -8px 0` in keyframes (the standalone property) instead of `transform: translateX(-8px)`, so the animation never touches the `transform` that placement classes depend on.
- **CSS custom properties inside `@keyframes`** are resolved once at the start of the animation, before modifier classes apply their overrides. Avoid relying on them for values that change per variant.
- **`pointer-events: none`** on a parent blocks hover and click events on all children, not just the element itself. To make children interactive while keeping the parent non-blocking, set `pointer-events: auto` explicitly on the children.
- **CSS animation duration** — 150–200ms is the sweet spot for UI popups. Anything above ~500ms feels sluggish; 2000ms is an eternity.

### Browser APIs

- **`requestAnimationFrame(callback)`** schedules a callback to run just before the browser paints the next frame (~60fps). It automatically pauses when the tab is hidden and never fires faster than the screen refresh rate. Returns a numeric ID used to cancel it via `cancelAnimationFrame(id)`.
- **Recursive rAF loop** — calling `requestAnimationFrame(fn)` inside `fn` itself creates a self-scheduling loop. Unlike true recursion, the call stack never grows — each invocation completes and returns before the browser calls it again next frame.
- **`requestAnimationFrame` vs `setInterval`** — rAF syncs with the display refresh rate, pauses on hidden tabs, and never accumulates. `setInterval` fires on a fixed clock regardless of rendering, can drift, and wastes CPU in background tabs.
