# Architecture — Glass Atlas

## Overview

Glass Atlas is a SvelteKit-based editorial site where the author publishes notes (markdown content) and visitors can explore them via browse/search or through an LLM-powered chat interface. All server-side logic runs as a persistent Bun HTTP server deployed on Railway (SvelteKit node adapter); the database is Neon PostgreSQL with the pgvector extension for semantic search, using the `glass_atlas` Postgres schema. Admin authoring is gated behind GitHub OAuth via Auth.js; all visitor interactions, including chat, are anonymous.

---

## System Topology

| Service | Where it runs |
|---|---|
| SvelteKit app (UI + API routes) | Railway (persistent Bun HTTP server; SvelteKit node adapter; auto-deploy on push to `main`) |
| PostgreSQL database (notes, citation_events, conversations, messages, Auth.js tables) | Neon (serverless HTTP driver; `glass_atlas` Postgres schema; production project + dev branch) |
| Object storage (note media uploads) | Railway Storage Buckets (private, S3-compatible; presigned URL upload + delivery) |
| LLM inference (chat completions, streaming) | OpenRouter API (remote, HTTP) |
| Embedding generation (query + note body vectors) | OpenRouter API (remote, HTTP) |
| GitHub OAuth provider | GitHub (remote, HTTP) |
| Local development server | localhost:5173 (SvelteKit dev server) |

The server is a persistent Bun process. In-memory state survives between requests on the same instance. Any state that must survive across deploys (conversation history, note data) is stored in Neon.

---

## Component Responsibilities

### SvelteKit route handlers (`src/routes/`)

- Render public pages: landing (`/`), notes list (`/notes`), note detail (`/notes/[slug]`)
- Render admin pages: dashboard (`/admin`), new note form, edit/delete note forms
- Own the request/response boundary; delegate all business logic to server-side lib modules

**Does not:** contain any direct database queries, LLM calls, or embedding logic — those live in `src/lib/server/`

### Server-side lib (`src/lib/server/`)

- `db/index.ts` — Drizzle ORM client wired to the Neon HTTP driver; all SQL goes through here
- `db/schema.ts` — Drizzle table definitions: `notes`, `note_links`, `citation_events`, Auth.js tables
- `db/notes.ts` — note CRUD helpers: `createNote`, `updateNote`, `deleteNote`, `getNoteBySlug`, `getPublishedNotes`, `findSimilarNotes` (pgvector cosine), `getBacklinks`, `getOutlinks`, `syncNoteLinks`
- `chat.ts` — builds the RAG prompt, calls OpenRouter for streaming completions, returns a `ReadableStream`
- `embeddings.ts` — calls OpenRouter embedding endpoint; returns `vector(1536)`
- `personality.ts` — exports the system prompt personality block as a string constant; never inlined elsewhere
- `ai/review.ts` — builds the note critique prompt, calls a free-tier OpenRouter model, returns a `ReadableStream`; never reads from or writes to the database

**Does not:** run in the browser; none of these modules are imported by client components

### API routes

- `POST /api/chat` — public; accepts `{ query, session_id, conversation_id? }`; embeds query, runs cosine similarity search, streams LLM response via SSE; rate-limited to 10 messages per IP per hour
- `POST /api/admin/notes/[slug]/review` — admin-only; accepts the current note body; calls `ai/review.ts`; streams critique via SSE; does not read from or write to the database; free-tier OpenRouter model; returns `429` or `503` transparently when the model is unavailable

Admin note create, update, and delete are handled by **SvelteKit form actions** in `+page.server.ts` files (not API routes). Form actions are the correct pattern for these mutations: they use progressive enhancement, integrate with SvelteKit's redirect flow, and do not require a separate client-side fetch.

### Auth middleware (`src/hooks.server.ts`)

- Runs before every `/admin` route and `/api/admin/**` handler
- Verifies the Auth.js session and rejects unauthenticated requests with a redirect to the OAuth flow
- All other routes pass through without auth checks

### Client components (`src/lib/components/`)

- Render UI only; send fetch/SSE requests to API routes
- Chat component manages optimistic UI state ("searching notes…"), token streaming, and citation link rendering
- `MarkdownEditor.svelte` — CodeMirror 6 split-pane editor for the admin note form; left pane is the CodeMirror instance (initialized via `onMount`, torn down in `$effect` cleanup); right pane is a reactive preview rendered with `renderWikiLinks()`; note slug list for `[[` autocomplete is injected as a prop from `+page.server.ts`
- No direct access to DB, LLM, or secrets

---

## Data Flow

### RAG chat flow (public)

```
1. User submits query in the chat UI
2. Frontend shows "searching notes..." (optimistic UI state)
3. Frontend POSTs { query, session_id, conversation_id? } to POST /api/chat
4. API route embeds the query → vector(1536) via OpenRouter embedding API (~300 ms)
5. API route runs pgvector cosine similarity search against notes.embedding
   → returns top 5 published notes (10–50 ms)
6. API route builds the LLM prompt:
     [personality block from personality.ts]
     + [Takeaway + first paragraph of each retrieved note] (not full body)
     + [prior conversation messages for this session]
7. API route calls OpenRouter (google/gemini-2.0-flash-001) with stream: true
8. OpenRouter streams tokens → API route pipes them as SSE to the frontend
9. Frontend renders tokens as they arrive
10. Before starting the stream, API route calls recordCitations(citedSlugs) to insert
    citation_events rows for each retrieved note slug (fire-and-forget; does not block streaming)
11. Frontend appends citation links for cited note slugs
```

**Latency strategy:** Streaming is the primary UX fix for perceived latency. Gemini Flash targets ~400–600 ms TTFT. Prompt size is kept small by sending only the Takeaway + first paragraph of each note rather than full bodies.

### Note save flow (admin)

```
1. Admin submits the note form in the browser
2. Browser submits a SvelteKit form action (create or update) to the admin +page.server.ts handler
3. Auth.js session verified by middleware before the handler runs
4. Form action upserts the note row in the notes table (Drizzle ORM)
5. Form action calls OpenRouter embedding endpoint with the full note body
   → receives vector(1536)
6. Form action stores the embedding in notes.embedding for the upserted row
7. db/notes.ts syncNoteLinks() parses [[slug]] / [[slug|text]] wiki-links from
   the body, deletes prior outgoing links for this note, and re-inserts into note_links
8. Form action calls SvelteKit redirect() to send the browser to /admin/notes/[slug]/edit
9. Browser navigates to the edit page
```

**Cover media:** The `image` column on the `notes` table stores a plain URL. Asset storage strategy is resolved: first-party uploads use Railway Storage Buckets with presigned URLs (private bucket, direct browser upload, presigned GET for public delivery; backend proxy only when transformation/access control is required). The current admin flow still accepts pasted URLs; upload UI/API wiring is planned work. Supported media formats are fixed to JPEG, PNG, SVG, GIF, and MP4 video (`<video controls>`, no autoplay).

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

**Visitor chat sessions:** Chat history is not persisted in Phase 1 — it lives exclusively in the `Chat.svelte` component's `$state` and clears on page reload. The `conversations` and `messages` tables exist in the schema and are reserved for a future persistence phase. The only chat-related data written to the database per request is citation_events rows (one per note retrieved by the RAG search), which power the landing page "total citations served" stat.

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
- `POST /api/chat` is rate-limited to 10 messages per IP per hour to protect OpenRouter API costs. This limit is enforced in the API route handler before any embedding or LLM call is made.
- The LLM system prompt personality block lives exclusively in `src/lib/server/personality.ts`. It must never be inlined directly into chat logic or any other file.
- LLM responses must be strictly grounded in the notes retrieved by the vector search. The system prompt must include an explicit guardrail instructing the model not to answer from general knowledge when the retrieved notes do not support the answer.
- The server is a persistent process — in-memory state survives between requests on the same instance. Any state that must survive across deploys (conversation history, note data) is stored in Neon. Do not rely on in-memory state for correctness if horizontal scaling is ever introduced.
- All database schema changes must be applied via Drizzle ORM migrations (`drizzle-kit`). Direct `ALTER TABLE` statements against the Neon database are not permitted. In WSL2 and non-interactive CI environments where `drizzle-kit migrate` hangs (websocket limitation), use `npm run db:migrate:http` (`scripts/migrate.js`) instead — it applies the same migrations via the Neon HTTP driver.
- All secrets (Neon connection string, OpenRouter API key, GitHub OAuth client ID/secret, Auth.js secret) are read exclusively from environment variables. No secret value may appear in source code or be committed to version control.
