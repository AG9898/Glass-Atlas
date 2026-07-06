# Glass Atlas — Testing Guide

## Quick Start

Once the project is built, run tests with these commands:

```bash
npm test                # Vitest in watch mode (development)
npm run test:run        # Run once, exit (CI / pre-commit)
npm run test:coverage   # Generate coverage report
npm run lint            # TypeScript type-check + ESLint
npm run check           # SvelteKit sync + svelte-check for .svelte files
npm run build           # SvelteKit production build (smoke check)
```

All test commands assume dependencies are installed (`npm install`) and a `.env` file (or environment variables) is present for any build-time config. Tests themselves never read real environment secrets — everything external is mocked.

---

## Test Stack

| Layer | Tool | Purpose |
|---|---|---|
| Test runner | Vitest | Runs all unit and integration tests |
| Mocking | `vi.mock`, `vi.fn`, `vi.spyOn` | Isolate modules from external services |
| Coverage | Vitest built-in (`v8`) | Line/branch coverage reports |
| Type checking | `tsc --noEmit` (via `npm run lint`) + `svelte-check` (via `npm run check`) | Catches TypeScript and Svelte component errors before test run |
| HTTP mocking | `Request` constructor (Web API) | Simulate SvelteKit route handler calls |

There is no default Playwright, Cypress, or browser automation suite in this project. End-to-end tests are out of scope for v1 unless a dedicated visual or motion task adds targeted browser smoke coverage.

---

## What Is Covered

### In scope

| Area | Module(s) | Test strategy |
|---|---|---|
| Utility functions | `src/lib/utils/slugify.ts`, taxonomy helpers, markdown section extractors | Pure unit tests — no mocks needed |
| DB query layer | `src/lib/server/db/notes.ts` | Unit tests with mocked Drizzle client (`vi.mock`) |
| Embeddings module | `src/lib/server/embeddings.ts` | Mock OpenRouter HTTP calls; assert note/chunk embedding payload generation, endpoint usage, response-shape validation, and fail-soft reindex orchestration |
| Chat module | `src/lib/server/chat.ts` | Mock semantic and lexical retrieval; assert semantic query alias expansion, parallel call dispatch, hybrid candidate fusion ordering, deduplication, 5-note cap, lexical-only note formatting, confidence tiers, and compact prompt assembly |
| API route — chat | `src/routes/api/chat/+server.ts` | Import handler directly, call with mock `Request`; assert rate limiting, streaming response shape, low-confidence fallback (no LLM call), borderline limited-coverage LLM prompt, high-confidence path (context included in normal LLM prompt), and server-provided source metadata when retrieval yields citable notes |
| Chat source UI helpers | Chat formatting/source popup utilities | Unit-test that server-provided source titles, slugs, and snippets are escaped, linked safely, and hidden when no sources exist |
| Reader path helpers | `getRelatedNotes` (`src/lib/server/db/notes.ts`) plus `getBacklinks`/`getOutlinks` | Mock DB/retrieval helpers; assert `getRelatedNotes` orders published notes by cosine distance to the source note's own embedding, excludes the source note, excludes unpublished notes, and returns `[]` when the source has no embedding, the source does not exist, or `limit` is zero; assert public note detail paths include published semantic related notes plus backlinks/outlinks without unresolved/private notes |
| API route — admin note review | `src/routes/api/admin/notes/review/+server.ts` | Mock auth session and OpenRouter review adapter; assert payload validation, SSE response shape, and upstream 429/503 pass-through |
| Draft-review scorer | `src/lib/server/ai/draft-review.ts` | Mock OpenRouter; assert the prompt embeds the `docs/VOICE.md` rubric, the returned score object is well-formed (0–100 + per-dimension breakdown + flagged lines), malformed model output is handled gracefully, and the model id comes from `OPENROUTER_DRAFT_REVIEW_MODEL` |
| Agent note write script | `scripts/create-note.js` | Mock the DB helpers; assert `status` is hard-forced to `draft` regardless of input, slug is generated via `slugify`, and persistence routes through `createNote()` + `reindexNoteAfterSave()` (links + embedding + chunks) |
| Admin review client behavior | Admin new/edit review UI logic | Assert manual Review trigger builds `{ title, takeaway, body }` payload, stream state updates, and visible error handling on stream failure |
| Admin markdown live preview behavior | `MarkdownEditor` data-flow and markdown preview transform helpers | Unit-test typing-to-preview transform behavior (wiki-link resolution/missing refs, markdown structure output), and ensure preview transform failure does not block save/publish form actions |
| Admin embedding refresh behavior | Admin note create/edit server actions, embedding helpers, and semantic index display mapper | Mock embedding calls; assert successful saves replace vectors, failed refreshes preserve previous embeddings/chunks, stale-index metadata is recorded, and server-shaped display state distinguishes current/pending/stale/failed admin warnings |
| Admin editor quality warnings | Quality warning mapper/helper | Pure utility tests for stale semantic index, missing takeaway, no internal links, and weak-title heuristic; assert warnings are advisory and do not affect action payloads |
| Public Markdown technical blocks | Server markdown renderer and client controls | Unit-test Mermaid render/fallback behavior, code block label metadata, and fail-soft behavior so unsupported diagrams never 500 a note page |
| Public motion foundation | `src/lib/motion/**` | Unit-test reduced-motion defaults and SSR-safe GSAP loading; manually smoke-test visible page choreography when later tasks add animations |
| Public smooth scroll layer | `src/lib/motion/smooth-scroll.ts` | Pure unit tests for public/admin route gating and conservative ScrollSmoother config; manual browser smoke checks for native scroll behaviors |
| Landing page motion | `/` page choreography | No component-level browser automation in v1; verify with `npm run check` plus manual browser smoke for hero/chat/stats/latest-note reveals and reduced-motion behavior |
| Wave-grid 3D motion asset (loader/spinner) | `src/lib/motion/wave-grid.ts`, `src/lib/motion/wave-grid-engine.ts`, `src/lib/components/WaveGridLoader.svelte` | Pure unit tests for reduced-motion gating, CSS-custom-property palette resolution (including its non-browser fallback), variant config selection (`getWaveGridConfig`), and the engine's grid-segment geometry math (segment counts, explicit row/column subsets, width/depth bounds) for both the overlay and compact configs; the actual Three.js scene/canvas has no component-rendering test and was instead verified with CDP-driven headless-Chrome browser smoke checks across all three mount points (see below) |
| Notes browse/detail motion | `/notes`, `/notes/[slug]` page choreography | No component-level browser automation in v1; verify with `npm run check` plus manual browser smoke for notes row load/filter transitions, detail header/media reveal, first-block article reveal, route cleanup, and reduced-motion behavior |
| Public route transition overlay | `src/lib/motion/page-transition.ts`, `src/lib/components/PageTransitionOverlay.svelte` | Pure unit tests for route gating (`isPublicRouteTransitionPath`) and skip logic (`shouldSkipPageTransition`) plus the cover/reveal timing budget; no component-level browser automation in v1 — manually smoke-test the wipe overlay across public route changes, reduced-motion instant navigation, and coexistence with the smooth-scroll wrapper |
| Initial-load boot splash | `src/lib/components/InitialLoadScreen.svelte` | No component-level browser automation in v1; manually smoke-test that it mounts a wave-grid canvas on hard load, is gated to public routes only, fades out after fonts-ready/minimum-duration, and renders nothing under reduced motion |
| How-it-works route | `/how-it-works` page | Smoke-test route load/render boundaries if server data is added; otherwise rely on lint/check plus manual visual review |
| Auth guard | SvelteKit hooks or route guards for `/admin` | Assert unauthenticated requests receive a redirect (302) or 401 response, including nested admin pages such as `/admin/notes/[slug]/preview` |
| Rate limit logic | Chat quota utility (anonymous session cookie-based) | Pass mock session token/hash and mock store; test threshold, reset window, and cookie-missing behavior in isolation |

### Explicitly NOT covered

- End-to-end browser tests (Playwright / Cypress) — out of scope for v1 unless a dedicated visual/motion task adds browser automation for that task
- Visual regression testing
- Load testing or stress testing
- Real OpenRouter API calls — always mocked in tests
- Real Neon PostgreSQL calls — always mocked or replaced with in-memory fixtures
- Svelte component rendering tests (no `@testing-library/svelte` in v1)

If a gap above becomes critical, revisit before adding the dependency — don't add test tooling speculatively.

### Motion QA

Public motion work must include manual browser smoke verification in addition to `npm run test:run` and `npm run lint`.

For GSAP/ScrollTrigger/ScrollSmoother changes, verify:

- Public routes still render with JavaScript disabled or before client motion initializes.
- `prefers-reduced-motion: reduce` disables smooth scroll and spatial choreography.
- Keyboard scrolling, tab focus, focus outlines, anchor links, browser find, and route navigation remain usable.
- Scroll-triggered animations clean up after route changes and do not duplicate after navigating back and forth.
- Dynamic content changes that affect layout call `ScrollTrigger.refresh()` or otherwise avoid stale trigger positions.

For generated loading/transition assets, verify:

- Assets match the token palette and style guide constraints in both light and dark mode.
- Transitions do not trap interaction or delay page readability after navigation settles.
- Static or near-static fallbacks exist for reduced-motion users.

For real-time 3D assets, verify:

- The scene is nonblank on desktop and mobile viewport sizes.
- The frame is correctly composed, does not overlap critical text, and remains readable in light and dark mode.
- Reduced-motion fallback works.
- If a task adds Three.js, include a browser-level smoke check for rendered canvas pixels and responsive framing as part of that task's verification plan.

`POLISH-07F` (`WaveGridField.svelte`, since reworked into `WaveGridLoader.svelte`) verification method, useful for later 3D-asset tasks in this repo: this project has no `.env`/`DATABASE_URL` configured in the agent sandbox, and every server-load-bearing public route (including `/`) 500s under `npm run dev` without it (see `AGENTS.md`/`CLAUDE.md` discoveries). To smoke-test the component itself, a temporary route with no server load (e.g. `src/routes/__smoke-<name>/+page.svelte` rendering only the component in isolation) was added, exercised with `npm run dev`, and deleted before committing — never leave a temp smoke route in the tree. Headless Chrome (`google-chrome --headless=new`) does not enable WebGL by default even with a GPU present in the container; add `--use-angle=swiftshader --enable-unsafe-swiftshader` to get a real (software) WebGL context, otherwise the canvas silently never reaches its "ready" state and only the static fallback ever paints, which can look like a passing screenshot for the wrong reason. `--force-prefers-reduced-motion` is a genuine Chromium flag and was used to confirm the reduced-motion path never even adds a `<canvas>` element to the DOM (checked via `--dump-dom`), not just that it's hidden by CSS. Dark mode was checked by toggling the `.dark` class on `<html>` from the smoke route's own `onMount` (reading a `?dark=1` query param) since there is no Playwright/CDP harness in this repo to drive the real theme toggle.

`POLISH-07G` final integration QA pass method, useful for future browser-behavior verification in this repo: `--dump-dom` only captures a single static snapshot and cannot await in-page JS state (a GSAP tween's "from" state can be caught mid-flight, timeline completion can't be confirmed, and SPA client-side navigation can't be driven at all). Instead, this pass drove headless Chrome directly over the Chrome DevTools Protocol from a small Node script: launch `google-chrome --headless=new --remote-debugging-port=<port> --user-data-dir=<scratch dir>` (plus the same `--use-angle=swiftshader --enable-unsafe-swiftshader` / `--force-prefers-reduced-motion` / `Emulation.setDeviceMetricsOverride` flags as needed), fetch the page target's `webSocketDebuggerUrl` from `GET http://127.0.0.1:<port>/json/list` (not `/json/version`, which returns the browser-level target and rejects `Runtime.evaluate` with "wasn't found"), open it with Node's built-in global `WebSocket`, and send `Page.enable`/`Runtime.enable`/`Page.navigate`/`Runtime.evaluate` (`awaitPromise: true` so an `async` IIFE expression can `setTimeout`-wait for a tween or a client-side navigation to settle before returning a value) plus `Input.dispatchKeyEvent` for real `Tab`-key focus tests. `Runtime.consoleAPICalled`/`Runtime.exceptionThrown` event listeners registered up front give a genuine page-console error/warning feed for the whole session (`--enable-logging=stderr` only surfaces Chromium-internal noise, not page JS console output, in `--dump-dom` mode). This was used to confirm: motion-QA-fixture-backed real navigation between `/`, `/notes`, and `/notes/[slug]` (see below) with `ScrollTrigger.getAll().length`/`ScrollSmoother.get()` instance counts staying stable — not growing — across repeated back/forward and click-driven SPA navigation loops; the route-transition overlay's `clip-path` settling back to fully hidden after each navigation; reduced-motion hero content reaching `opacity: 1` immediately with no `<canvas>` mounted; and real `Tab`-key focus producing a visible outline. To read `ScrollTrigger`/`ScrollSmoother` singleton state from outside the app's module graph, a temporary debug hook (`window.__motionDebug = { gsap, ScrollTrigger, ScrollSmoother }`, set inside `loadPublicGsap()` in `src/lib/motion/gsap.ts`) was added for the duration of the QA pass and reverted via `git checkout` before running final verification/build — like the `__smoke-*` route pattern above, never leave a debug hook like this in the tree.

`POLISH-07H` (wave-grid loader rework: transition overlay + `InitialLoadScreen` + Chat inline spinner) verification method: a gitignored `.env.local` was present in this session (see `AGENTS.md`/`CLAUDE.md` discoveries — check for one with `git check-ignore -v .env.local` before assuming DB-backed routes are unreachable), so `npm run dev` served real public routes with a working `DATABASE_URL` and no temporary smoke route was needed. Using the same CDP-driven headless Chrome technique as `POLISH-07G`: navigated to `/` and confirmed at `t=600ms` that `.initial-load-screen` was present with a mounted `<canvas>` and that `.wave-band` no longer exists in the DOM; confirmed the splash's DOM node was gone by `t=2000ms` (fade + minimum-display window elapsed); clicked a same-origin `<a href="/notes">` link via `Runtime.evaluate` and confirmed `.page-transition-overlay .wave-grid-loader`/`<canvas>` were present at `t=90ms` into the transition and gone again at `t=990ms` after the reveal tween completed; and, on a fresh `/` load (after letting the initial splash fully fade), filled `#chat-input`, called `form.requestSubmit()`, and confirmed `.ga-chat__searching-spinner .wave-grid-loader` was mounted within 150ms of submission.

`POLISH-07G` also needed real data on `/`, `/notes`, and `/notes/[slug]` (all of which 500 without a working `DATABASE_URL`, per the note above) to drive actual cross-page navigation rather than an isolated single-component smoke route. A temporary in-memory fixture shim (three fixture notes with a resolvable `[[wiki-link]]` pair, gated behind a local `const MOTION_QA_FIXTURES = true` short-circuit added to the top of each read-only helper — `listNotes`, `getNoteBySlug`, `getBacklinks`, `getOutlinks`, `getRelatedNotes`, `getTotalCitations` — in `src/lib/server/db/notes.ts`) let those routes render and navigate without ever touching the real DB connection, then was reverted via `git checkout` before running final verification/build. This sandbox's `.env.local` (gitignored, not part of the repo) happened to already contain a real `DATABASE_URL`; the fixture shim was still used deliberately to guarantee zero reads/writes against that real database during QA. Check for `.env.local` specifically (not just `.env`) before assuming no DB is reachable in a given sandbox — `npm run dev` and Vite both auto-load it, but `npm run test:run` does not, which is why unit tests still log "DATABASE_URL is not set" regardless.

---

## Test File Inventory

This table starts empty and is filled in as test files are added to the project. Add a row for every new `.test.ts` file when you create it.

| Test file | Module under test | What it covers |
|---|---|---|
| `src/lib/server/db/notes.test.ts` | `src/lib/server/db/notes.ts` | Mocked Drizzle coverage for note-level similarity, semantic related-notes (`getRelatedNotes`), chunk replace/search helpers, and citation tracking |
| `src/lib/server/embeddings.test.ts` | `src/lib/server/embeddings.ts` | Mocked OpenRouter embedding requests, section/paragraph chunk ordering, metadata payload template stability, missing key handling, HTTP failure handling, malformed payload rejection, and `reindexNoteAfterSave()` success/note-failure/chunk-failure preservation behavior |
| `src/lib/server/admin/semantic-index-display.test.ts` | `src/lib/server/admin/semantic-index-display.ts` | Pure mapping coverage for current, pending, stale timestamp, missing source timestamp, and failed semantic index display state used by admin list/editor warnings |
| `src/lib/server/admin/quality-warnings.test.ts` | `src/lib/server/admin/quality-warnings.ts` | Pure mapping coverage for `getNoteQualityWarnings()` (stale/failed/pending semantic index reuse via `getSemanticIndexDisplay()`, missing/blank takeaway, zero parsed wiki-links, weak-title heuristic, multi-warning ordering) and the deterministic `isWeakTitle()` heuristic (blank, too-short, single-word, placeholder-pattern, and accepted-title cases), exercised through the server module's re-exports of the client-safe helper |
| `src/lib/utils/quality-warnings.test.ts` | `src/lib/utils/quality-warnings.ts` | Pure, client-safe coverage for `getContentQualityWarnings()` (missing/blank takeaway, zero parsed wiki-links, weak-title heuristic, order-stable multi-warning output, live/blank-form reactivity) and `isWeakTitle()` (blank, too-short, placeholder-pattern, and accepted-title cases) |
| `src/routes/api/chat/chat.test.ts` | `src/routes/api/chat/+server.ts` | Anonymous cookie issuance/reuse, malformed-cookie fallback, per-cookie quota isolation, DB-backed per-session quota enforcement, early 429 short-circuit (including limit+1), social-intent SSE path (no retrieval/LLM/citations, templated non-factual replies), confidence-gate fallback (low-coverage returns SSE without LLM call, no citation recording), borderline limited-coverage prompt shape, high-confidence path (LLM called, context included in normal prompt), and the source-metadata contract (`buildChatSources` called with `citedNotes` only on the citable LLM path, a trailing `sources` SSE event appended when sources exist, the event omitted when `buildChatSources` returns none, and `buildChatSources` never called on the low-confidence fallback or social-intent lanes) |
| `src/lib/utils/chat-format.test.ts` | `src/lib/utils/chat-format.ts` | Safe chat formatting for italics, local note links (`[[slug]]`, markdown links), HTML escaping, `isSafeNoteSlug` slug validation (safe patterns, uppercase rejection, special chars, empty string, leading hyphen), related-notes footer rendering, `buildSourceSnippet` (whitespace collapsing, trimming, empty-input handling, default/custom-length truncation with ellipsis, and HTML-escaping after truncation), and `parseChatSourcesEvent` (valid sources event, empty sources array, `null` for non-sources token-chunk payloads, `null` for non-object/non-array `sources`, and dropping individual entries with an unsafe slug, missing/empty title, missing/empty snippet, or a non-object entry) |
| `src/tests/auth-redirect.test.ts` | `src/hooks.server.ts`, `src/routes/signin/+page.server.ts` | `buildSigninRedirectUrl` pure helper, sign-in load function callbackUrl defaults and pass-through, empty/absent param fallback to /admin |
| `src/tests/api-admin-notes-review.test.ts` | `src/routes/api/admin/notes/review/+server.ts` | Auth guard (401), payload validation (400 for missing/invalid fields), SSE success path, upstream 429/503 pass-through, and service-error handling (502/503) |
| `src/lib/utils/note-review.test.ts` | `src/lib/utils/note-review.ts` | Review trigger payload POST shape, stream callback transitions (`onStart`/`onChunk`/`onComplete`), and explicit upstream 429/503 error handling |
| `src/lib/utils/markdown-preview.test.ts` | `src/lib/utils/markdown-preview.ts` | Wiki-link resolution (resolved/unresolved), inline media token rendering (`{{media ...}}` image/video embeds, including staged `blob:` URLs), GFM markdown structure output (headings, lists, emphasis, code, blockquotes, tables), fail-soft contract (ok:false on pipeline error, never throws), and `renderPreviewSync` variant |
| `src/lib/utils/inline-media.test.ts` | `src/lib/utils/inline-media.ts` | Inline media token parsing (`{{media ...}}`), invalid-token rejection, media-kind inference, and snippet generation for admin upload insertion |
| `src/lib/server/chat.test.ts` | `src/lib/server/chat.ts` | Semantic query alias expansion, parallel semantic + lexical retrieval, candidate fusion ordering (semantic-first then lexical fill), deduplication of overlapping slugs, per-note chunk grouping (cap 2), fused 5-note cap, lexical-only note formatting (title + takeaway), section heading inclusion/omission, slug/title inclusion, ranked citation slug order, empty-result handling, confidence tier boundary cases, `INSUFFICIENT_COVERAGE_RESPONSE` first-person voice contract, `buildFallbackResponse` (no notes, with notes footer, italic wrapping, unsafe slug filtering, all-unsafe fallback, digit-starting slug), `citedNotes` population from semantic chunks and lexical notes (including the derived `snippet` field and its title fallback when a lexical note has no takeaway), and `buildChatSources` (safe-slug passthrough, unsafe-slug filtering, empty-snippet filtering, empty-input handling) |
| `src/lib/server/ai/draft-review.test.ts` | `src/lib/server/ai/draft-review.ts` | Mocked OpenRouter draft-review coverage for `docs/VOICE.md` rubric inclusion, score-shape normalization, model selection from `OPENROUTER_DRAFT_REVIEW_MODEL`, and malformed/non-conforming model output fallback |
| `src/tests/create-note-script.test.ts` | `scripts/create-note.js` | Agent draft writer coverage for draft-status forcing, slug generation/collision handling, helper invocation (`createNote` + `reindexNoteAfterSave`), required env validation, and file argument parsing |
| `src/lib/server/markdown.test.ts` | `src/lib/server/markdown.ts` | Public Markdown renderer coverage: valid Mermaid fences render inline SVG (`mermaid-diagram` wrapper, `<svg` present); invalid or empty Mermaid fences fall back to the readable `unhighlighted-code-source` treatment instead of throwing; plain-text fenced blocks fall back to renderable unhighlighted code instead of failing legacy Shiki highlighting; code block controls — `.ga-code-block` wrapper markup with a language label when known and omitted when unknown, a `.ga-code-block__filename` label when the fence meta carries `filename="..."`, `data-role="copy"`/`data-role="wrap-toggle"` control hooks present on highlighted, plaintext-fallback, and failed-Mermaid-fallback blocks alike, and no `.ga-code-block` wrapper applied to a successfully rendered Mermaid diagram |
| `src/lib/motion/preferences.test.ts` | `src/lib/motion/**` | Public motion foundation coverage for reduced-motion defaults, spatial-motion gating, watcher initial state, canonical media query usage, and SSR-safe GSAP loader behavior |
| `src/lib/motion/smooth-scroll.test.ts` | `src/lib/motion/smooth-scroll.ts` | Pure coverage for public smooth-scroll route eligibility, admin/auth/API exclusion, and conservative ScrollSmoother config (`effects: false`, no touch smoothing, no `normalizeScroll`) |
| `src/lib/motion/page-transition.test.ts` | `src/lib/motion/page-transition.ts` | Pure coverage for public route transition gating (`isPublicRouteTransitionPath`, sharing the smooth-scroll route set), `shouldSkipPageTransition` (same-pathname no-op navigations, admin-to-admin/API-to-API skips, public-origin/public-destination plays, null-destination handling), and the cover+reveal duration budget staying within the GSAP.md 300ms–600ms page-transition window |
| `src/lib/motion/wave-grid.test.ts` | `src/lib/motion/wave-grid.ts` | Pure coverage for the wave-grid motion asset: reduced-motion gating reuses `canUseSpatialMotion`/`prefersReducedMotion` (`shouldUseWaveGridMotion` tracks all three states); CSS custom-property palette resolution (`resolveWaveGridPalette`) reads and trims injected computed-style values, falls back per-token when a property is empty, and falls back to the full light-mode palette with no injected document/style reader (SSR-safe default); `getWaveGridConfig(variant)` returns the correct config object for `'overlay'`/`'compact'` |
| `src/lib/motion/wave-grid-engine.test.ts` | `src/lib/motion/wave-grid-engine.ts` | Pure coverage for `createGridSegments()` geometry math (no `three` import needed): segment counts match the expected row/column × subdivision product for both the overlay and compact configs, explicit row/column subsets (used by the emphasis/accent layers) produce the expected count, and every generated point stays within the configured width/depth bounds |

Naming rules that govern where each file lives are in the next section.

---

## Writing New Tests — Rules and Patterns

### File naming and location

- Collocate test files next to the module they test: `src/lib/server/db/notes.test.ts` lives beside `notes.ts`.
- Group route and cross-cutting integration tests under `src/tests/`: e.g. `src/tests/api-chat.test.ts`.
- Test file name mirrors the module name: `slugify.test.ts`, `embeddings.test.ts`, `chat.test.ts`.
- All test files use the `.test.ts` extension (not `.spec.ts`).

### Pure utility functions

No mocks required. Import the function and assert on its output directly.

```ts
import { slugify } from '$lib/utils/slugify';

test('converts spaces to hyphens and lowercases', () => {
  expect(slugify('Hello World')).toBe('hello-world');
});
```

### Mocking the Drizzle DB client

Never import the real Neon client in tests. Mock the entire DB module at the top of the test file.

```ts
import { vi, expect, test, beforeEach } from 'vitest';
import { getNoteBySlug } from '$lib/server/db/notes';

vi.mock('$lib/server/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ id: 1, slug: 'test-note', title: 'Test' }]),
  },
}));

test('getNoteBySlug returns the matching note', async () => {
  const note = await getNoteBySlug('test-note');
  expect(note?.slug).toBe('test-note');
});
```

Chain the Drizzle builder methods on the mock object to match how the real client is called.

### Mocking OpenRouter

Mock the `fetch` global (or the wrapper module) so tests never hit the real API.

```ts
import { vi, expect, test } from 'vitest';
import { embedText } from '$lib/server/embeddings';

vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
  new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }] }), { status: 200 })
));

test('embedText calls the correct endpoint and returns a vector', async () => {
  const result = await embedText('some text');
  expect(result).toHaveLength(3);
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('openrouter.ai'),
    expect.objectContaining({ method: 'POST' })
  );
});
```

Restore stubs after each test with `vi.restoreAllMocks()` in `afterEach` or via Vitest config (`restoreMocks: true`).

### Testing SvelteKit route handlers

Import the handler function directly from the `+server.ts` file and call it with a constructed `Request`. SvelteKit server routes export named functions (`GET`, `POST`, etc.) that accept a `RequestEvent`-like object.

```ts
import { POST } from '$routes/api/chat/+server';

test('POST /api/chat returns a ReadableStream', async () => {
  const request = new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'hello' }),
  });

  const response = await POST({ request } as any);

  expect(response.status).toBe(200);
  expect(response.body).toBeInstanceOf(ReadableStream);
});
```

For the streaming response, asserting that `response.body` is a `ReadableStream` and that the first chunk arrives is sufficient — do not consume the entire stream in tests.

### Testing auth guards

Mock the Auth.js session helper to return `null` (unauthenticated) and assert the handler returns a redirect or 401.

```ts
import { vi, expect, test } from 'vitest';
import { GET } from '$routes/admin/+page.server';

vi.mock('@auth/sveltekit', () => ({
  getServerSession: vi.fn().mockResolvedValue(null),
}));

test('unauthenticated GET /admin redirects to login', async () => {
  const response = await GET({ request: new Request('http://localhost/admin') } as any);
  expect(response.status).toBe(302);
  expect(response.headers.get('location')).toContain('/login');
});
```

### Testing admin split-pane live preview

Given the no-browser-test baseline, keep live-preview verification at helper/module boundaries:

- Extract preview transforms into testable units (for example wiki-link replacement + markdown-to-HTML conversion helper).
- Assert resolved `[[slug]]` produces note links and unresolved wiki-links render the missing-reference treatment.
- Assert markdown structures used in notes (headings, lists, emphasis, code fences, blockquotes, tables) produce stable HTML output in preview.
- Assert inline media tokens (`{{media ...}}`) render deterministic figure/img/video HTML in preview, including staged `blob:` sources generated before create-submit upload.
- Assert preview-transform exceptions fail soft (preview error state) without mutating `body` state and without blocking form submits in route actions.

Manual smoke verification is still required in local dev for typing latency and visual sync between editor and preview panes.

### Testing chat source transparency

- Keep source payload tests at the server/helper boundary. Assert source metadata is derived from retrieved note candidates, not from LLM output. Covered today by `buildChatSources` and `citedNotes`/`snippet` tests in `src/lib/server/chat.test.ts`, the SSE `sources`-event tests in `src/routes/api/chat/chat.test.ts`, and the `buildSourceSnippet` tests in `src/lib/utils/chat-format.test.ts`.
- Assert unsafe slugs are dropped or escaped using the same slug-safety rules as chat links. On the client, `parseChatSourcesEvent` (`src/lib/utils/chat-format.ts`) re-validates the wire payload with the same `isSafeNoteSlug` rule plus non-empty title/snippet checks before `Chat.svelte` ever attaches it to a message — covered by `src/lib/utils/chat-format.test.ts`.
- "Assistant messages without source metadata do not render an empty source control" is enforced at the Chat.svelte template boundary (`{#if message.sources && message.sources.length > 0}`) and is not independently unit-tested — this project has no Svelte component rendering tests (see "Explicitly NOT covered" above). `parseChatSourcesEvent` returning `null` for any non-sources SSE event (token chunks, `[DONE]`) is what keeps a message's `sources` field `undefined` by default; that contract is unit-tested. Verify the rendered popup (trigger visibility, popup content, hidden-when-absent) with manual desktop/mobile smoke checks in local dev.
- Keep source snippets short in fixtures so tests verify truncation/escaping behavior without depending on full note bodies.

### Testing reader paths and quality warnings

- Test semantic related-note helpers with mocked retrieval/DB results and assert unpublished notes are excluded from public routes.
- Test backlinks/outlinks through query helpers rather than route-local body scans.
- Test editor quality warnings as pure mapping logic where possible: stale index display, blank takeaway, zero parsed wiki-links, and weak-title heuristic.
- Verify warning presence does not change save/publish form action availability.

### Testing Mermaid and code block controls

- Mermaid rendering has unit coverage in `src/lib/server/markdown.test.ts`, calling the real `renderMarkdown()` (no mocking of `mermaid` or `jsdom` — the renderer's own DOM shimming makes it callable directly in Vitest's default `node` environment): a valid flowchart resolves to HTML containing `mermaid-diagram` and `<svg`; invalid syntax and empty diagram source both resolve to the `unhighlighted-code-source`/`data-language="mermaid"` fallback instead of throwing.
- `renderMermaidToSvg()` itself (`src/lib/server/mermaid-render.ts`) is exercised indirectly through those `markdown.test.ts` cases; it has no separate test file today. If it grows additional branches (e.g. diagram-type-specific config), add direct unit coverage there.
- Code block controls (`PUBLIC-05B`) are tested at the server-render boundary in `src/lib/server/markdown.test.ts`, calling the real `renderMarkdown()`: a `.ga-code-block` wrapper with header/controls appears around highlighted fences, plaintext-fallback fences, and failed-Mermaid-fallback fences alike; the language label renders (uppercased) only when a language is known and is omitted for a bare ` ``` ` fence with no info string; a `filename="..."` fence-meta attribute produces a `.ga-code-block__filename` label without leaking into the rendered code text; `data-role="copy"`/`data-role="wrap-toggle"` hooks are present on every wrapped block; and a successfully rendered Mermaid diagram (`.mermaid-diagram`) is not wrapped in `.ga-code-block`.
- Component-level browser automation remains out of scope; manual local smoke checks are required for the actual copy-to-clipboard/wrap-toggle *client behavior* (event delegation wired up in `NoteDetail.svelte`'s `$effect`, not covered by any test — this project has no Svelte component rendering tests) and for diagram layout fidelity (server-side diagram layout uses patched jsdom SVG measurement stand-ins and is approximate, not pixel-perfect).

### Testing rate limiting

Rate limit persistence is tested through `consumeChatRateLimit()` in `src/lib/server/db/notes.test.ts`. Mock Drizzle write chains and assert allowed/blocked behavior, window resets, and input validation (`maxMessages`, `windowMs`).

For `POST /api/chat`, add route-level tests for:
- first request without a cookie sets the anonymous chat-session cookie and succeeds
- subsequent requests with the same cookie share the same quota counter across refresh
- a different cookie gets an independent quota counter
- malformed/missing cookie fallback behavior (issue new cookie and start a fresh counter)
- `429` on request `limit + 1` within the same quota window

### General rules

- Every `vi.mock` call must be at the top of the file, outside any `test` block.
- Use `beforeEach(() => vi.clearAllMocks())` to reset call counts between tests.
- Do not `console.log` in tests — use `expect` assertions.
- A test that passes without assertions is a false positive. Always have at least one `expect`.
- Keep each test focused on one behaviour. Prefer many small tests over one large test with many assertions.
- Test file names must not be imported by the production build — Vitest's `include` glob handles this, but do not re-export test utilities from `src/lib/`.

---

## Adding a New Test File

Follow these steps every time you add a test file.

1. Identify the module you are testing and decide on the file location (collocated or `src/tests/`).
2. Create the `.test.ts` file next to the module or under `src/tests/`.
3. Add `import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'` at the top.
4. Add any `vi.mock(...)` calls immediately after the imports, before any `describe` or `test` blocks.
5. Add `beforeEach(() => vi.clearAllMocks())` inside each `describe` block that uses mocks.
6. Write tests following the patterns in the section above for the relevant module type (utility, DB, OpenRouter, route handler, auth guard).
7. Run `npm run test:run` and confirm the new tests pass and no existing tests regress.
8. Add a row to the Test File Inventory table in this document: file path, module under test, and a one-line description of what it covers.
9. If you introduce a new mock pattern not covered above, document it in the Writing New Tests section before committing.
