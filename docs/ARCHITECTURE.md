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

- Render public pages: landing (`/`), notes list (`/notes`), note detail (`/notes/[slug]`). The landing `+page.server.ts` loads live homepage metrics (published note count, distinct topic count, average words per published note, total citations served) and the 3 most recent published notes via `db/notes.ts` helpers.
- Render admin pages: dashboard (`/admin`), new note form, edit/delete note forms. The `/admin` dashboard loads all notes with `listNotes()` and deletes rows through a named SvelteKit form action that calls `deleteNote(slug)`. The new note form posts to a named `create` action, generates the slug from the title with `slugify.ts`, calls `createNote()`, attempts to generate/store an embedding, and redirects to `/admin/notes/[slug]/edit`. The edit form loads the existing note with `getNoteBySlug(slug)`, saves field patches through `updateNote(slug, data)`, regenerates the embedding after Save Draft/Publish, preserves status on Save Draft, and sets `status: 'published'` only through the Publish action.
- Own the request/response boundary; delegate all business logic to server-side lib modules

**Does not:** contain any direct database queries, LLM HTTP clients, or embedding HTTP clients — those live in `src/lib/server/`

### Server-side lib (`src/lib/server/`)

- `db/index.ts` — Drizzle ORM client wired to the Neon HTTP driver; all SQL goes through here
- `db/schema.ts` — Drizzle table definitions: `notes`, `note_chunks`, `note_links`, `citation_events`, Auth.js tables
- `db/notes.ts` — note CRUD helpers: `listNotes(filter?)`, `getNoteBySlug`, `createNote`, `updateNote`, `deleteNote`, `getBacklinks`, `getOutlinks`; RAG helpers: `searchNotesBySimilarity` (published notes ordered by pgvector cosine distance), `replaceNoteChunks`, `searchChunksBySimilarity`, `recordCitations`, `getTotalCitations`; chat quota helper: `consumeChatRateLimit` (atomic window-reset + increment keyed by `chat_rate_limits.session_hash`). Exports plain-object types `Note`, `CreateNoteInput`, `UpdateNoteInput`, including note metadata (`image`, `mediaType`, `publishedAt`, `series`).
- `chat.ts` — builds the RAG prompt, calls OpenRouter for streaming completions, returns a `ReadableStream`
- `embeddings.ts` — calls the OpenRouter-compatible `/embeddings` endpoint with `OPENROUTER_API_KEY` from `$env/dynamic/private`; provides note-level embeddings plus section-aware chunk generation/payload helpers for `note_chunks` indexing
- `personality.ts` — exports the system prompt personality block as a string constant; never inlined elsewhere
- `ai/review.ts` — builds the note critique prompt from `{ title, takeaway, body }`, calls a free-tier OpenRouter model, returns a `ReadableStream`; never reads from or writes to the database

**Does not:** run in the browser; none of these modules are imported by client components

### API routes

- `POST /api/chat` — public; accepts `{ message }`; reads/sets an anonymous `chat_session` cookie, enforces 10 messages per hour per anonymous browser session, embeds query, runs cosine similarity search, streams LLM response via SSE
- `POST /api/admin/media/upload-url` — admin-only; accepts `{ filename, contentType }`; validates MIME allowlist (`image/jpeg`, `image/png`, `image/svg+xml`, `image/gif`, `video/mp4`) and returns a short-lived presigned `PUT` URL for direct browser upload to Railway Buckets
- `GET /api/admin/media/access-url?key=...` — public redirect endpoint; converts a stored object key into a short-lived presigned `GET` URL so bucket objects remain private while note media stays embeddable from stable app URLs
- `POST /api/admin/notes/review` — admin-only; accepts `{ title, takeaway, body }` from current editor state (new or edit page); calls `ai/review.ts`; streams critique via SSE; does not read from or write to the database; free-tier OpenRouter model; returns `429` or `503` transparently when the model is unavailable

Admin note create, update, and delete are handled by **SvelteKit form actions** in `+page.server.ts` files (not API routes). Form actions are the correct pattern for these mutations: they use progressive enhancement, integrate with SvelteKit's redirect flow, and do not require a separate client-side fetch.

### Auth middleware (`src/hooks.server.ts`)

- Runs before every `/admin` route and `/api/admin/**` handler
- Verifies the Auth.js session and rejects unauthenticated requests with a redirect to the OAuth flow
- All other routes pass through without auth checks

### Client components (`src/lib/components/`)

- Render UI only; send fetch/SSE requests to API routes
- `Nav.svelte` — global navigation shell rendered in `+layout.svelte` on every page. Receives `session` prop from `+layout.server.ts` (loaded via `event.locals.auth()`). Dark mode toggle reads `localStorage('ga-theme')` on mount (falls back to `prefers-color-scheme`), persists the preference, and applies/removes a `.dark` class on `<html>`. Login/logout uses Auth.js sign-in (`/auth/signin`) and sign-out form action (`/auth/signout`). Search icon links to `/notes?focus=search`, which opens the notes index and auto-focuses the search field.
- Chat component manages optimistic UI state ("searching notes…"), token streaming, and citation link rendering
- `MarkdownEditor.svelte` — CodeMirror 6 split-pane editor for admin note forms (`/admin/notes/new` and `/admin/notes/[slug]/edit`); left pane is the CodeMirror instance (initialized via `onMount`, torn down in cleanup), right pane is a live preview that updates while typing (`body` state -> wiki-link transform -> markdown-to-HTML render). No network calls are made on keystrokes. Note slug list for `[[` autocomplete/preview resolution is injected from `+page.server.ts` data loaded once per page request
- Admin note editors expose a manual `Review` action that streams optional critique and never blocks save/publish actions
- No direct access to DB, LLM, or secrets

---

## Data Flow

### RAG chat flow (public, approved target state)

Current production remains note-level semantic retrieval. The sequence below describes the approved retrieval orchestration target after the CHAT-04 task chain ships.

```
1. User submits query in the chat UI
2. Frontend shows "searching notes..." (optimistic UI state)
3. Frontend POSTs `{ message }` to `POST /api/chat`; browser sends the existing `chat_session` cookie automatically
4. API route embeds the query → vector(1536) via OpenRouter embedding API (~300 ms)
5. API route runs retrieval:
   - semantic similarity search (current: note-level embeddings; target: chunk-level embeddings)
   - lightweight topic/lexical match query (title/tags/category)
   - both queries run in parallel, then results are fused/reranked into a bounded candidate set
6. API route builds the LLM prompt:
     [personality block from personality.ts]
     + [Takeaway + first paragraph of each retrieved note] (not full body)
     + [prior conversation messages for this session]
7. API route applies confidence gating:
   - sufficient coverage: direct first-person answer grounded in retrieved context
   - insufficient coverage: explicit limited-coverage response + related-topic note links
8. API route calls OpenRouter (google/gemini-2.0-flash-001) with `stream: true`
9. OpenRouter streams tokens → API route pipes them as SSE to the frontend
10. Frontend renders tokens as they arrive
11. Before starting the stream, API route calls `recordCitations(citedSlugs)` to insert
    citation_events rows for each retrieved note slug (fire-and-forget; does not block streaming)
12. Frontend renders italicized related-note links in the assistant output
```

**Latency strategy:** Streaming is the primary UX fix for perceived latency. Gemini Flash targets ~400–600 ms TTFT. Retrieval remains bounded by small `k` limits and parallel query execution (semantic + lexical/topic) so hybrid precision gains do not create outsized latency overhead. Prompt size stays compact (note summary + bounded evidence excerpts), not full bodies.

**Approved next retrieval direction (partially implemented):** Section-aware chunk storage and retrieval primitives are now in place (`note_chunks`, `replaceNoteChunks`, `searchChunksBySimilarity`), but `/api/chat` orchestration still uses note-level semantic retrieval in production. Hybrid fuse/rerank and confidence-gated fallback behavior are still queued in later CHAT tasks (see `RESOLVED-16` and `RESOLVED-18` in `docs/DECISIONS.md`).

### Note save flow (admin)

```
1. Admin submits the note form in the browser
   - Cover media controls include a `media_type` selector (`image-jpeg` / `image-png` / `image-svg` / `image-gif` / `video-mp4`) paired with the cover media URL field
   - Optional: cover media file upload calls `POST /api/admin/media/upload-url`, uploads directly to Railway Bucket via presigned `PUT`, then writes `/api/admin/media/access-url?key=...` into the form `image` field
2. Browser submits a SvelteKit form action (create or update) to the admin +page.server.ts handler
3. Auth.js session verified by middleware before the handler runs
4. Create actions generate the slug from the title with `slugify.ts`; edit actions keep the slug immutable and patch the note row in the notes table through `db/notes.ts` helpers, which also sync wiki-link rows when the body changes
5. Form action regenerates semantic indexes in fail-soft mode:
   - Note-level: calls `embedText(body)` and stores the result in `notes.embedding` with a follow-up `updateNote()`
   - Chunk-level: splits body into section/paragraph chunks, builds metadata-enriched embedding payloads (`title`, `category`, `tags`, `series` + chunk text), embeds each chunk, then upserts the full chunk set via `replaceNoteChunks()`
6. If embedding calls fail or return malformed data, the action logs the error and still completes the note save. Note-level fallback writes `embedding: null`; chunk-level fallback skips chunk replacement to avoid partial row churn.
7. Form action calls SvelteKit redirect() to send the browser to /admin/notes/[slug]/edit
8. Browser navigates to the edit page
```

**Cover media and publication metadata:** The `image` column on the `notes` table stores either a pasted external URL or a stable app access path (`/api/admin/media/access-url?key=...`) generated after first-party upload. The `media_type` column stores one of `image-jpeg`, `image-png`, `image-svg`, `image-gif`, or `video-mp4` and defaults to `image-jpeg`. `published_at` and `series` store optional admin-entered publication metadata. First-party uploads use Railway Storage Buckets with short-lived presigned `PUT` URLs from `POST /api/admin/media/upload-url`, then render through short-lived presigned `GET` redirects from `GET /api/admin/media/access-url?key=...`. Public note surfaces dispatch by `media_type`: image types render with `<img>`, `video-mp4` renders with `<video controls preload="metadata">` (no autoplay), and cover containers enforce `aspect-ratio: 16/9`. If `image` is unset, no placeholder media is rendered. Bucket objects remain private; no permanent public bucket URLs are assumed.

### Admin live preview flow (split-pane)

```
1. Admin types in the left CodeMirror pane
2. CodeMirror update listener syncs the full markdown string to Svelte `body` state
3. Preview pipeline transforms `body` locally via `renderPreview(body, resolvedSlugs)` in `src/lib/utils/markdown-preview.ts`:
   - applies `renderWikiLinks()` to convert `[[slug]]`/`[[slug|text]]` wiki-links (resolved → anchor; unresolved → `<span class="wiki-link-missing">`)
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

### Wiki-link data model

Note bodies use Obsidian-style `[[slug]]` or `[[slug|display text]]` syntax to link between notes. These are stored as rows in the `note_links` table on every save:

- `source_slug` — the note being saved (FK → notes.slug, CASCADE DELETE)
- `target_slug` — the linked note slug (soft reference; target may not exist yet)
- `link_text` — display text when different from slug (null otherwise)

`getBacklinks(slug)` returns all notes that link to a given note. `getOutlinks(slug)` returns all links from a given note with their resolved `Note` objects (or null for unresolved). `renderWikiLinks(body, resolvedSlugs)` converts wiki-link syntax to markdown links (for resolved targets) or `<span class="wiki-link-missing">` (for forward references).

---

## Auth Model

| Actor | Auth mechanism | What they can access |
|---|---|---|
| Anonymous visitor | None (no session) | All public routes and `POST /api/chat` |
| Admin (site author) | GitHub OAuth via Auth.js | All `/admin/**` routes and `/api/admin/**` endpoints |

**Credential issuance:** The author signs in via GitHub OAuth. Auth.js validates the OAuth callback and issues a **stateless JWT session** (no DrizzleAdapter; no database session storage). Sessions are signed with `AUTH_SECRET` and stored in an HTTP-only cookie. Only the author's specific GitHub account should be permitted — enforced via an Auth.js callback that checks the GitHub user identity.

**`trustHost` handling:** `AUTH_TRUST_HOST` is NOT set on Railway. The `trustHost` option is not set explicitly in `src/auth.ts` — the SvelteKit Auth.js adapter sets it via its own defaults (`true` in the actions path, `dev` in the session path), which is correct for Railway's reverse-proxy environment. Never set `trustHost: Boolean(env.AUTH_TRUST_HOST)` — that would force `false` in production and break the OAuth callback.

**Credential verification:** `src/hooks.server.ts` calls `event.locals.auth()` on every `/admin/**` request. Any request to an `/admin` or `/api/admin` path without a valid session is redirected to `/auth/signin` (the Auth.js sign-in page, which initiates the GitHub OAuth flow). No `/admin` route handler is ever reached without a confirmed session.

**Visitor chat sessions:** Visitor identity for rate limiting is an anonymous browser cookie (`chat_session`) generated server-side and stored as an opaque random token. Chat history is not persisted in Phase 1 — it lives exclusively in the `Chat.svelte` component's `$state` and clears on page reload. The `conversations` and `messages` tables exist in the schema and are reserved for a future persistence phase. Chat quota persistence uses `chat_rate_limits.session_hash` (hash only, never raw token) with atomic window-reset/increment logic in `consumeChatRateLimit`, and `/api/chat` issues/reads the cookie before retrieval and LLM calls. Clearing cookies can reset quota; this is an accepted no-login tradeoff. The only other chat-related data written per request is `citation_events` rows (one per note retrieved by the RAG search), which power the landing page "total citations served" stat.

---

## External Dependencies

| Dependency | Role | Required | Notes |
|---|---|---|---|
| Neon PostgreSQL | Primary database (notes, conversations, messages, auth tables) | Yes | Accessed via Neon serverless HTTP driver; pgvector extension required for embedding storage and cosine similarity search |
| Railway Storage Buckets | First-party note media object storage | Planned | Private-only buckets; media served via presigned URLs by default |
| OpenRouter API | LLM completions (streaming) + embedding generation | Yes | Default model: `google/gemini-2.0-flash-001`; embedding model: `text-embedding-3-small` (vector dimension: 1536) |
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
- LLM responses must be strictly grounded in the notes retrieved by the vector search. The system prompt must include an explicit guardrail instructing the model not to answer from general knowledge when the retrieved notes do not support the answer.
- The server is a persistent process — in-memory state survives between requests on the same instance. Any state that must survive across deploys (conversation history, note data) is stored in Neon. Do not rely on in-memory state for correctness if horizontal scaling is ever introduced.
- All database schema changes must be applied via Drizzle ORM migrations (`drizzle-kit`). Direct `ALTER TABLE` statements against the Neon database are not permitted. In WSL2 and non-interactive CI environments where `drizzle-kit migrate` hangs (websocket limitation), use `npm run db:migrate:http` (`scripts/migrate.js`) instead — it applies the same migrations via the Neon HTTP driver.
- All secrets (Neon connection string, OpenRouter API key, GitHub OAuth client ID/secret, Auth.js secret) are read exclusively from environment variables. No secret value may appear in source code or be committed to version control.
