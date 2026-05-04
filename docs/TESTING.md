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

There is no Playwright, Cypress, or any browser automation in this project. End-to-end tests are out of scope for v1.

---

## What Is Covered

### In scope

| Area | Module(s) | Test strategy |
|---|---|---|
| Utility functions | `src/lib/utils/slugify.ts`, taxonomy helpers, markdown section extractors | Pure unit tests — no mocks needed |
| DB query layer | `src/lib/server/db/notes.ts` | Unit tests with mocked Drizzle client (`vi.mock`) |
| Embeddings module | `src/lib/server/embeddings.ts` | Mock OpenRouter HTTP calls; assert note/chunk embedding payload generation, endpoint usage, and response-shape validation |
| Chat module | `src/lib/server/chat.ts` | Mock semantic and lexical retrieval; assert parallel call dispatch, hybrid candidate fusion ordering, deduplication, 5-note cap, lexical-only note formatting, and compact prompt assembly |
| API route — chat | `src/routes/api/chat/+server.ts` | Import handler directly, call with mock `Request`; assert rate limiting, streaming response shape, confidence-gate fallback (no LLM call, canned SSE response on empty retrieval), and high-confidence path (context included in LLM prompt) |
| API route — admin note review | `src/routes/api/admin/notes/review/+server.ts` | Mock auth session and OpenRouter review adapter; assert payload validation, SSE response shape, and upstream 429/503 pass-through |
| Admin review client behavior | Admin new/edit review UI logic | Assert manual Review trigger builds `{ title, takeaway, body }` payload, stream state updates, and visible error handling on stream failure |
| Admin markdown live preview behavior | `MarkdownEditor` data-flow and markdown preview transform helpers | Unit-test typing-to-preview transform behavior (wiki-link resolution/missing refs, markdown structure output), and ensure preview transform failure does not block save/publish form actions |
| Auth guard | SvelteKit hooks or route guards for `/admin` | Assert unauthenticated requests receive a redirect (302) or 401 response, including nested admin pages such as `/admin/notes/[slug]/preview` |
| Rate limit logic | Chat quota utility (anonymous session cookie-based) | Pass mock session token/hash and mock store; test threshold, reset window, and cookie-missing behavior in isolation |

### Explicitly NOT covered

- End-to-end browser tests (Playwright / Cypress) — out of scope for v1
- Visual regression testing
- Load testing or stress testing
- Real OpenRouter API calls — always mocked in tests
- Real Neon PostgreSQL calls — always mocked or replaced with in-memory fixtures
- Svelte component rendering tests (no `@testing-library/svelte` in v1)

If a gap above becomes critical, revisit before adding the dependency — don't add test tooling speculatively.

---

## Test File Inventory

This table starts empty and is filled in as test files are added to the project. Add a row for every new `.test.ts` file when you create it.

| Test file | Module under test | What it covers |
|---|---|---|
| `src/lib/server/db/notes.test.ts` | `src/lib/server/db/notes.ts` | Mocked Drizzle coverage for note-level similarity, chunk replace/search helpers, and citation tracking |
| `src/lib/server/embeddings.test.ts` | `src/lib/server/embeddings.ts` | Mocked OpenRouter embedding requests, section/paragraph chunk ordering, metadata payload template stability, missing key handling, HTTP failure handling, and malformed payload rejection |
| `src/routes/api/chat/chat.test.ts` | `src/routes/api/chat/+server.ts` | Anonymous cookie issuance/reuse, malformed-cookie fallback, per-cookie quota isolation, DB-backed per-session quota enforcement, early 429 short-circuit (including limit+1), social-intent SSE path (no retrieval/LLM/citations), confidence-gate fallback (low-coverage returns SSE without LLM call, no citation recording), and high-confidence path (LLM called, context included in prompt) |
| `src/lib/utils/chat-format.test.ts` | `src/lib/utils/chat-format.ts` | Safe chat formatting for italics, local note links (`[[slug]]`, markdown links), HTML escaping, `isSafeNoteSlug` slug validation (safe patterns, uppercase rejection, special chars, empty string, leading hyphen), and related-notes footer rendering |
| `src/tests/auth-redirect.test.ts` | `src/hooks.server.ts`, `src/routes/signin/+page.server.ts` | `buildSigninRedirectUrl` pure helper, sign-in load function callbackUrl defaults and pass-through, empty/absent param fallback to /admin |
| `src/tests/api-admin-notes-review.test.ts` | `src/routes/api/admin/notes/review/+server.ts` | Auth guard (401), payload validation (400 for missing/invalid fields), SSE success path, upstream 429/503 pass-through, and service-error handling (502/503) |
| `src/lib/utils/note-review.test.ts` | `src/lib/utils/note-review.ts` | Review trigger payload POST shape, stream callback transitions (`onStart`/`onChunk`/`onComplete`), and explicit upstream 429/503 error handling |
| `src/lib/utils/markdown-preview.test.ts` | `src/lib/utils/markdown-preview.ts` | Wiki-link resolution (resolved/unresolved), inline media token rendering (`{{media ...}}` image/video embeds, including staged `blob:` URLs), GFM markdown structure output (headings, lists, emphasis, code, blockquotes, tables), fail-soft contract (ok:false on pipeline error, never throws), and `renderPreviewSync` variant |
| `src/lib/utils/inline-media.test.ts` | `src/lib/utils/inline-media.ts` | Inline media token parsing (`{{media ...}}`), invalid-token rejection, media-kind inference, and snippet generation for admin upload insertion |
| `src/lib/server/chat.test.ts` | `src/lib/server/chat.ts` | Parallel semantic + lexical retrieval, candidate fusion ordering (semantic-first then lexical fill), deduplication of overlapping slugs, per-note chunk grouping (cap 2), fused 5-note cap, lexical-only note formatting (title + takeaway), section heading inclusion/omission, slug/title inclusion, ranked citation slug order, empty-result handling, `hasSufficientCoverage` boundary cases (both-empty, one-empty, both-populated), `INSUFFICIENT_COVERAGE_RESPONSE` first-person voice contract, `buildFallbackResponse` (no notes, with notes footer, italic wrapping, unsafe slug filtering, all-unsafe fallback, digit-starting slug), and `citedNotes` population from semantic chunks and lexical notes |

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
