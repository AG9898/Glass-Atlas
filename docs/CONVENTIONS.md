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

For `POST /api/chat`, keep the request flow ordered as:
1) quota check, 2) allowlisted social-intent handling (templated/non-factual only), 3) retrieval + confidence gate, 4) LLM stream. Do not route factual questions through the social-intent path.

**Chat retrieval confidence** — `assembleContext()` must expose confidence metadata with a high/borderline/low tier. Base the tier primarily on the best semantic chunk cosine distance using centralized named thresholds in `src/lib/server/chat.ts`; lexical/topic matches are supporting evidence and must not make a clearly distant semantic match high confidence. Before embedding, semantic search may expand local aliases such as "creator", "Aden", "RAG", and "LLM" through `buildSemanticSearchQuery()`; keep that expansion narrow and site-specific so unrelated questions still fall through the low-confidence gate. Low-confidence and empty retrieval must return the deterministic fallback SSE stream without calling the LLM. Borderline retrieval must call the LLM with an explicit limited-coverage instruction, remain distinguishable from high confidence in route logic and tests, and never present adjacent evidence as a direct answer.

**Chat source transparency** — source UI must be driven by retrieval metadata returned by the server, not by model-written citations. Assistant messages may show a subtle source button when sources exist. The popup content is limited to note title, slug link, and brief retrieved snippets from the chunks/takeaways already used for prompt assembly. Do not fetch or expose full note bodies just to populate chat source popups. Coverage/confidence labels, if displayed, should be subtle and mapped from server confidence metadata rather than inferred on the client.

**Chat source metadata contract (server side, shipped CHAT-06A)** — `buildChatSources(citedNotes)` in `src/lib/server/chat.ts` is the only place that decides which `citedNotes` entries become client-facing source metadata; it filters to safe slugs (`isSafeNoteSlug`) with a non-empty `snippet`. `POST /api/chat` calls it only after the confidence gate passes (high/borderline tier) and only attaches a result when the route also intends to stream from the LLM — never on the low-confidence fallback or social-intent lanes. When sources exist, the route wraps the LLM `ReadableStream` so a single trailing SSE `data:` event shaped `{ "sources": [{ slug, title, snippet }, ...] }` is appended after the upstream stream completes; this payload deliberately omits the OpenAI `choices` shape so it round-trips through the existing `extractToken`-style client parsing as a harmless no-op token until a client implements source-popup rendering. Each `CitedNote`/`ChatSource` `snippet` is built via `buildSourceSnippet()` in `src/lib/utils/chat-format.ts`, which collapses whitespace, truncates, and HTML-escapes the chunk excerpt or takeaway — never the full note body and never LLM output.

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

**Landing chat frame** — the homepage chat panel is intentionally fixed to `790px × 770px` on desktop with internal message scrolling. Keep overflow contained inside the chat viewport so long conversations never extend overall page height. On narrow screens, switch to fluid width and viewport-limited height.

**Auth session** — read from `event.locals.session` (set by `hooks.server.ts`). Never read cookies manually in load functions or endpoints.

**Post-sign-in redirect** — the admin guard in `hooks.server.ts` redirects unauthenticated `/admin` visits to `/signin?callbackUrl=<encoded-path>`. The custom sign-in page at `src/routes/signin/` reads `callbackUrl` from the query string (defaulting to `/admin`) and passes it as `redirectTo` to the Auth.js `signIn` action. This ensures the user lands back on the intended admin page after OAuth completes. When calling `signIn()` programmatically, pass `{ redirectTo: '/admin' }` as the options to get the same default behavior.

**Slugs** — always generate via `src/lib/utils/slugify.ts`. Never construct slugs by hand.

**D3 in Svelte components** — never import D3 at the module level (`import * as d3 from 'd3'`). Always use a dynamic `import('d3')` call inside a `$effect` body. D3 reads `window`/`document` and will crash SSR if imported statically. The D3 simulation should be stopped in the `$effect` cleanup function returned before the async import resolves.

**Reader paths** — note detail pages should present semantic related notes plus explicit backlinks/outlinks as separate reader-path concepts. Semantic related notes may use existing embedding/retrieval helpers, but public pages must only link to published notes. Backlinks/outlinks must come from the `note_links` table through query helpers, not from scanning full note bodies in route components. Keep the D3 graph small and supporting; polish should improve fluidity and interaction clarity without turning it into the primary reading surface.

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
- Call `renderPreview(body, resolvedSlugs)` (or `renderPreviewSync`) from `src/lib/utils/markdown-preview.ts` to obtain a `PreviewResult`. This helper applies `renderWikiLinks`, then `remarkInlineMediaEmbeds`, then converts markdown to HTML via unified (remark-parse → remark-gfm → remark-rehype → rehype-stringify). It is client-safe; do not substitute the server-only `src/lib/server/markdown.ts` renderer in admin `.svelte` files.
- Never import server-only modules (for example `src/lib/server/**`) into admin `.svelte` files for preview rendering.
- `renderPreview` never throws — it returns `{ ok: false, html, errorMessage }` on pipeline failure. Check `result.ok` before rendering; on `false`, show a lightweight preview error state without blocking form actions.
- Treat right-pane output as sanitized render output; do not inject untrusted raw HTML directly into the DOM.

**Preview parity boundary** — live preview must preserve markdown structure and wiki-link semantics used by public notes. Exact code highlighting/theme parity with the server-side public renderer is optional; correctness of headings/lists/links/emphasis/table structure is required.

**Inline media token syntax (`{{media ...}}`)** — markdown bodies may include one token per line to embed uploaded assets inline:

- Base format: `{{media src="/api/admin/media/access-url?key=..." type="image|video" align="left|center|wide" caption="Optional caption" alt="Optional alt"}}`
- `src` is required. `type` defaults from extension (`.mp4` => `video`, otherwise `image`).
- `align` defaults to `center`; `wide` is preferred for MP4 demos in long-form notes.
- Use this token for inline media placement in note bodies; do not rely on raw HTML `<img>`/`<video>` blocks in author-written markdown.
- `/admin/notes/new` may use temporary `blob:` sources in these tokens before create-submit; preview must render these staged tokens as normal media.
- Keep token parsing tolerant of markdown AST linkification (`remark-gfm` can autolink `http://` segments inside `blob:` URLs). Do not assume token paragraphs are always a single plain text node.

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
- Semantic index health also lives on `notes`: `semantic_index_status` (`pending`/`current`/`failed`), `semantic_index_error`, `semantic_indexed_at`, and `semantic_index_source_updated_at`.
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
  semanticIndexStatus: text('semantic_index_status').default('pending').notNull(),
  semanticIndexError: text('semantic_index_error'),
  semanticIndexedAt: timestamp('semantic_indexed_at'),
  semanticIndexSourceUpdatedAt: timestamp('semantic_index_source_updated_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### Migrations

- Generate migrations with `drizzle-kit generate`. Never hand-edit generated migration files.
- Apply migrations with `drizzle-kit migrate` (or the project's `npm run db:migrate` script).
- Migration files live in `drizzle/` at the project root.
- Never apply schema changes directly against the production Neon database without a migration file.
- Any task that includes a DB schema change must apply the generated migration to production in that same task before marking it done. If local/WSL migration tooling hangs, use the HTTP migration runner (`npm run db:migrate:http`) rather than direct SQL.

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
- Admin save flows must call `reindexNoteAfterSave()` so note-level and chunk-level vectors share one fail-soft contract.
- Note-level embeddings must only be overwritten after a fresh note embedding and every fresh chunk embedding are generated successfully. On any embedding failure, log the failure and preserve the previous vector.
- Chunk rows must be replaced as one set via `replaceNoteChunks` only after all chunk embeddings are ready; on embedding failure, record `semantic_index_status = 'failed'` and skip replacement (fail-soft, no partial chunk churn).
- Successful indexing must record `semantic_index_status = 'current'`, clear `semantic_index_error`, set `semantic_indexed_at`, and store the saved note's `updated_at` in `semantic_index_source_updated_at`.
- Semantic status-only updates must preserve the saved note's `updated_at`; otherwise current indexes can look stale immediately after refresh.
- Admin note surfaces should expose stale-index state when saved content is newer than the last successful semantic index or when `semantic_index_status = 'failed'`. Use the server-side `getSemanticIndexDisplay()` mapper to drive list/editor UI warnings; do not duplicate timestamp/status rules in client components.
- Current implementation stores both note-level embeddings (`notes.embedding`) and section-aware chunk embeddings (`note_chunks.embedding`). Chat orchestration uses section-aware chunk retrieval plus lexical/topic retrieval for prompt assembly.

---

## AI / Chat

### Personality

- The personality block (system prompt preamble) is defined in `src/lib/server/personality.ts`.
- `chat.ts` imports and uses it. Never inline the personality string in `chat.ts` or any other file.
- Chat answers use first-person author voice ("I", "my"), not third-person narration.
- The default voice is relaxed, informal, friendly, and lightly playful. This style can be more conversational than terse KB prose, but it must never weaken grounding or cite unsupported facts.
- Chat responses end with an italicized related-notes footer using wiki-link syntax (for example: `*Related notes: [[slug|Title]]*`) when relevant notes were used.

### Prompt Assembly (`src/lib/server/chat.ts`)

- Use always-on light hybrid retrieval: run semantic similarity and topic/lexical retrieval in parallel, then fuse/rerank a bounded candidate set before prompt assembly.
- Include only compact evidence in LLM context: semantic note chunks with section headings, plus lexical-only title/takeaway snippets. Never send full note bodies.
- Assemble the final prompt from: personality block + condensed evidence context + user message.
- Apply confidence gating before answer generation. High confidence uses the normal grounded LLM answer path; borderline confidence uses a stricter limited-coverage LLM instruction; low confidence skips the LLM and returns the deterministic no-coverage fallback with related-topic note links when available.
- Keep related-note links deterministic from retrieved note slugs; do not rely on model-invented slugs or URLs.
- Keep chat source-popup metadata deterministic from retrieved note slugs and excerpts; do not rely on model-invented snippets, slugs, URLs, or confidence labels.
- Fallback responses use `buildFallbackResponse(citedNotes)` from `src/lib/server/chat.ts`, which appends an italicised related-notes footer (`*Related notes: [[slug|Title]]*`) for any retrieved notes and drops notes whose slugs fail `isSafeNoteSlug` validation. Never pass model-invented slugs to this function.
- `isSafeNoteSlug` is exported from `src/lib/utils/chat-format.ts` and is the canonical slug-safety predicate for both the fallback builder and the chat HTML renderer. Import it from that module in both client and server contexts.

### OpenRouter (`src/lib/server/ai/openrouter.ts`)

- All LLM calls go through `openrouter.ts`. Never call the OpenRouter API directly from `chat.ts` or route files.
- The adapter exposes an OpenAI-compatible interface (streaming `chat.completions.create`).

### Note Critique (`src/lib/server/ai/review.ts`)

- The critique endpoint uses a free-tier OpenRouter model/router (`openrouter/free` by default, configurable via `OPENROUTER_REVIEW_MODEL`). Never use a paid model for this feature unless a new decision explicitly changes the cost policy.
- The review request payload is `{ title, takeaway, body }` from the current editor form state. Do not require a saved slug to run critique.
- The route handler must forward `429` (rate limited) and `503` (model unavailable) status codes to the client as-is — never silently swallow them or return a generic 500.
- The client component must display a user-visible error when the review stream fails; never silently fail.
- Trigger critique only from an explicit manual Review action. Never auto-run critique on save, publish, or every body change.
- Critique output should be compact and structured (brief sections + concrete rewrite suggestions), optimized for fast editorial iteration.
- Critique is always optional. Never gate note save or publish on a successful review response.
- Use the shared admin UI component (`src/lib/components/admin/NoteReviewPanel.svelte`) in both new/edit note pages so trigger/error/output behavior stays consistent.
- Keep review stream parsing in a client-safe utility (`src/lib/utils/note-review.ts`), not inline duplicated logic inside route components.

### Admin Quality Warnings

- Editor-page quality checks are advisory only. Never block Save Draft or Publish because of stale embeddings, missing takeaway, no internal links, or weak title.
- Reuse `getSemanticIndexDisplay()` for stale/failed semantic index messaging instead of duplicating timestamp logic in client code.
- Missing takeaway and no-internal-link checks should be deterministic and local to note state. Weak-title checks should start as deterministic heuristics; do not add an LLM call unless a future decision explicitly accepts that cost/latency.
- Show warnings inside the note editor surfaces, not only on the admin dashboard, so the author sees them while editing.

### Public Markdown Technical Blocks

- Code blocks and diagrams use the blueprint technical panel visual recipe. Code blocks should support copy, language labels, optional filename labels when metadata exists, and wrapping controls for long lines.
- Mermaid fences are planned to render as diagrams. Until a dedicated renderer is implemented, keep the current safe fallback that renders unsupported fences as readable unhighlighted code instead of throwing.
- Do not allow diagram rendering failures to 500 a note page; fail soft to readable code/source output.

### Agent-Assisted Authoring (`/write-post`)

- The blog writing voice has a single source of truth: **`docs/VOICE.md`**. The `/write-post` skill and the `draft-review.ts` scorer both load it. Never inline a blog-voice spec into the skill prompt, the scorer prompt, or anywhere else. `docs/VOICE.md` is the long-form editorial counterpart to `src/lib/server/personality.ts` (the chat persona) — keep the two consistent but distinct; do not merge them.
- `/write-post` must load current note slugs through `listNotes()` using the established Vite SSR loader pattern before it drafts. If `DATABASE_URL` is unavailable or slug loading fails, stop before drafting; do not guess, scrape rendered pages, or emit speculative `[[slug]]` links.
- Agent-authored notes are persisted **only as `status: 'draft'`**. `scripts/create-note.js` must hard-force `status: 'draft'` and expose no flag, argument, or env var that publishes. Publishing stays a deliberate human action in the `/admin` editor.
- `scripts/create-note.js` must persist through `createNote()` + `reindexNoteAfterSave()` loaded through Vite SSR so `$lib` and `$env/dynamic/private` resolve exactly as they do in app code. Never write notes, links, embeddings, or chunks with bespoke SQL — reuse the existing helpers so the wiki-link graph and semantic index stay identical to hand-authored notes. Reject duplicate generated slugs before insertion with `getNoteBySlug()`.
- `scripts/review-draft.js` must load `src/lib/server/ai/draft-review.ts` through the same Vite SSR/env pattern and print the score object as JSON. It is a read-only scoring helper: no database reads, no database writes, and no save/publish gating.
- **Grounding:** the factual spine of a post comes from the author's interview answers plus existing published notes. The agent may add outside (non-author) knowledge to round out a point, but every such passage must be surfaced as a "verify before publish" item in the **terminal report only**. Never write outside-knowledge flags into the note body, and never fabricate personal anecdotes, benchmarks, dates, or quotes the author did not provide.
- **Relational links:** emit `[[slug]]` only for slugs that already exist (the agent must check against the current note list). Report any author-named link targets that do not yet exist rather than inventing or forward-linking them silently.
- After `scripts/create-note.js` writes a draft, `/write-post` should verify the saved row through app helpers and report draft status, embedding presence, semantic index status, chunk count, and outlink count. A failed semantic index does not mean the note write failed, but it must be visible in the final report.
- The draft-review scorer (`src/lib/server/ai/draft-review.ts`) is **separate** from the in-editor critique (`ai/review.ts`) and uses `OPENROUTER_DRAFT_REVIEW_MODEL` (free model/router default). Its score is recorded and shown but **must not gate** saving or publishing until DECISIONS.md OPEN-01 is resolved.

---

## Auth & Security

- Auth.js manages sessions. Session data is attached to `event.locals.session` in `hooks.server.ts`.
- The `hooks.server.ts` file guards every route under `/admin` and `/api/admin`. Never add per-route auth checks as a substitute for the hook guard — they can be forgotten.
- Rate limiting for `/api/chat` is enforced server-side per anonymous browser session cookie (`chat_session`), not per IP. Persist counters in `chat_rate_limits` keyed by SHA-256 hash of the cookie token, tracking `{ message_count, window_start }`. The limit check runs at the top of the `/api/chat` `+server.ts` handler before any embedding or LLM call.
- Use `consumeChatRateLimit()` from `src/lib/server/db/notes.ts` for quota persistence so increment + window reset stay atomic in one DB upsert. Do not split reset/increment into multiple round trips.
- The `chat_session` cookie must be opaque/random and set with secure defaults (`httpOnly`, `sameSite: 'lax'`, `path: '/'`, `secure` in production). Never trust client-submitted session IDs in JSON bodies for quota enforcement.
- Cookie-clearing reset behavior is accepted for anonymous public chat. Do not add visitor accounts just to make chat quota non-resettable.
- Never expose internal error messages or stack traces in API responses. Return generic error strings to the client.
- Security response headers are applied to every response by the `securityHeaders` handle at the end of the `sequence(...)` in `hooks.server.ts`. Never duplicate these headers in individual route handlers. The set includes: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and `Strict-Transport-Security` (production only). If new security headers are needed, add them to `securityHeaders` — not to individual routes.
- `adminGuard` in `hooks.server.ts` is the authoritative catch-all for both page and API admin routes. For `/admin/**` it redirects unauthenticated users to sign-in (correct for pages). For `/api/admin/**` it returns `401 JSON` (correct for API clients). `GET /api/admin/media/access-url` is listed in `PUBLIC_API_PATHS` as the sole intentional exception. Any new `/api/admin/*` route added without an entry in `PUBLIC_API_PATHS` is automatically blocked by the hook — individual handler auth checks remain as defence-in-depth but the hook is the guaranteed gate.
- `POST /api/chat` enforces a 2 000-character maximum on the `message` field (checked before the quota check) to prevent cost-amplification via oversized inputs. Adjust `MAX_MESSAGE_LENGTH` in `+server.ts` if the limit needs tuning, but keep it well below typical LLM context limits.
- The Neon connection pool is kept warm by `src/lib/server/db/keepalive.ts`, which is imported as a side-effect in `hooks.server.ts`. Do not add additional DB ping logic elsewhere.

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
- Never inline the blog writing voice anywhere except `docs/VOICE.md` (loaded by `/write-post` and `draft-review.ts`).
- Never let `/write-post` draft with an unavailable note-slug list; missing link context is a blocker, not a reason to invent slugs.
- Never let the agent-authoring path publish a note — `scripts/create-note.js` is draft-only and must hard-force `status: 'draft'`.
- Never write agent-generated "outside knowledge" flags into a note body, and never fabricate personal anecdotes/quotes/benchmarks — flags are terminal-only and the factual spine is author-sourced.
- Never leave `/write-post` drafts as unstyled prose dumps or with patch artifacts. Draft bodies need a Markdown polish pass (headings, blockquotes/emphasis/lists/tables/fences where useful) and must contain no standalone `+` lines, `+##` heading prefixes, plus-prefixed code fences, or similar diff artifacts.
- Mermaid and plain-text fenced blocks are accepted in notes, but the current public renderer treats them as unhighlighted code blocks before `rehype-shiki` runs. Do not promise rendered Mermaid diagrams until a dedicated Mermaid renderer is implemented.
- Never include full note bodies in the LLM prompt — use bounded chunk excerpts and lexical-only summaries.
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
- Always load the blog writing voice from `docs/VOICE.md` in the authoring skill and scorer.
- Always persist agent-authored notes through `createNote()` + `reindexNoteAfterSave()` as drafts only.
- Always run Vitest before marking a task done.
- Always update `docs/` when behavior, interfaces, or invariants change.
- Always keep DB query helpers in `src/lib/server/db/` — not inline in route files.
- Always use the Neon serverless HTTP driver for DB connections.
