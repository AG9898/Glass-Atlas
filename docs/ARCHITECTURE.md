# Architecture — Glass Atlas

## Overview

Glass Atlas is a SvelteKit-based editorial site where the author publishes notes (markdown content) and visitors can explore them via browse/search or through an LLM-powered chat interface. All server-side logic runs as a persistent Bun HTTP server deployed on Railway (SvelteKit node adapter); the database is Neon PostgreSQL with the pgvector extension for semantic search, using the `glass_atlas` Postgres schema. Admin authoring is gated behind GitHub OAuth via Auth.js; all visitor interactions, including chat, are anonymous.

---

## System Topology

| Service | Where it runs |
|---|---|
| SvelteKit app (UI + API routes) | Railway (persistent Bun HTTP server; SvelteKit node adapter; auto-deploy on push to `main`) |
| PostgreSQL database (notes, note_chunks, citation_events, conversations, messages, Auth.js tables) | Neon (serverless HTTP driver; `glass_atlas` Postgres schema; production project + dev branch) |
| Object storage (note media uploads) | Railway Storage Buckets (private, S3-compatible; presigned URL upload + delivery) |
| LLM inference (chat completions, streaming) | OpenRouter API (remote, HTTP) |
| Embedding generation (query + note body vectors) | OpenRouter API (remote, HTTP) |
| GitHub OAuth provider | GitHub (remote, HTTP) |
| Local development server | localhost:5173 (SvelteKit dev server) |

The server is a persistent Bun process. In-memory state survives between requests on the same instance. Any state that must survive across deploys (conversation history, note data) is stored in Neon.

---

## Component Responsibilities

### SvelteKit route handlers (`src/routes/`)

- Serve static protocol files: `GET /robots.txt` (allows public routes, disallows `/admin` and `/api/`, links to sitemap), `GET /sitemap.xml` (published notes index).
- Render public pages: landing (`/`), notes list (`/notes`), note detail (`/notes/[slug]`), and how-it-works (`/how-it-works`). The `/chat` shortcut redirects to the landing chat anchor. The landing `+page.server.ts` loads live homepage metrics (published note count, distinct topic count, average words per published note, total citations served) and up to 7 most recent published notes via `db/notes.ts` helpers; it remains chat-first and uses automatic note-derived content.
- Render admin pages: dashboard (`/admin`), new note form, edit/delete note forms, and authenticated draft preview. The `/admin` dashboard loads all notes with `listNotes()` and deletes rows through a named SvelteKit form action that calls `deleteNote(slug)`. The new note form posts to a named `create` action, generates the slug from the title with `slugify.ts`, calls `createNote()`, attempts to generate/store an embedding, and redirects to `/admin/notes/[slug]/edit`. The edit form loads the existing note with `getNoteBySlug(slug)`, saves field patches through `updateNote(slug, data)`, regenerates the embedding after Save Draft/Publish, preserves status on Save Draft, and sets `status: 'published'` only through the Publish action. `/admin/notes/[slug]/preview` renders the same `NoteDetail` component as the public note page but does not require `status: 'published'`; it remains protected by the `/admin` route guard and marks itself `noindex`.
- Own the request/response boundary; delegate all business logic to server-side lib modules

**Does not:** contain any direct database queries, LLM HTTP clients, or embedding HTTP clients — those live in `src/lib/server/`

### Server-side lib (`src/lib/server/`)

- `db/index.ts` — Drizzle ORM client wired to the Neon HTTP driver; all SQL goes through here
- `db/keepalive.ts` — side-effect module imported once at server startup; runs a `SELECT 1` ping every 4 minutes to prevent Neon from dropping idle connections (no-op when `DATABASE_URL` is unset)
- `db/schema.ts` — Drizzle table definitions: `notes`, `note_chunks`, `note_links`, `citation_events`, Auth.js tables. `notes` stores semantic index metadata (`semantic_index_status`, `semantic_index_error`, `semantic_indexed_at`, `semantic_index_source_updated_at`) alongside the note-level vector.
- `db/notes.ts` — note CRUD helpers: `listNotes(filter?)`, `getNoteBySlug`, `createNote`, `updateNote`, `deleteNote`, `getBacklinks`, `getOutlinks`; RAG helpers: `searchNotesBySimilarity` (published notes ordered by pgvector cosine distance), `replaceNoteChunks`, `searchChunksBySimilarity` (chunk-level cosine similarity), `searchNotesByLexical` (title/tags/category ILIKE, published notes only), `recordCitations`, `getTotalCitations`; chat quota helper: `consumeChatRateLimit` (atomic window-reset + increment keyed by `chat_rate_limits.session_hash`); reader-path helper: `getRelatedNotes(slug, limit)` (looks up the source note's own embedding, then returns published notes ordered by pgvector cosine distance to it, excluding the source note — empty when the source has no embedding yet; kept separate from `getBacklinks`/`getOutlinks`). Exports plain-object types `Note`, `CreateNoteInput`, `UpdateNoteInput`, `RetrievedLexicalNote`, `RelatedNote`, including note metadata (`image`, `mediaType`, `publishedAt`, `series`) and semantic index state.
- `chat.ts` — `assembleContext()` runs semantic and lexical/topic retrieval in parallel, fuses candidates (semantic-first, lexical fill, capped at 5 notes), and assembles a compact context block per note; never injects full note bodies. Each `citedNotes` entry carries a `snippet` (HTML-escaped, truncated excerpt from the cited chunk/takeaway via `buildSourceSnippet()` in `chat-format.ts`) alongside `slug`/`title`. `buildChatSources()` filters `citedNotes` to safe-slug, non-empty-snippet entries — this is the source-of-truth contract for public chat source transparency: titles, slugs, and brief retrieved snippets can be exposed to the client, but model-invented citations cannot.
- `embeddings.ts` — calls the OpenRouter-compatible `/embeddings` endpoint with `OPENROUTER_API_KEY` from `$env/dynamic/private`; provides note-level embeddings plus section-aware chunk generation/payload helpers for `note_chunks` indexing
- `personality.ts` — exports the system prompt personality block as a string constant; never inlined elsewhere
- `ai/review.ts` — builds the note critique prompt from `{ title, takeaway, body }`, calls a free-tier OpenRouter model, returns a `ReadableStream`; never reads from or writes to the database
- `ai/draft-review.ts` — voice/AI-tell **scorer** for the agent-authoring flow; builds a prompt from the draft + the `docs/VOICE.md` rubric, calls a free-tier OpenRouter model, and returns a structured non-streaming score (0–100 plus per-dimension breakdown and flagged lines). Separate from `ai/review.ts` (the in-editor streaming critique) so the authoring scorer can be tuned/gated independently. Never reads from or writes to the database. The score is recorded/shown but enforced by nothing (see DECISIONS.md OPEN-01)

**Does not:** run in the browser; none of these modules are imported by client components

### Agent-assisted authoring (local, offline)

A separate authoring lane lets the author direct an agent to write a full note in the canonical blog voice and persist it as a draft, without using the admin browser UI. It is a **local developer/CLI path**, not a deployed runtime surface.

- `.claude/skills/write-post/SKILL.md` — the `/write-post` skill. Runs inline in the agent session: loads `docs/VOICE.md` + the category list (`note-taxonomy.ts`) + existing note slugs from `listNotes()` through the same Vite SSR pattern used by local scripts, then runs an extensive interview (structured `AskUserQuestion` batches + free-form follow-ups), drafts the note in voice, runs the `draft-review.ts` scorer, and invokes the write script. Emits `[[slug]]` links only for slugs that already exist and reports any named targets that do not. If the current note list cannot be loaded, the skill stops before drafting rather than guessing link targets. Flags every passage drawing on outside (non-author) knowledge in the **terminal report only** — flags are never written into the note body.
- `scripts/review-draft.js` — Node script that reads a draft payload (title, body, takeaway), loads `ai/draft-review.ts` through Vite SSR, and prints the structured score object as JSON for skill consumption. It never reads from or writes to the database.
- `scripts/create-note.js` — Node script that reads a draft payload (title, body, takeaway, category, tags, series), generates the slug via `slugify`, and persists through `createNote()` + `reindexNoteAfterSave()`. **Status is hard-forced to `draft`** — this path cannot publish. Because it goes through those helpers, the note's wiki-link graph (`note_links`), note-level embedding, and section/paragraph chunks are populated identically to a hand-authored note.

> **Implementation gotcha — SvelteKit aliases in a plain-Node script.** `createNote()`/`reindexNoteAfterSave()` and their imports use SvelteKit virtual modules and aliases (`$env/dynamic/private`, `$lib/*`) that plain `node` cannot resolve. `scripts/create-note.js` and `scripts/review-draft.js` therefore boot Vite in SSR middleware mode, load local `.env` values into `process.env`, then import the existing server helpers through Vite's resolver. Reusing those helpers (not re-implementing insert, embedding, chunk, or link logic) is the contract.

**Does not:** publish notes; run in production; bypass the embedding/chunk/link pipeline; write outside-knowledge flags into note content.

### API routes

- `POST /api/chat` — public; accepts `{ message }` (max 2 000 characters, rejected with 400 otherwise); reads/sets an anonymous `chat_session` cookie, enforces 10 messages per hour per anonymous browser session, serves an allowlisted social-intent reply for lightweight small-talk turns (greeting/thanks/capability/identity prompts), otherwise embeds query, runs hybrid retrieval, and streams either fallback or LLM output via SSE. On the citable LLM path (retrieval confidence high or borderline), the route calls `buildChatSources(citedNotes)` and, only when it returns at least one source, appends a single trailing SSE `data:` event shaped `{ "sources": [{ slug, title, snippet }, ...] }` after the LLM stream completes. This payload omits the OpenAI `choices` shape so existing/older clients parse it as an empty, ignorable token. The social-intent lane and the low-confidence fallback never call `buildChatSources` and never emit a `sources` event.
- `POST /api/admin/media/upload-url` — admin-only; accepts `{ filename, contentType }`; validates MIME allowlist (`image/jpeg`, `image/png`, `image/svg+xml`, `image/gif`, `video/mp4`) and returns a short-lived presigned `PUT` URL for direct browser upload to Railway Buckets
- `GET /api/admin/media/access-url?key=...` — public redirect endpoint; converts a stored object key into a short-lived presigned `GET` URL so bucket objects remain private while note media stays embeddable from stable app URLs
- `POST /api/admin/notes/review` — admin-only; accepts `{ title, takeaway, body }` from current editor state (new or edit page); calls `ai/review.ts`; streams critique via SSE; does not read from or write to the database; free-tier OpenRouter model; returns `429` or `503` transparently when the model is unavailable

Admin note create, update, and delete are handled by **SvelteKit form actions** in `+page.server.ts` files (not API routes). Form actions are the correct pattern for these mutations: they use progressive enhancement, integrate with SvelteKit's redirect flow, and do not require a separate client-side fetch.

### Auth middleware (`src/hooks.server.ts`)

- Runs before every `/admin` route and `/api/admin/**` handler
- Verifies the Auth.js session and rejects unauthenticated requests with a redirect to the OAuth flow
- All other routes pass through without auth checks
- Applies security response headers to every response via the `securityHeaders` handle: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and `Strict-Transport-Security` (production only, max-age 1 year)
- `adminGuard` covers both `/admin/**` (redirect to sign-in) and `/api/admin/**` (401 JSON) as a catch-all, with an explicit public exception for `GET /api/admin/media/access-url` which must remain accessible to anonymous visitors for note media rendering
- Imports `$lib/server/db/keepalive` as a side-effect on startup, which runs a `SELECT 1` ping every 4 minutes to keep the Neon connection pool warm

### Client components (`src/lib/components/`)

- Render UI only; send fetch/SSE requests to API routes
- `Nav.svelte` — global navigation shell rendered in `+layout.svelte` on every page. Receives `session` prop from `+layout.server.ts` (loaded via `event.locals.auth()`). Dark mode toggle reads `localStorage('ga-theme')` on mount (falls back to `prefers-color-scheme`), persists the preference, and applies/removes a `.dark` class on `<html>`. Login routes to the custom sign-in page (`/signin`, configured via Auth.js `pages.signIn`) and logout uses Auth.js sign-out action (`/auth/signout`). Search icon links to `/notes?focus=search`, which opens the notes index and auto-focuses the search field.
- Chat component manages optimistic UI state ("searching notes…"), token streaming, citation link rendering, and source-popup rendering. The backend source-metadata contract (`POST /api/chat`'s trailing `sources` SSE event) shipped in CHAT-06A; `Chat.svelte` consumes it via `parseChatSourcesEvent()` (`src/lib/utils/chat-format.ts`) and attaches the result to the in-flight assistant message (CHAT-06B). Each assistant message with sources shows a compact `Dialog`-based trigger (`src/lib/components/ui/Dialog.svelte`) that opens a popup listing each source's title — linking to `/notes/[slug]` — and brief snippet; messages without sources render no control.
- `NoteDetail.svelte` renders the canonical note-reading view shared by public note detail pages and admin draft preview, so draft preview stays visually aligned with the published page without weakening public status filtering. The right sidebar renders three optional reader-path modules — `RELATED NOTES` (semantic, from `getRelatedNotes`), `LINKS TO` (outlinks), and `LINKED FROM` (backlinks) — each hidden when empty and labeled separately so semantic relevance is never conflated with explicit wiki-link connections. The mini graph (`NoteGraph.svelte`) accepts an optional `graph` prop and is omitted on admin draft preview, which does not compute a 1-hop graph.
- `NoteGraph.svelte` — mini D3 force graph rendered in the left sidebar of `NoteDetail.svelte`. Receives pre-built `NoteGraphData` (nodes + edges) from the server load; D3 is loaded via a dynamic `import('d3')` inside `$effect` so the module never runs during SSR. Shows the current note's 1-hop wiki-link neighborhood (outlinks + backlinks, published notes only, no forward refs). It stays a small supporting widget, but interaction polish should make it feel fluid and exploratory rather than static.
- `MarkdownEditor.svelte` — CodeMirror 6 split-pane editor for admin note forms (`/admin/notes/new` and `/admin/notes/[slug]/edit`); left pane is the CodeMirror instance (initialized via `onMount`, torn down in cleanup), right pane is a live preview that updates while typing (`body` state -> wiki-link transform -> inline-media transform -> markdown-to-HTML render). No network calls are made on keystrokes. Note slug list for `[[` autocomplete/preview resolution is injected from `+page.server.ts` data loaded once per page request
- Admin note editors expose a manual `Review` action that streams optional critique and never blocks save/publish actions. They also expose warning-only quality checks for stale semantic indexes, missing takeaways, no internal links, and weak titles; these warnings never block save or publish.
- No direct access to DB, LLM, or secrets

---

## Data Flow

### RAG chat flow (public, approved target state)

The sequence below describes the retrieval orchestration as shipped through CHAT-04D.

```
1. User submits query in the chat UI
2. Frontend shows "searching notes..." (optimistic UI state)
3. Frontend POSTs `{ message }` to `POST /api/chat`; browser sends the existing `chat_session` cookie automatically
4. API route checks a narrow social-intent allowlist (greeting/thanks/capability/identity/how-it-works):
   - if matched: returns a short templated conversational SSE response, skips retrieval + LLM,
     and records no citations
   - if not matched: continue to step 5
5. API route expands narrow site-specific aliases for semantic retrieval (`creator`, `Aden`, `RAG`, `LLM`) and embeds that search query → vector(1536) via OpenRouter embedding API (~300 ms)
6. API route runs retrieval — both branches execute in parallel:
   a. Semantic: chunk-level cosine similarity search via `searchChunksBySimilarity` (top 20 candidates),
      chunks grouped by note slug (≤2 chunks per note)
   b. Lexical/topic: title/tags/category ILIKE search via `searchNotesByLexical` (top 10 candidates)
   c. Candidate fusion: semantic results fill slots first (ranked by cosine distance); lexical-only notes
      (not already in the semantic set) append in publication-date order; combined slate capped at 5 notes
7. API route applies confidence gating from semantic cosine-distance tiers:
   - high confidence: continues to the normal grounded LLM answer path
   - borderline confidence: continues to the LLM path with an explicit limited-coverage instruction that frames the evidence as adjacent or partial
   - low confidence or empty retrieval: returns a natural no-coverage SSE response with a steer
     toward note-grounded follow-up prompts —
     no LLM call is made; fabrication is impossible on this path
   Lexical/topic matches support candidate selection and can make lexical-only retrieval borderline, but semantic distance remains the primary cutoff for blocking irrelevant nearest-neighbor chunks.
   Non-fallback requests continue to step 8.
8. API route builds the LLM prompt:
     [personality block from personality.ts]
     + [retrieved note excerpts — chunks with section headings, lexical-only notes with takeaway]
9. API route calls OpenRouter (google/gemma-4-31b-it:free) with `stream: true`
10. OpenRouter streams tokens → API route pipes them as SSE to the frontend
11. Frontend renders tokens as they arrive
12. Before starting the stream, API route calls `recordCitations(citedSlugs)` to insert
    citation_events rows for each retrieved note slug (fire-and-forget; does not block streaming)
13. Frontend renders italicized related-note links in the assistant output
14. API route calls `buildChatSources(citedNotes)`; when it returns at least one source, the route
    wraps the LLM stream so a single trailing SSE event carrying `{ sources: [{ slug, title,
    snippet }, ...] }` is appended right after the LLM stream completes (shipped: CHAT-06A).
15. `Chat.svelte` parses that trailing event via `parseChatSourcesEvent()` and attaches the result to
    the in-flight assistant message (shipped: CHAT-06B). When sources exist, the message shows a
    subtle source button that opens a popup listing the retrieved note titles and brief snippets;
    clicking a source title navigates to `/notes/[slug]`. Messages without sources render no control.
```

**Latency strategy:** Streaming is the primary UX fix for perceived latency. Gemini Flash targets ~400–600 ms TTFT. Semantic and lexical/topic retrieval execute in parallel via `Promise.all`, so hybrid fusion adds no serial latency. Retrieval limits remain small (20 semantic chunks, 10 lexical notes, 5 fused notes) and deterministic for bounded latency control. Prompt size stays compact (note summary + bounded evidence excerpts), not full bodies.

**Current retrieval (CHAT-04D through CHAT-04H shipped):** `POST /api/chat` now has a short social-intent lane before retrieval for lightweight conversational turns. Non-social requests continue through `assembleContext()`, which expands narrow local aliases for semantic embedding, then runs semantic chunk retrieval and lexical/topic note retrieval in parallel. Semantic chunks are grouped by note (≤2 chunks per note) and ranked by cosine distance. Lexical-only notes not already in the semantic set are appended in publication-date order. The combined slate is capped at 5 distinct notes. Semantic notes contribute title, section headings, and chunk excerpts; lexical-only notes contribute title and takeaway only. Full note bodies are never sent to the LLM. Confidence gating uses semantic distance tiers exposed on assembled context metadata: high-confidence evidence proceeds to the normal LLM answer path, borderline evidence proceeds to a stricter limited-coverage prompt that must identify the evidence as adjacent or partial, and low-confidence retrieval returns the deterministic no-coverage SSE fallback without an LLM call. Lexical/topic matches are supporting evidence; they do not override a clearly irrelevant semantic distance.

**Source transparency (backend + frontend shipped, CHAT-06A/CHAT-06B):** Public chat source metadata is driven by retrieval metadata, not by LLM-generated prose. `buildChatSources()` in `chat.ts` derives `{ slug, title, snippet }` entries from `citedNotes` — the same candidates already selected for prompt assembly — and drops unsafe slugs or empty snippets using `isSafeNoteSlug()`. `POST /api/chat` only calls it on the citable LLM path (high/borderline confidence) and only emits the trailing `sources` SSE event when at least one source remains; the low-confidence fallback and social-intent lane never call it. Snippets are collapsed-whitespace, truncated, HTML-escaped excerpts from the cited chunk text or takeaway (`buildSourceSnippet()` in `chat-format.ts`) — never full note bodies. `Chat.svelte` renders this metadata behind a compact source-popup `Dialog` trigger that only appears when a message has sources; the popup lists each source's linked title and snippet, and coverage stays subtle and does not distract from reading the answer.

### Note save flow (admin)

```
1. Admin submits the note form in the browser
   - Cover media controls include a `media_type` selector (`image-jpeg` / `image-png` / `image-svg` / `image-gif` / `video-mp4`) paired with the cover media URL field
   - New-note route (`/admin/notes/new`): optional cover/inline file picks are staged locally (`blob:` preview URLs) and not uploaded immediately
   - On `Create note`, staged files call `POST /api/admin/media/upload-url`, upload to Railway Bucket via presigned `PUT`, then replace staged URLs with stable `/api/admin/media/access-url?key=...` paths before the form action posts
   - Edit route (`/admin/notes/[slug]/edit`): optional cover/inline uploads still use immediate presigned upload and URL insertion
2. Browser submits a SvelteKit form action (create or update) to the admin +page.server.ts handler
3. Auth.js session verified by middleware before the handler runs
4. Create actions generate the slug from the title with `slugify.ts`; edit actions keep the slug immutable and patch the note row in the notes table through `db/notes.ts` helpers, which also sync wiki-link rows when the body changes
5. Form action calls `reindexNoteAfterSave()` to regenerate semantic indexes in fail-soft mode:
   - Note-level: calls `embedText(body)` and stores the result in `notes.embedding` only after the fresh note vector is generated successfully
   - Chunk-level: splits body into section/paragraph chunks, builds metadata-enriched embedding payloads (`title`, `category`, `tags`, `series` + chunk text), embeds each chunk, then calls `replaceNoteChunks()` only after every chunk embedding is ready
   - Success records `semantic_index_status = 'current'`, clears `semantic_index_error`, writes `semantic_indexed_at`, and records `semantic_index_source_updated_at` from the saved note row's `updated_at` without advancing the content `updated_at`
6. If embedding calls fail or return malformed data, the action logs the error, preserves the previous note-level vector and chunk rows, records `semantic_index_status = 'failed'` plus an error message/source timestamp, and still completes the note save. Admin server loads shape these fields through `getSemanticIndexDisplay()` so `/admin` and `/admin/notes/[slug]/edit` warn when an index is pending, failed, or older than the saved note content; save and publish actions remain available while the warning is visible.
7. Form action calls SvelteKit redirect() to send the browser to /admin/notes/[slug]/edit
8. Browser navigates to the edit page
```

**Cover media and publication metadata:** The `image` column on the `notes` table stores either a pasted external URL or a stable app access path (`/api/admin/media/access-url?key=...`) generated after first-party upload. The `media_type` column stores one of `image-jpeg`, `image-png`, `image-svg`, `image-gif`, or `video-mp4` and defaults to `image-jpeg`. `published_at` and `series` store optional admin-entered publication metadata. First-party uploads use Railway Storage Buckets with short-lived presigned `PUT` URLs from `POST /api/admin/media/upload-url`, then render through short-lived presigned `GET` redirects from `GET /api/admin/media/access-url?key=...`. Public note surfaces dispatch by `media_type`: image types render with `<img>`, `video-mp4` renders with `<video controls preload="metadata">` (no autoplay), and cover containers enforce `aspect-ratio: 16/9`. If `image` is unset, no placeholder media is rendered. Bucket objects remain private; no permanent public bucket URLs are assumed.

**Inline body media embeds:** Markdown bodies may include `{{media ...}}` tokens for inline assets. Tokens are transformed in both admin preview and public note rendering by the shared `remarkInlineMediaEmbeds()` pass (`src/lib/utils/inline-media.ts`) before markdown is serialized to HTML. Supported keys are `src`, `type` (`image|video`), `align` (`left|center|wide`), `caption`, and `alt`; `.mp4` URLs infer `video` when `type` is omitted.

### Admin live preview flow (split-pane)

```
1. Admin types in the left CodeMirror pane
2. CodeMirror update listener syncs the full markdown string to Svelte `body` state
3. Preview pipeline transforms `body` locally via `renderPreview(body, resolvedSlugs)` in `src/lib/utils/markdown-preview.ts`:
   - applies `renderWikiLinks()` to convert `[[slug]]`/`[[slug|text]]` wiki-links (resolved → anchor; unresolved → `<span class="wiki-link-missing">`)
   - applies `remarkInlineMediaEmbeds()` to convert `{{media ...}}` tokens into semantic figure/img/video nodes
   - renders the resulting markdown to HTML using unified (remark-parse → remark-gfm → remark-rehype → rehype-stringify); no rehype-shiki (code is unhighlighted in preview — acceptable parity boundary)
   - returns a `PreviewResult`; on failure (`ok: false`) renders a non-blocking error notice
4. Preview pane updates immediately without route navigation, form submission, or API calls
5. If preview transform fails, editor input remains fully functional and save/publish actions are unaffected
```

**Preview fidelity boundary:** Admin live preview targets fast author feedback for structure and links (headings, lists, emphasis, blockquotes, tables, wiki-links). Minor visual differences versus the public note renderer (for example server-side code highlighting details) are acceptable.

### Note review flow (admin, optional)

```
1. Admin clicks Review in either /admin/notes/new or /admin/notes/[slug]/edit
2. Frontend POSTs { title, takeaway, body } to POST /api/admin/notes/review
3. API route validates payload and calls ai/review.ts with a free-tier OpenRouter model
4. OpenRouter streams critique tokens; API route forwards the stream to the client as SSE
5. Frontend renders compact structured critique and keeps Save Draft/Publish fully independent
6. On upstream 429/503, client shows a visible error; no note data is mutated
```

The review UI is shared between both admin editors via `src/lib/components/admin/NoteReviewPanel.svelte`. Streaming transport/parsing lives in the client-safe utility `src/lib/utils/note-review.ts`, which consumes SSE tokens and updates panel state without touching save/publish flows.

### Admin quality warning flow

Editor-page quality checks are advisory only and split across a client-safe helper and a server-only composer so the same logic stays live while typing and reusable for any future server-only consumer:

- `getContentQualityWarnings()` (`src/lib/utils/quality-warnings.ts`) is a pure, client-safe mapper over current (possibly unsaved) `{ title, takeaway, body }` form state. It returns `missing-takeaway`, `no-internal-links` (zero `parseWikiLinks()` matches), and `weak-title` (via the deterministic `isWeakTitle()` heuristic: blank/too-short/single-word/placeholder-pattern, no LLM call) warnings. It has no `$lib/server` import, so it is called directly from `src/lib/components/admin/QualityWarningsPanel.svelte` and recomputes on every keystroke.
- `getNoteQualityWarnings()` (`src/lib/server/admin/quality-warnings.ts`) composes the same content warnings with a `semantic-index` warning reused from `getSemanticIndexDisplay()` (stale/failed/pending state derived from saved DB timestamps). It remains the full server-side mapper for any consumer that only has saved note state (e.g. a future admin list view).

`QualityWarningsPanel` renders inside `/admin/notes/new` and `/admin/notes/[slug]/edit` near the existing editor/status surfaces. The `new` editor has no saved note yet, so it only ever shows live content warnings; the `edit` editor additionally receives the semantic-index warning from its route `load` (computed once per page load from saved state, since that state doesn't change between saves) alongside the live content warnings. Save Draft and Publish remain available when warnings are present.

### Agent authoring flow (`/write-post`, local, draft-only)

```
1. Author runs /write-post with a topic ("Let's do a post on X") and any targeting notes
2. Skill loads docs/VOICE.md, the category list, and existing note slugs (link targets) through `listNotes()`; if slugs cannot be loaded, it stops before drafting
3. Skill runs an extensive interview:
   - structured AskUserQuestion batches (angle, scope, audience, category/tags/series,
     length, which existing notes to link, where outside knowledge is welcome vs off-limits)
   - free-form follow-ups to capture the factual spine (claims, anecdotes, code) in the author's words
4. Skill drafts the full note in the canonical voice, grounded in the interview answers:
   - emits [[slug]] only for slugs that already exist; collects any named-but-missing targets
   - marks every passage drawing on outside (non-author) knowledge for the report
5. Skill calls the draft-review scorer (ai/draft-review.ts) → 0–100 score + per-dimension
   breakdown + flagged lines; the score is shown, never used to block (DECISIONS.md OPEN-01)
6. Skill invokes scripts/create-note.js with the draft payload:
   - slug generated via slugify; status HARD-FORCED to 'draft'
   - createNote() inserts the row and syncs [[...]] links into note_links
   - reindexNoteAfterSave() generates the note-level embedding and section/paragraph chunks
7. Skill verifies the saved draft via the app query layer: draft status, note-level embedding,
   semantic index status, chunk count, and outlink count
8. Skill reports to the terminal: slug, /admin/notes/<slug>/edit URL, review score,
   semantic index state, a "verify before publish" checklist of flagged outside-knowledge
   passages, any [[links]] whose targets don't exist yet, and suggested spots to add media manually
9. Author opens the draft in the admin editor to review, add images/media, and publish
```

This lane reuses the exact note-save pipeline (`createNote` + `reindexNoteAfterSave`), so an agent-authored draft is indistinguishable from a hand-authored one once saved — same wiki-link graph, same embeddings, same chunks. The only difference is the authoring surface. Nothing on this path publishes; publishing remains a deliberate human action in `/admin`.

### Wiki-link data model

Note bodies use Obsidian-style `[[slug]]` or `[[slug|display text]]` syntax to link between notes. These are stored as rows in the `note_links` table on every save:

- `source_slug` — the note being saved (FK → notes.slug, CASCADE DELETE)
- `target_slug` — the linked note slug (soft reference; target may not exist yet)
- `link_text` — display text when different from slug (null otherwise)

`getBacklinks(slug)` returns all notes that link to a given note. `getOutlinks(slug)` returns all links from a given note with their resolved `Note` objects (or null for unresolved). `renderWikiLinks(body, resolvedSlugs)` converts wiki-link syntax to markdown links (for resolved targets) or `<span class="wiki-link-missing">` (for forward references).

### Reader path model

Note detail pages combine two kinds of reader paths:

- semantic related notes, generated from `getRelatedNotes(slug, limit)` (note-level embedding cosine distance via pgvector, published notes only, current note excluded) and shown as relevance-based next reads
- explicit graph paths, generated from `getBacklinks()` and `getOutlinks()` so visitors can see how the author's notes reference each other

These paths are derived from published notes only on public pages. They should be explainable in UI labels without exposing implementation details such as vector distances.

---

## Auth Model

| Actor | Auth mechanism | What they can access |
|---|---|---|
| Anonymous visitor | None (no session) | All public routes and `POST /api/chat` |
| Admin (site author) | GitHub OAuth via Auth.js | All `/admin/**` routes and `/api/admin/**` endpoints |

**Credential issuance:** The author signs in via GitHub OAuth. Auth.js validates the OAuth callback and issues a **stateless JWT session** (no DrizzleAdapter; no database session storage). Sessions are signed with `AUTH_SECRET` and stored in an HTTP-only cookie. Only the author's specific GitHub account should be permitted — enforced via an Auth.js callback that checks the GitHub user identity.

**`trustHost` handling:** `AUTH_TRUST_HOST` is NOT set on Railway. In this codebase (`@auth/sveltekit@1.0.0`), `src/auth.ts` sets `trustHost: true` explicitly to avoid production host validation failures. Never set `trustHost: Boolean(env.AUTH_TRUST_HOST)` — that can force `false` in production and break OAuth callbacks.

**`AUTH_URL` handling:** If `AUTH_URL` is set in Railway, it must be the site origin only (for example `https://glass-atlas-production.up.railway.app`) with no `/auth` suffix. Including a path causes Auth.js `env-url-basepath-redundant` warnings and can route actions incorrectly (`UnknownAction`).

**Credential verification:** `src/hooks.server.ts` calls `event.locals.auth()` on every `/admin/**` request. Any request to an `/admin` or `/api/admin` path without a valid session is redirected to `/signin` (the custom sign-in page that posts into Auth.js OAuth actions). No `/admin` route handler is ever reached without a confirmed session.

**Visitor chat sessions:** Visitor identity for rate limiting is an anonymous browser cookie (`chat_session`) generated server-side and stored as an opaque random token. Chat history is not persisted in Phase 1 — it lives exclusively in the `Chat.svelte` component's `$state` and clears on page reload. The `conversations` and `messages` tables exist in the schema and are reserved for a future persistence phase. Chat quota persistence uses `chat_rate_limits.session_hash` (hash only, never raw token) with atomic window-reset/increment logic in `consumeChatRateLimit`, and `/api/chat` issues/reads the cookie before retrieval and LLM calls. Clearing cookies can reset quota; this is an accepted no-login tradeoff. The only other chat-related data written per request is `citation_events` rows (one per note retrieved by the RAG search), which power the landing page "total citations served" stat.

---

## External Dependencies

| Dependency | Role | Required | Notes |
|---|---|---|---|
| Neon PostgreSQL | Primary database (notes, conversations, messages, auth tables) | Yes | Accessed via Neon serverless HTTP driver; pgvector extension required for embedding storage and cosine similarity search |
| Railway Storage Buckets | First-party note media object storage | Yes | Private-only buckets; media served via presigned URLs by default; browser upload requires bucket CORS configuration for app origins |
| OpenRouter API | LLM completions (streaming) + embedding generation | Yes | Default model: `google/gemma-4-31b-it:free`; embedding model: `text-embedding-3-small` (vector dimension: 1536) |
| GitHub OAuth | Admin authentication provider | Yes | Only the author's GitHub account is permitted; OAuth app credentials stored as environment variables |
| Railway | Hosting, persistent Bun HTTP server | Yes | Auto-deploys on push to `main` via GitHub integration; Hobby plan (~$5/mo) |

---

## Deployment Targets

| Environment | Hosting | Database | Notes |
|---|---|---|---|
| Production | Railway (auto-deploy on push to `main`) | Neon production project, `glass_atlas` schema | Environment variables set in Railway dashboard; secrets never in source |
| Local development | `localhost:5173` (SvelteKit dev server) | Neon dev branch or local PostgreSQL with pgvector | `.env.local` holds secrets; never committed |

---

## Constraints

- All external I/O — database queries, LLM calls, and embedding generation — must occur in server-side modules under `src/lib/server/` or in server-only route handlers. Client components must never import these modules or hold credentials.
- Embeddings are generated at write time (note save/update only). The only real-time embedding call per request is the query embedding in `POST /api/chat`. Note body embeddings are never recomputed at query time.
- Auth middleware in `src/hooks.server.ts` must run before any `/admin` route handler or `/api/admin/**` handler is executed. There are no client-side-only access guards — all enforcement is server-side.
- `POST /api/chat` is rate-limited to 10 messages per anonymous browser session per hour to protect OpenRouter API costs. The session ID is an opaque cookie; only its hash is stored server-side. The limit check is enforced in the API route handler before any embedding or LLM call is made.
- The LLM system prompt personality block lives exclusively in `src/lib/server/personality.ts`. It must never be inlined directly into chat logic or any other file.
- LLM responses must be strictly grounded in the notes retrieved by the vector search. The system prompt must include an explicit guardrail instructing the model not to answer from general knowledge when the retrieved notes do not support the answer. Borderline-confidence prompts may use the LLM for a natural limited-coverage response, but must frame adjacent evidence honestly instead of presenting it as an exact answer.
- Lightweight social turns are handled by an allowlisted template path before retrieval/LLM invocation. This path must stay non-factual and must not be expanded into general-purpose question answering.
- The server is a persistent process — in-memory state survives between requests on the same instance. Any state that must survive across deploys (conversation history, note data) is stored in Neon. Do not rely on in-memory state for correctness if horizontal scaling is ever introduced.
- All database schema changes must be applied via Drizzle ORM migrations (`drizzle-kit`). Direct `ALTER TABLE` statements against the Neon database are not permitted. Any task that introduces a schema change must generate the migration and apply it to the production Neon database in the same task before being marked done. In WSL2 and non-interactive CI environments where `drizzle-kit migrate` hangs (websocket limitation), use `npm run db:migrate:http` (`scripts/migrate.js`) instead — it applies the same migrations via the Neon HTTP driver.
- All secrets (Neon connection string, OpenRouter API key, GitHub OAuth client ID/secret, Auth.js secret) are read exclusively from environment variables. No secret value may appear in source code or be committed to version control.
