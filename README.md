# Secret Market — Where's Waldo Photo Tagging App

A photo-tagging game built with SvelteKit, Svelte 5, and Tailwind CSS as an assignment from [The Odin Project](https://www.theodinproject.com/).

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Configuration](#project-configuration)
3. [Database Schema](#database-schema)
4. [Type System](#type-system)
5. [Server-Side Security Layer](#server-side-security-layer)
6. [Client-Side Hit Detection](#client-side-hit-detection)
7. [Game State](#game-state)
8. [Validation Schemas](#validation-schemas)
9. [API Endpoints](#api-endpoints)
10. [Page Load & Form Actions](#page-load--form-actions)
11. [UI Components](#ui-components)
12. [Leaderboard](#leaderboard)
13. [Global Styles](#global-styles)
14. [Architecture Overview](#architecture-overview)
15. [What I've Learned](#what-ive-learned)

---

## Tech Stack

| Layer          | Technology                                |
| -------------- | ----------------------------------------- |
| Meta-framework | SvelteKit `^2.63.0`                       |
| UI library     | Svelte 5 `^5.56.1` (runes mode)           |
| Bundler        | Vite (via `@sveltejs/vite-plugin-svelte`) |
| ORM            | Prisma 7 with `@prisma/adapter-pg`        |
| Database       | PostgreSQL (via `pg` node-postgres)       |
| Validation     | Zod v4                                    |
| ID generation  | `@paralleldrive/cuid2`                    |
| Styling        | Tailwind CSS + CSS custom properties      |

---

## Project Configuration

### `vite.config.ts` — Runes Mode Enforcement

```ts
runes: ({ filename }) =>
	filename.split(/[/\\]/).includes('node_modules') ? undefined : true;
```

This forces **runes mode** (`$state`, `$derived`, `$effect`) across the entire project while leaving `node_modules` unaffected. As a consequence, legacy Svelte 4 syntax like `on:click` will not work — `onclick` must be used instead.

### `prisma.config.ts`

Configures Prisma's schema location, migration path, and seed script (`tsx prisma/seed.ts`). `DATABASE_URL` is pulled from `.env` via `dotenv/config`.

### `tsconfig.json`

Extends SvelteKit's auto-generated tsconfig. `strict: true` is enabled. `moduleResolution: "bundler"` is the correct setting for Vite-based projects.

---

## Database Schema

### `prisma/schema.prisma` — The Data Model

Five models with the following relationships:

```
Game ──< Target       (one game has many targets)
Game ──< GameSession  (one game has many sessions)
GameSession ──< Hit   (one session records many hit attempts)
GameSession ──1 Score (one session produces one final score)
Hit >── Target        (each hit references a specific target)
```

**`Game`** — stores the image path and `minTimeMs` (the anti-cheat minimum completion time).

**`Target`** — stores `polygonPoints` and `boundingBox` as `Json` (PostgreSQL JSONB). These are normalized (0.0–1.0) coordinates defining each character's position. They are **never sent to the client in plain form**.

**`GameSession`** — has a `SessionStatus` enum (`ACTIVE | COMPLETED | EXPIRED | FLAGGED`). The `tokenHash` column links a DB session to the signed token held by the client — the actual token is never stored, only its HMAC hash.

**`Hit`** — records every click attempt with `clickX/clickY` (normalized, 0–1) and `verified` (boolean). The constraint `@@unique([sessionId, targetId])` prevents a target from being counted twice in the same session.

**`Score`** — the final leaderboard entry. `sessionId` is unique, so only one score can be submitted per session. `@@index([timeMs])` makes leaderboard sorting efficient.

### `prisma/seed.ts`

Seeds one game (`secret-market`) with three targets: Finn, Ruby, and Sage. Each character is defined as a polygon (array of `{x, y}` points in normalized 0–1 space). A `computeBoundingBox` helper derives the AABB (axis-aligned bounding box) from those points for use as an O(1) pre-rejection step during hit detection.

---

## Type System

### `src/lib/types.ts`

Defines the shared contract between server and client:

```ts
// Raw geometry — used on both sides
interface PolygonPoint {
	x: number;
	y: number;
}
interface BoundingBox {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

// What the client receives — polygon data is opaque base64
interface EncryptedTarget {
	id: number;
	name: string;
	displayName: string;
	imagePath: string;
	encryptedPolygon: string;
	encryptedBoundingBox: string;
}

// Embedded in the HMAC-signed session token
interface TokenPayload {
	sessionId: string;
	gameId: number;
	startedAt: number; // Unix timestamp in ms
}
```

---

## Server-Side Security Layer

### `src/lib/server/crypto.ts` — The Anti-Cheat Engine

This file solves a genuine architectural problem: hit detection data cannot be sent to the client in plain form (it would trivialize cheating), but a server round-trip on every click would feel laggy. The solution is a **session-specific affine encryption** scheme combined with **server re-verification**.

#### Session-Specific Crypto Params

```ts
export function deriveSessionParams(sessionId: string): SessionCryptoParams {
	const hash = createHash('sha256')
		.update(`${sessionId}:${SESSION_SECRET}`)
		.digest('hex');

	const a = 2 + (parseInt(hash.slice(0, 8), 16) % 1000) / 100; // 2.00–11.99
	const bx = (parseInt(hash.slice(8, 16), 16) % 10000) / 100; // 0.00–99.99
	const by = (parseInt(hash.slice(16, 24), 16) % 10000) / 100; // 0.00–99.99

	return { a, bx, by };
}
```

Every session gets a unique `{ a, bx, by }` triple derived from `sessionId + SESSION_SECRET`. These params are deterministic — no need to store them in the database.

#### Polygon Encryption / Decryption

The server encrypts using an affine transform:

```
x' = (x * a) + bx
y' = (y * a) + by
```

The result is base64-encoded and sent to the client along with the decryption params (`a`, `bx`, `by`). The client can decrypt and run hit detection locally for instant feedback.

This may appear to make the encryption pointless, but the intent is **obfuscation plus mandatory server re-verification**. Every confirmed hit is re-verified server-side against the real, unencrypted polygon stored in the database. A client that modifies the encrypted data will fail the server check.

#### HMAC Token Signing

```ts
// Token format: base64(payload).hmac_signature
export function signToken(payload: TokenPayload): string {
	const data = btoa(JSON.stringify(payload));
	const signature = createHmac('sha256', SESSION_SECRET)
		.update(data)
		.digest('hex');
	return `${data}.${signature}`;
}
```

Token verification uses a **timing-safe XOR comparison** to prevent timing attacks:

```ts
let mismatch = 0;
for (let i = 0; i < signature.length; i++) {
	mismatch |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
}
if (mismatch !== 0) return null;
```

The `hashToken()` function produces the `tokenHash` value stored in the database. The raw token is never persisted.

### `src/lib/server/prisma.ts` — Singleton Client

```ts
const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });
export { prisma };
```

One `PrismaClient` instance is shared across all server-side requests. The `PrismaPg` adapter replaces Prisma's default query engine binary with the `pg` driver.

---

## Client-Side Hit Detection

### `src/lib/hit-detection.ts` — PNPOLY Ray Casting

Implements the standard PNPOLY algorithm for point-in-polygon testing:

**Step 1 — Bounding box pre-check (O(1) fast reject)**

```ts
export function inBoundingBox(clickX, clickY, box): boolean {
	return (
		clickX >= box.minX &&
		clickX <= box.maxX &&
		clickY >= box.minY &&
		clickY <= box.maxY
	);
}
```

If the click is outside the AABB rectangle, skip the expensive polygon test entirely.

**Step 2 — Ray casting**

Casts a horizontal ray from the click point to the right. Counts how many polygon edges the ray crosses: odd = inside, even = outside. Works for any simple polygon, convex or concave, with no self-intersections.

**`checkHit()`** composes both: bounding box first, ray cast only if inside the box.

### `src/lib/decrypt.ts`

The client-side inverse of the server's affine encryption:

```
x = (x' - bx) / a
y = (y' - by) / a
```

Both `decryptPolygon()` and `decryptBoundingBox()` parse the base64 string and apply the reverse formula. Errors silently return empty arrays or zero-boxes.

---

## Game State

### `src/lib/game-state.svelte.ts` — Module-Level Reactive State

This file uses **module-level `$state` variables** — not a class, not a Svelte store. This is valid in Svelte 5 because `$state` creates reactive signals that work anywhere, not only inside components. The result is a singleton shared across all components without prop drilling or the context API.

#### State Variables

```ts
let phase = $state<GamePhase>('idle'); // 'idle' | 'playing' | 'completed'
let sessionId = $state<string | null>(null);
let token = $state<string | null>(null);
let encryptedTargets = $state<EncryptedTarget[]>([]);
let decryptionParams = $state<DecryptionParams | null>(null);
let foundTargetIds = new SvelteSet<number>(); // reactive Set
let feedback = $state<ClickFeedback | null>(null);

// Preloading
let preloading = $state(false);
let preloadedSession = $state<SessionData | null>(null);

// Timer
let timerStart = $state(0);
let timerElapsed = $state(0);
let timerRunning = $state(false);
let timerFrame = 0; // rAF ID — not reactive
```

#### Timer — Recursive `requestAnimationFrame` Loop

```ts
function tickTimer() {
	if (!timerRunning) return;
	timerElapsed = performance.now() - timerStart;
	timerFrame = requestAnimationFrame(tickTimer);
}
```

Each frame updates `timerElapsed`, then schedules itself for the next frame. The returned rAF ID is stored so `cancelAnimationFrame(timerFrame)` can cleanly stop the loop. Unlike `setInterval`, rAF syncs with the display refresh rate and automatically pauses on hidden tabs.

#### Preloading Strategy

`startGame()` has three code paths:

1. **Preloaded session ready** → apply instantly (synchronous, zero start latency)
2. **Preload in flight** → poll every 50ms, then apply when done
3. **No preload** → fetch fresh (fallback)

After consuming a preloaded session, it immediately starts preloading the next one. This means every "Start Game" click is perceived as instant.

#### `handleClick()` — Core Click Handler

1. Guards: phase must be `'playing'`, decryption params must exist
2. Decrypts the target's polygon and bounding box client-side
3. Runs `checkHit()` locally
4. **On hit**: optimistic UI update — immediately adds to `foundTargetIds` and shows feedback, then fires `verifyHitOnServer()` asynchronously (fire-and-forget)
5. If all targets found: stops the timer, transitions phase to `'completed'`

---

## Validation Schemas

### `src/lib/schema.ts`

Three Zod schemas guard all inputs:

**`startGameSchema`** — validates `gameId` is a positive integer.

**`verifyHitSchema`** — validates `sessionId` is non-empty, `targetId` is a positive integer, and `clickX`/`clickY` are in `[0, 1]`.

**`submitScoreSchema`** — note `z.coerce.number()` for `durationMs`. Form data always arrives as strings; `coerce` handles the conversion automatically.

---

## API Endpoints

### `POST /api/start-game`

Called when starting or preloading a game session:

1. Validates body with `startGameSchema`
2. Loads the game (with targets) from the database
3. Generates a CUID2 session ID
4. Derives session-specific crypto params from the session ID
5. Signs the token payload (`sessionId`, `gameId`, `startedAt`)
6. Creates the `GameSession` row in the database with the hashed token
7. Encrypts every target's polygon and bounding box
8. Returns `{ sessionId, token, encryptedTargets, decryptionParams, startedAt }`

The `decryptionParams` (`a`, `bx`, `by`) are intentionally sent to the client to enable local hit detection. Server verification uses the real polygon from the database regardless.

### `POST /api/verify-hit`

Called fire-and-forget after every client-side hit detection:

1. Validates input with `verifyHitSchema`
2. Checks the session exists and is `ACTIVE`
3. Checks this target has not already been found in this session (unique constraint guard)
4. Loads the real, unencrypted polygon from the database
5. Runs `checkHit()` server-side — this is the tamper-proof verification
6. Writes a `Hit` record with `verified: isHit`
7. If hit, counts total targets vs verified hits to return `allFound` status

---

## Page Load & Form Actions

### `src/routes/+page.server.ts`

**`load`** — queries the first game with its targets (display fields only: `id`, `name`, `displayName`, `imagePath`). Returns `{ game, targets }` to the page.

**`submitScore` action** — the most validation-heavy path:

1. Parses form data with `submitScoreSchema` (Zod coerces `durationMs` from string to number)
2. `verifyToken()` — HMAC-verifies the signed token
3. Looks up session by `tokenHash` (never by the raw token)
4. Guards: session must be `ACTIVE`, no existing score
5. **Anti-cheat timing validation**: `durationMs` must be ≥ `game.minTimeMs` AND ≤ the server's elapsed time since `payload.startedAt`. A too-fast or impossible time flags the session.
6. **Hit completeness check**: counts `verified: true` hits server-side. If not all targets are verified, returns `SERVER_ERROR` (retryable — this is a legitimate sync race, not cheating).
7. Writes the score and updates session status atomically in a `$transaction`
8. Computes rank and redirects to `/leaderboard?rank=X&time=Y`

---

## UI Components

### `src/routes/+layout.svelte`

Minimal shell: imports `app.css` (critical — this is where Vite/PostCSS processes global styles and Tailwind), injects the favicon via a Svelte import, renders `{@render children()}` (Svelte 5 snippet syntax), and provides a footer.

### `src/routes/+page.svelte` — Main Game Page

Key patterns used:

```ts
// Writable derived (Svelte 5.25+) — mirrors server form result
let formResult = $derived(form);

// Runs on mount — resets any leftover game state from a previous session
$effect(() => {
	resetGame();
});

// $effect.root lives for the full component lifetime, not tied to reactive deps
// Starts preloading the next session immediately as the page loads
$effect.root(() => {
	preloadSession(data.game.id);
});
```

The layout is a CSS grid: game board + 220px sidebar on desktop, single column on mobile (`@media (max-width: 1024px)`). Mobile has a tappable overlay on the game image; desktop has a "Start Game" button in the sidebar.

### `src/routes/_components/GameBoard.svelte`

This component manages the most complex coordinate geometry in the project.

#### Two Separate Coordinate Systems

Two distinct DOM elements serve different purposes:

- `imgEl` (`e.currentTarget` — the image wrapper div): used to compute normalized click percentages (0–1) for hit detection
- `boardEl` (`bind:this` — the outer board div): used to position the click ring and selector menu in board-relative pixels

#### Click Handling

```ts
async function onImageClick(e: MouseEvent) {
	// 1. Normalized coordinates for hit detection
	clickPercentX = (e.clientX - rect.left) / rect.width;
	clickPercentY = (e.clientY - rect.top) / rect.height;

	// 2. Board-relative pixels for UI positioning
	clickX = e.clientX - boardRect.left;
	clickY = e.clientY - boardRect.top;

	// 3. Adjust menu position for screen edges
	menuPlacementX =
		boardRect.width - selectorX >= MENU_WIDTH + RING_OFFSET ? 'right' : 'left';
	// ... Y placement logic ...

	// 4. Force DOM remount so CSS animation replays on repeated clicks
	if (selectorOpen) {
		selectorOpen = false;
		await tick(); // Svelte flushes the false state, destroying the menu element
	}
	selectorOpen = true;
}
```

The `clickX/Y` (for the click ring) and `selectorX/Y` (for the menu) are kept separate — conflating them causes the ring to jump to the adjusted menu position on small screens.

#### CSS Animation Technique

```css
@keyframes menuSlide {
	from {
		opacity: 0;
		translate: -8px 0;
	}
	to {
		translate: 0 0;
		opacity: 1;
	}
}
```

The standalone `translate` CSS property is used instead of `transform: translateX(...)`. This avoids conflicting with `transform: translateY(-50%)` set by placement modifier classes — they run on completely separate CSS tracks.

### `src/routes/_components/ScoreModal.svelte`

Renders three UI states based on `formResult.errorCode`:

- **Normal** — name input + submit (hidden fields carry `token` and `durationMs`)
- **`FLAGGED`** — warning icon, explanation message, Close button only (no retry)
- **`SERVER_ERROR`** — retry button (retryable race condition, not a cheating flag)

Uses SvelteKit's `use:enhance` for progressive enhancement — the form works without JavaScript but with JavaScript becomes AJAX with a loading state.

```ts
const onSubmit: SubmitFunction = () => {
	submitting = true;
	return async ({ update }) => {
		submitting = false;
		await update(); // syncs server response back into `form`
	};
};
```

`$effect(() => { inputEl?.focus(); })` auto-focuses the name input on mount.

### `src/routes/_components/TargetPanel.svelte`

Reads `getPhase()` and `isTargetFound()` reactively. Uses `{@const found = ...}` to compute per-iteration variables inside `{#each}`. The card border transitions to green when a target is found. On mobile it becomes a horizontal row of compact cards; on desktop it is a vertical stack.

### `src/routes/_components/Timer.svelte`

A pure display component. Reads `getElapsed()` (the `timerElapsed` state, updating ~60fps via rAF) and formats it with `formatTime()` into `MM:SS:cs`. CSS transitions color from muted → white when running → green when completed.

---

## Leaderboard

### `src/routes/leaderboard/+page.server.ts`

Uses `Promise.all` for three independent queries (score page + total count + game ID) — avoids the `$transaction` anti-pattern for queries that don't need atomicity.

Pagination is manual `skip`/`take`. If the player's rank is outside the visible page range, a separate query fetches their specific score entry to display it below the table with a `· · ·` separator.

### `src/routes/leaderboard/+page.svelte`

```ts
// Starts preloading the next session while the player views the leaderboard
$effect.root(() => {
	if (data.gameId) preloadSession(data.gameId);
});

// Builds pagination links that preserve rank/time highlight params
function pageParams(page: number): string {
	const params = new SvelteURLSearchParams();
	params.set('page', String(page));
	if (data.highlightRank) params.set('rank', String(data.highlightRank));
	if (data.highlightTime) params.set('time', String(data.highlightTime));
	return params.toString();
}
```

`SvelteURLSearchParams` is Svelte's reactive wrapper around `URLSearchParams`. A player's row is highlighted by matching `score.timeMs === data.highlightTime`.

---

## Global Styles

### `src/app.css`

Defines a comprehensive CSS custom property system:

**Color tokens** — surfaces (`--color-bg`, `--color-bg-elevated`, `--color-bg-overlay`), text (`--color-text`, `--color-text-muted`, `--color-text-dim`), accents (`--color-gold`, `--color-accent-green`, `--color-accent-red`), and per-character colors (`--color-finn`, `--color-ruby`, `--color-sage`).

**Typography tokens** — `--font-display` (Cinzel serif), `--font-body` (Nunito), `--font-mono` (JetBrains Mono).

**Easing tokens** — `--ease-out-expo` and `--ease-spring` for polished motion.

**Reset** — `box-sizing: border-box`, zero margin/padding globally, and `button` reset (`font-family: inherit; cursor: pointer; background: none; border: none`).

---

## Architecture Overview

```
Browser                               Server
───────                               ──────

preloadSession()   ──POST──>   /api/start-game
                   <──JSON──   { sessionId, token, encryptedTargets, decryptionParams }


[Player clicks image]
  ↓
  client hit detection
    decrypt polygon  (affine inverse)
    ray cast         (PNPOLY)
  ↓
  optimistic UI update  (instant)
  ↓
  verifyHitOnServer()  ──POST──>  /api/verify-hit  (fire & forget)
                                    session guard
                                    real polygon from DB
                                    ray cast server-side
                                    write Hit { verified }


[All targets found → phase = 'completed']
  ↓
  ScoreModal appears
  player enters name
  ↓
  form POST  ──────>  ?/submitScore
                        HMAC token verification
                        timing anti-cheat (min time, max time)
                        hit completeness check
                        write Score + update GameSession
                        redirect(303)  ──>  /leaderboard?rank=N&time=T
```

---

## What I've Learned

### SvelteKit & Svelte 5

- **Global CSS** belongs in `/src/app.css`, imported in the root `+layout.svelte`. Never put it in `/static/` — those files bypass Vite/PostCSS processing, breaking Tailwind.
- **`tick()`** (imported from `svelte`) returns a promise that resolves after Svelte has flushed all pending state changes to the DOM. Useful when you need to force a remount — e.g. `selectorOpen = false; await tick(); selectorOpen = true` guarantees the `{#if}` block is destroyed and recreated so CSS animations replay correctly.
- **`$derived` is writable in Svelte 5.25+** — you can temporarily override a derived value by reassigning it (e.g. `formResult = null`). Prior to 5.25 it was read-only.
- **`$state` + `$effect` to mirror a prop is an anti-pattern** — use `$derived` instead. The ESLint rule `svelte/prefer-writable-derived` enforces this.
- **For internal links**, use `resolve()` from `$app/paths` instead of `base` or plain strings (e.g. `href={resolve('/leaderboard')}`). This handles the base path correctly without deprecation warnings.

### Coordinate Systems

When handling mouse clicks on a game board, multiple coordinate spaces are in play:

- **Normalized image coordinates (0.0–1.0)** — click position as a fraction of the image dimensions. Used for hit detection and DB storage so results are screen-size independent.
- **Viewport-absolute pixels** — used for positioning UI feedback (e.g. a popup bubble) via `clientX`/`clientY`.
- **Board-relative pixels** — viewport pixels minus the board element's `getBoundingClientRect()` origin. Used for CSS `left`/`top` on `position: absolute` children of the board.

### CSS Animations & Transforms

- **`translate`, `rotate`, `scale` are standalone CSS properties** separate from `transform`. The browser composes them in the order `translate → rotate → scale → transform`. This means you can animate `translate` in a `@keyframes` without conflicting with `transform: translateY(...)` set by placement modifier classes — they run on completely separate tracks.
- **CSS custom properties inside `@keyframes`** are resolved once at the start of the animation, before modifier classes apply their overrides. Avoid relying on them for values that change per variant.
- **`pointer-events: none`** on a parent blocks hover and click events on all children. To make children interactive while keeping the parent non-blocking, set `pointer-events: auto` explicitly on the children.
- **CSS animation duration** — 150–200ms is the sweet spot for UI popups.

### Browser APIs

- **`requestAnimationFrame(callback)`** schedules a callback to run just before the browser paints the next frame (~60fps). It automatically pauses when the tab is hidden and never fires faster than the screen refresh rate. Returns a numeric ID used to cancel it via `cancelAnimationFrame(id)`.
- **Recursive rAF loop** — calling `requestAnimationFrame(fn)` inside `fn` itself creates a self-scheduling loop. Unlike true recursion, the call stack never grows — each invocation completes and returns before the browser calls it again next frame.
- **`requestAnimationFrame` vs `setInterval`** — rAF syncs with the display refresh rate, pauses on hidden tabs, and never accumulates. `setInterval` fires on a fixed clock regardless of rendering, can drift, and wastes CPU on background tabs.

### Prisma & Data Layer

- **Avoid `$transaction` for independent queries** — replace with `Promise.all` to avoid timeout errors and unnecessary locking.
- **Apply the standard singleton pattern** for the Prisma client.
- **Hidden form inputs submit values as strings** — use `z.coerce.number()` in Zod schemas when a number is expected (e.g. `durationMs`).

---

_2025 © Odin Project Assignment by [James Chen](https://github.com/jameschen215). All rights reserved._
