# Glass Atlas — Conventions

This document is the authoritative style and architecture guide for the Glass Atlas codebase. All contributors and AI agents must follow these rules. Update this file whenever behavior, interfaces, or invariants change.

---

## Universal Rules

- TypeScript strict mode is on everywhere. No `any`, no `// @ts-ignore`.
- All secrets live in environment variables. Never commit `.env` files or API keys.
- Run `vitest` before marking any task done.
- Update `docs/` when you change behavior, a public interface, or an invariant.
- Use `bits-ui` as the default source of interactive UI primitives. Build custom interaction widgets only when no suitable Bits primitive exists.
- Use `GSAP` for advanced motion orchestration; use CSS/Svelte-native transitions for simple state changes.
- Prefer explicit over clever. Readable code beats compact code.
- One concern per file. Keep files short and focused.

---

## SvelteKit + Svelte 5

See also:

- [bits-ui.md](bits-ui.md)
- [GSAP.md](GSAP.md)
- [styleguide.md](styleguide.md)

### Language & Types

- Use Svelte 5 runes everywhere. Never use legacy `$:` reactive declarations or `export let` for props in new components.
  - State: `let count = $state(0)`
  - Derived: `let doubled = $derived(count * 2)`
  - Side effects: `$effect(() => { ... })`
  - Props: `let { title, slug }: { title: string; slug: string } = $props()`
- All `.svelte` files must have a `<script lang="ts">` block.
- All TypeScript types and interfaces use PascalCase: `Note`, `ChatMessage`, `EmbeddingResult`.
- Constants use UPPER_SNAKE_CASE: `MAX_CONTEXT_NOTES`, `RATE_LIMIT_WINDOW_MS`.
- Never use `object`, `Function`, or untyped array literals as types.
- Prefer `type` over `interface` for plain data shapes; use `interface` when you need declaration merging (e.g., `App.Locals`).

### File Organization

```
src/
  lib/
    server/            — server-only modules (never imported client-side)
      db/
        schema.ts      — all Drizzle table definitions
        index.ts       — Neon DB connection export
        notes.ts       — note query helpers
      ai/
        openrouter.ts  — OpenRouter adapter (OpenAI-compatible interface)
      embeddings.ts    — embed on note create/update
      chat.ts          — embedding search + prompt assembly
      personality.ts   — personality block (source of truth)
    components/
      ui/
        Button.svelte
        Dialog.svelte
        Input.svelte
        Select.svelte
        index.ts
      NoteCard.svelte
      Chat.svelte
    utils/
      slugify.ts
      note-taxonomy.ts    — canonical category list
      wiki-links.ts       — parseWikiLinks, renderWikiLinks (client-safe, server-safe)
      markdown-preview.ts — renderPreview / renderPreviewSync (client-safe preview transform)
  routes/
    +page.svelte                      — landing
    notes/
      +page.svelte                    — browse/filter
      [slug]/+page.svelte             — note detail
    admin/
      +page.svelte                    — dashboard
      notes/
        new/+page.svelte
        [slug]/edit/+page.svelte
    api/
      chat/+server.ts                 — public, rate-limited, streaming SSE
  hooks.server.ts                     — Auth.js middleware + admin route guard
```

### Naming

| Thing | Convention | Example |
|---|---|---|
| Svelte components | PascalCase | `NoteCard.svelte`, `Chat.svelte` |
| Server modules | camelCase | `notes.ts`, `embeddings.ts`, `openrouter.ts` |
| Route files | SvelteKit conventions | `+page.svelte`, `+server.ts`, `+page.server.ts` |
| TypeScript types | PascalCase | `Note`, `ChatMessage` |
| Constants | UPPER_SNAKE_CASE | `MAX_CONTEXT_NOTES` |
| DB columns | snake_case | `created_at`, `note_id` |
| URL slugs | kebab-case, auto-generated | `stoic-resilience` |

### Patterns

**Server load functions** — always check the session before returning protected data:

```ts
// src/routes/admin/+page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.session) throw redirect(302, '/');
  return { notes: await getNotes() };
};
```

**Form actions** — use SvelteKit `actions` in `+page.server.ts` for mutations. Never call the DB from a `+page.svelte` script block.

**API endpoints** — typed request/response, serialize explicitly:

```ts
// Generic admin API endpoint pattern — auth check first, serialize explicitly, never raw ORM
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.session) return json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const note = await createNote(body);
  return json({ id: note.id, slug: note.slug }); // serialize — never return raw ORM object
};
```

**Streaming chat endpoint** — return a `ReadableStream` directly, never buffer:

```ts
// src/routes/api/chat/+server.ts
export const POST: RequestHandler = async ({ request }) => {
  const stream = await buildChatStream(await request.json());
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
};
```

**Client-side streaming** — consume SSE in a Svelte component using `fetch` + `ReadableStream`, not `EventSource` (POST body required):

```svelte
<script lang="ts">
  let reply = $state('');

  async function send(message: string) {
    const res = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ message }) });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      reply += decoder.decode(value);
    }
  }
</script>
```

**Auth session** — read from `event.locals.session` (set by `hooks.server.ts`). Never read cookies manually in load functions or endpoints.

**Post-sign-in redirect** — the admin guard in `hooks.server.ts` redirects unauthenticated `/admin` visits to `/auth/signin?callbackUrl=<encoded-path>`. The custom sign-in page at `src/routes/auth/signin/` reads `callbackUrl` from the query string (defaulting to `/admin`) and passes it as `redirectTo` to the Auth.js `signIn` action. This ensures the user lands back on the intended admin page after OAuth completes. When calling `signIn()` programmatically, pass `{ redirectTo: '/admin' }` as the options to get the same default behavior.

**Slugs** — always generate via `src/lib/utils/slugify.ts`. Never construct slugs by hand.

**CodeMirror 6 wiring** — initialize the CodeMirror `EditorView` inside `onMount` and tear it down with `onDestroy` or the returned mount cleanup. Svelte holds only the serialized markdown string; sync it from CodeMirror via an `updateListener` extension on every document change. `MarkdownEditor.svelte` exposes a bindable `value` prop, optional `placeholder`, and optional `onChange(value)` callback for non-binding consumers. Never wrap the `EditorView` instance in a Svelte store or reactive variable — it is not serializable.

```svelte
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { EditorView, basicSetup } from 'codemirror';
  import { markdown } from '@codemirror/lang-markdown';
  import { placeholder as placeholderExtension } from '@codemirror/view';

  let {
    value = $bindable(''),
    placeholder = '',
    onChange,
  }: { value?: string; placeholder?: string; onChange?: (value: string) => void } = $props();
  let container: HTMLDivElement | undefined;
  let view: EditorView | undefined;

  onMount(() => {
    if (!container) return;

    view = new EditorView({
      doc: value,
      extensions: [
        basicSetup,
        markdown(),
        placeholderExtension(placeholder),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          value = update.state.doc.toString();
          onChange?.(value);
        }),
      ],
      parent: container,
    });
  });

  onDestroy(() => view?.destroy());
</script>

<div bind:this={container}></div>
```

**Wiki-link autocomplete (CodeMirror)** — register a `CompletionSource` from `@codemirror/autocomplete` that triggers on `[[`. The completion item list is the full set of note `{ slug, title }` pairs, injected as a prop from `+page.server.ts` (fetched once on load, not on every keystroke). On completion, insert `[[slug]]` and advance the cursor past the closing `]]`.

```ts
import { autocompletion, type CompletionSource } from '@codemirror/autocomplete';

function wikiLinkCompletions(notes: { slug: string; title: string }[]): CompletionSource {
  return (context) => {
    const match = context.matchBefore(/\[\[[^\]]*$/);
    if (!match) return null;
    const query = match.text.slice(2).toLowerCase();
    return {
      from: match.from + 2,
      options: notes
        .filter((n) => n.slug.includes(query) || n.title.toLowerCase().includes(query))
        .map((n) => ({ label: n.slug, detail: n.title, apply: `${n.slug}]]` })),
    };
  };
}
```

**Split-pane live preview contract (admin editors)** — both `/admin/notes/new` and `/admin/notes/[slug]/edit` use a two-pane authoring surface: left source editor + right rendered preview. Keep the preview pipeline client-local and synchronous with typing:

- Sync source of truth from CodeMirror to a plain `body` string in Svelte state on every `docChanged` event.
- Build preview from that `body` string only; no request/response cycle is allowed while typing.
- Call `renderPreview(body, resolvedSlugs)` (or `renderPreviewSync`) from `src/lib/utils/markdown-preview.ts` to obtain a `PreviewResult`. This helper applies `renderWikiLinks` then converts markdown to HTML via unified (remark-parse → remark-gfm → remark-rehype → rehype-stringify). It is client-safe; do not substitute the server-only `src/lib/server/markdown.ts` renderer in admin `.svelte` files.
- Never import server-only modules (for example `src/lib/server/**`) into admin `.svelte` files for preview rendering.
- `renderPreview` never throws — it returns `{ ok: false, html, errorMessage }` on pipeline failure. Check `result.ok` before rendering; on `false`, show a lightweight preview error state without blocking form actions.
- Treat right-pane output as sanitized render output; do not inject untrusted raw HTML directly into the DOM.

**Preview parity boundary** — live preview must preserve markdown structure and wiki-link semantics used by public notes. Exact code highlighting/theme parity with the server-side public renderer is optional; correctness of headings/lists/links/emphasis/table structure is required.

### UI Primitives and Motion

- Prefer Bits wrappers in local component files (for example under `src/lib/components/ui/`) rather than ad-hoc route-level usage.
- Bits components must conform to the visual system in [styleguide.md](styleguide.md) (sharp geometry, line hierarchy, tokenized color/type).
- If a Bits primitive exists for the interaction pattern (dialog, select, menu, tabs, tooltip, etc.), use it by default.
- Only use custom interaction implementations when a concrete limitation is documented.
- For animation:
  - Use CSS/Svelte transitions for simple hover/focus/show-hide.
  - Use GSAP for complex sequencing, scroll-coupled choreography, and multi-element timeline control.
  - Respect reduced-motion behavior and ensure content remains usable without motion.

**Dropdown/Select design system**

- The shared `ga-select-*` CSS class system lives in `src/app.css` under `@layer components`. Never duplicate these classes in route-local `<style>` blocks.
- `Select.svelte` (`src/lib/components/ui/Select.svelte`) wraps Bits `Select` and applies `ga-select-trigger`, `ga-select-content`, and `ga-select-item` classes. Use this wrapper for all interactive selects in the codebase.
- `Select.svelte` props: `items` (required), `value` (bindable string, default `''`), `name` (form field name), `placeholder`, `disabled`, `onValueChange` (optional `(value: string) => void` callback for imperative reactions such as client-side navigation), `class`, `triggerClass`, `contentClass`.
- For context-specific trigger geometry (for example the notes filter bar's underline style), pass a modifier class name via `triggerClass` and define the override using `:global()` in the route's `<style>` block. Do not add route-specific trigger overrides to `app.css`.
- State styling uses Bits-emitted data attributes: `[data-state="open"]` on trigger, `[data-highlighted]` on items (keyboard/hover focus), `[data-selected]` on items (currently chosen), and `[data-disabled]` on items and trigger.
- For bare native `<select>` elements (e.g., progressive-enhancement filter bars), `app.css` sets `color-scheme: light dark` globally so the browser-rendered popup always respects the active dark theme. Route-local styles may override geometry/layout properties but must not remove `color-scheme`.

---

## Database (Drizzle ORM / Neon)

### Connection

- Use the Neon serverless HTTP driver (`@neondatabase/serverless`). Never use a TCP/WebSocket pool — the HTTP driver is the established pattern for this project and avoids connection-pool lifecycle issues in the Bun server environment.
- The database client is exported from `src/lib/server/db/index.ts`. Import from there everywhere.

### Schema (`src/lib/server/db/schema.ts`)

- All table and column definitions live in a single `schema.ts`. No splitting schema across files.
- DB columns use snake_case. Drizzle maps them to camelCase TypeScript properties automatically.
- Tags are stored as `text[]` (Postgres array) on the notes table — not a separate join table.
- Note cover media and editorial metadata live directly on the `notes` table: `image` stores the pasted/presigned media URL, `published_at` maps to `publishedAt`, and `series` stores an optional series label.
- Section-aware retrieval chunks are stored in `note_chunks` with `note_slug`, section/chunk ordering metadata, chunk text, and one `vector(1536)` embedding per chunk.
- Embeddings are stored as `vector(1536)` using pgvector. Only pgvector similarity queries may use raw SQL (via Drizzle `sql` template tag). All other queries use Drizzle query builders.

Example column conventions:

```ts
export const notes = pgTable('notes', {
  id:        serial('id').primaryKey(),
  slug:      text('slug').notNull().unique(),
  title:     text('title').notNull(),
  body:      text('body').notNull(),
  takeaway:  text('takeaway').notNull(),
  tags:      text('tags').array().notNull().default([]),
  category:  text('category').notNull(),
  image:     text('image'),
  publishedAt: timestamp('published_at'),
  series:    text('series'),
  embedding: vector('embedding', { dimensions: 1536 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### Migrations

- Generate migrations with `drizzle-kit generate`. Never hand-edit generated migration files.
- Apply migrations with `drizzle-kit migrate` (or the project's `npm run db:migrate` script).
- Migration files live in `drizzle/` at the project root.
- Never apply schema changes directly against the production Neon database without a migration file.

### Query Patterns

- All query helpers live in `src/lib/server/db/notes.ts` (or a peer file for other domains). No inline Drizzle queries in route files.
- Return plain serializable objects from query helpers, not raw Drizzle result types.
- Use Drizzle's type inference for return types: `typeof notes.$inferSelect`.
- Chunk indexing helpers must go through typed helpers (`replaceNoteChunks`, `searchChunksBySimilarity`) rather than inline route SQL.

```ts
// src/lib/server/db/notes.ts
import { db } from './index';
import { notes } from './schema';
import { eq } from 'drizzle-orm';

export async function getNoteBySlug(slug: string) {
  const [note] = await db.select().from(notes).where(eq(notes.slug, slug));
  return note ?? null;
}
```

- Similarity search (pgvector) is the one allowed exception for raw SQL — use the `sql` template tag:

```ts
import { sql } from 'drizzle-orm';

export async function findSimilarNotes(embedding: number[], limit = 5) {
  return db.execute(
    sql`SELECT id, slug, title, takeaway
        FROM notes
        ORDER BY embedding <=> ${JSON.stringify(embedding)}::vector
        LIMIT ${limit}`
  );
}
```

### Embeddings

- Embeddings are generated in `src/lib/server/embeddings.ts` and called at note create/update time.
- Always regenerate the embedding when the note `body` changes.
- Embedding generation must not block the HTTP response — fire it synchronously as part of the save transaction, or enqueue it if latency is a concern.
- Chunk ingestion uses deterministic section/paragraph chunk ordering and a canonical payload template: note metadata (`title`, `category`, `tags`, `series`) plus chunk text.
- Chunk rows must be replaced as one set via `replaceNoteChunks` only after all chunk embeddings are ready; on embedding failure, log and skip replacement (fail-soft, no partial chunk churn).
- Current implementation stores both note-level embeddings (`notes.embedding`) and section-aware chunk embeddings (`note_chunks.embedding`). Chat orchestration still reads note-level retrieval in production; chunk retrieval wiring is tracked in remaining CHAT tasks under `RESOLVED-16`.

---

## AI / Chat

### Personality

- The personality block (system prompt preamble) is defined in `src/lib/server/personality.ts`.
- `chat.ts` imports and uses it. Never inline the personality string in `chat.ts` or any other file.
- Chat answers use first-person author voice ("I", "my"), not third-person narration.
- Chat responses end with an italicized related-notes footer using wiki-link syntax (for example: `*Related notes: [[slug|Title]]*`) when relevant notes were used.

### Prompt Assembly (`src/lib/server/chat.ts`)

- Use always-on light hybrid retrieval: run semantic similarity and topic/lexical retrieval in parallel, then fuse/rerank a bounded candidate set before prompt assembly.
- Include only compact evidence in LLM context (current: takeaway + first paragraph; target: note summary + top chunk excerpt(s)). Never send full note bodies.
- Assemble the final prompt from: personality block + condensed evidence context + user message.
- Apply confidence gating before answer generation. If confidence is low, return a limited-coverage fallback with related-topic note links instead of speculative direct answers.
- Keep related-note links deterministic from retrieved note slugs; do not rely on model-invented slugs or URLs.

### OpenRouter (`src/lib/server/ai/openrouter.ts`)

- All LLM calls go through `openrouter.ts`. Never call the OpenRouter API directly from `chat.ts` or route files.
- The adapter exposes an OpenAI-compatible interface (streaming `chat.completions.create`).

### Note Critique (`src/lib/server/ai/review.ts`)

- The critique endpoint uses a free-tier OpenRouter model (`google/gemini-2.0-flash-exp:free` or equivalent). Never use a paid model for this feature.
- The review request payload is `{ title, takeaway, body }` from the current editor form state. Do not require a saved slug to run critique.
- The route handler must forward `429` (rate limited) and `503` (model unavailable) status codes to the client as-is — never silently swallow them or return a generic 500.
- The client component must display a user-visible error when the review stream fails; never silently fail.
- Trigger critique only from an explicit manual Review action. Never auto-run critique on save, publish, or every body change.
- Critique output should be compact and structured (brief sections + concrete rewrite suggestions), optimized for fast editorial iteration.
- Critique is always optional. Never gate note save or publish on a successful review response.
- Use the shared admin UI component (`src/lib/components/admin/NoteReviewPanel.svelte`) in both new/edit note pages so trigger/error/output behavior stays consistent.
- Keep review stream parsing in a client-safe utility (`src/lib/utils/note-review.ts`), not inline duplicated logic inside route components.

---

## Auth & Security

- Auth.js manages sessions. Session data is attached to `event.locals.session` in `hooks.server.ts`.
- The `hooks.server.ts` file guards every route under `/admin` and `/api/admin`. Never add per-route auth checks as a substitute for the hook guard — they can be forgotten.
- Rate limiting for `/api/chat` is enforced server-side per anonymous browser session cookie (`chat_session`), not per IP. Persist counters in `chat_rate_limits` keyed by SHA-256 hash of the cookie token, tracking `{ message_count, window_start }`. The limit check runs at the top of the `/api/chat` `+server.ts` handler before any embedding or LLM call.
- Use `consumeChatRateLimit()` from `src/lib/server/db/notes.ts` for quota persistence so increment + window reset stay atomic in one DB upsert. Do not split reset/increment into multiple round trips.
- The `chat_session` cookie must be opaque/random and set with secure defaults (`httpOnly`, `sameSite: 'lax'`, `path: '/'`, `secure` in production). Never trust client-submitted session IDs in JSON bodies for quota enforcement.
- Cookie-clearing reset behavior is accepted for anonymous public chat. Do not add visitor accounts just to make chat quota non-resettable.
- Never expose internal error messages or stack traces in API responses. Return generic error strings to the client.

---

## Testing

See `docs/TESTING.md` for the full testing guide. Rules that affect code structure:

- Write testable functions: pure query helpers in `src/lib/server/db/` are unit-testable without a live DB (mock `db`).
- Vitest is the only test runner. Do not add Jest.
- Test files live alongside source files as `*.test.ts`, or in `src/__tests__/` for integration tests.
- Server-only modules must be tested in a Node environment (not a browser/jsdom environment) — set `environment: 'node'` in the Vitest config for those files.
- Do not write tests that call OpenRouter or Neon in CI — mock those boundaries.

---

## Never

- Never commit secrets, `.env` files, or API keys.
- Never import anything from `src/lib/server/` in a client-side Svelte component or `+page.svelte` script block.
- Never call OpenRouter or Neon directly from client-side code.
- Never hardcode the personality block anywhere except `src/lib/server/personality.ts`.
- Never include full note bodies in the LLM prompt — use `takeaway` + first paragraph only.
- Never return raw Drizzle ORM result objects from API endpoints — serialize to a typed plain object first.
- Never bypass the `hooks.server.ts` auth guard on `/admin` or `/api/admin` routes.
- Never use legacy Svelte reactive declarations (`$:`) or `export let` for props in new components.
- Never write raw SQL outside of pgvector similarity queries.
- Never hand-edit generated Drizzle migration files.
- Never use a TCP/WebSocket Neon connection — use the serverless HTTP driver only.
- Never buffer the chat response and return JSON — always stream via `ReadableStream` SSE.

## Always

- Always use Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) in new components.
- Always stream chat responses as SSE (`return new Response(stream, ...)`).
- Always regenerate the note embedding when `body` changes.
- Always generate slugs via `src/lib/utils/slugify.ts`.
- Always check `event.locals.session` in server load functions and endpoints that require auth.
- Always load the personality block from `src/lib/server/personality.ts`.
- Always run Vitest before marking a task done.
- Always update `docs/` when behavior, interfaces, or invariants change.
- Always keep DB query helpers in `src/lib/server/db/` — not inline in route files.
- Always use the Neon serverless HTTP driver for DB connections.
