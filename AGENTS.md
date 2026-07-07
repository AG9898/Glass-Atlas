# Glass Atlas — Agent Working Guide

<!-- AGENTS.md is the canonical file. CLAUDE.md is a symlink to it.              -->
<!-- To set up after copying this file: ln -sf AGENTS.md CLAUDE.md               -->
<!-- This file is a LIVING DOCUMENT — update it after every task cycle.          -->

---

## Overview

Glass Atlas is a blog/editorial SvelteKit site where the primary content is structured knowledge notes written by the author. Agents implement workboard tasks: scaffold, note CRUD, RAG chat, public browse, and polish. The canonical task queue is `docs/workboard.json`. Skills are available at `.codex/skills/` (synced from ag.dev).

---

## Quick Start

```bash
# Install dependencies
npm install

# Start local dev server
npm run dev

# Run tests (Vitest, watch mode)
npm test

# Run tests once (CI)
npm run test:run

# Lint + typecheck
npm run lint

# Production build
npm run build
```

---

## Build & Verification Commands

| Command | What it checks | Speed |
|---------|---------------|-------|
| `npm run test:run` | Vitest unit tests | fast |
| `npm run lint` | TypeScript + ESLint | fast |
| `npm run build` | SvelteKit production build | slow |

Never skip the fast checks before marking a task done.

---

## Repository Structure

```
src/
  lib/
    server/
      db/
        schema.ts        — Drizzle schema (notes, conversations, messages, auth tables)
        index.ts         — Neon serverless HTTP connection
        notes.ts         — query layer (CRUD + similarity search)
      ai/
        openrouter.ts    — OpenRouter adapter (OpenAI-compatible)
        review.ts        — in-editor note critique (streaming)
        draft-review.ts  — /write-post voice + AI-tell scorer (non-blocking)
      embeddings.ts      — embed note body on create/update
      chat.ts            — embedding search + prompt assembly
      personality.ts     — personality block (edit here, never inline in chat.ts)
    components/
      NoteCard.svelte
      Chat.svelte
    utils/
      slugify.ts
      note-taxonomy.ts   — canonical category list
  routes/
    +page.svelte                        — landing (chat + note previews)
    notes/
      +page.svelte                      — browse/filter published notes
      [slug]/+page.svelte               — note detail
    admin/
      +page.svelte                      — admin dashboard
      notes/
        new/+page.svelte
        [slug]/edit/+page.svelte
    api/
      chat/+server.ts                   — public RAG endpoint (rate-limited, streaming)
  hooks.server.ts                       — Auth.js middleware + /admin route guard
docs/
  INDEX.md              — documentation navigation map
  PRD.md                — product requirements and scope
  ARCHITECTURE.md       — system topology and boundaries
  CONVENTIONS.md        — coding standards and patterns
  DECISIONS.md          — architectural decision log
  ENV_VARS.md           — environment variable matrix
  TESTING.md            — test strategy and inventory
  VOICE.md              — canonical blog writing voice + AI-tell ban list
  workboard.json        — canonical task queue
  workboard.schema.json — JSON Schema for task queue
  workboard.md          — workboard field definitions and usage rules
scripts/
  migrate.js            — HTTP-driver migration runner
  create-note.js        — /write-post draft writer (createNote + reindex; draft-only)
  review-draft.js       — /write-post voice + AI-tell scorer CLI (JSON output)
.claude/
  skills/
    write-post/SKILL.md — inline interview -> draft -> score -> draft-save workflow
```

Docs navigation: [`docs/INDEX.md`](docs/INDEX.md)

---

## Architecture

- All external I/O (Neon, OpenRouter) goes through `src/lib/server/` — never in client components.
- Embeddings are generated at note save time (`embeddings.ts`), not at query time.
- Auth is enforced in `src/hooks.server.ts` — no client-side-only guards on `/admin` routes.
- The personality block always loads from `personality.ts` — never hardcoded in `chat.ts`.
- Chat responses stream via `ReadableStream` (SSE) — never buffered JSON.
- First-party media uploads use Railway Storage Buckets with presigned URLs; buckets are private-only.
- Cover media formats are fixed to JPEG, PNG, SVG, GIF, and MP4.
- Config is read from environment variables only. No hardcoded secrets.
- Schema changes use Drizzle migrations only — never `ALTER TABLE` directly.

Full topology, component responsibilities, data flow, and deployment targets: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

---

## Code Style & Constraints

### Never

- Never commit secrets or credentials.
- Never bulk-rewrite `docs/workboard.json`; use targeted edits only.
- Never import `src/lib/server/` modules from client-side Svelte components.
- Never use `any` in TypeScript — use `unknown` + narrowing.
- Never hardcode the personality block in `chat.ts` — always load from `personality.ts`.
- Never send full note bodies to the LLM — use `Takeaway` + first paragraph only.
- Never use legacy Svelte 4 syntax (`$:`, `export let`) — use Svelte 5 runes only.

### Always

- Always run `npm run test:run` and `npm run lint` before marking a task done.
- Always update relevant `docs/` files when behavior changes.
- Always regenerate the note embedding when the note body changes.
- Always stream chat responses — never buffer.

### Patterns

- Svelte 5 runes: `$state`, `$derived`, `$effect`, `$props` — no legacy reactive declarations.
- SvelteKit API routes: `return new Response(stream)` for streaming, `json()` for everything else.
- DB queries: all reads/writes go through helpers in `src/lib/server/db/notes.ts`.
- pgvector similarity: the one allowed raw SQL exception, using Drizzle's `sql` template tag.

Full convention guide: [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md)

---

## Maintaining Docs

Docs must stay current with the code. Update the relevant doc in the **same commit** as the code change — never defer a doc update to a follow-up task.

| What changed | Doc to update |
|---|---|
| System topology, services, auth, data flow, deployment | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Coding pattern, naming rule, or never/always constraint | [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) |
| Env var added, removed, renamed, or changed | [`docs/ENV_VARS.md`](docs/ENV_VARS.md) |
| New architectural question raised | [`docs/DECISIONS.md`](docs/DECISIONS.md) — add OPEN-XX |
| Architectural decision resolved | [`docs/DECISIONS.md`](docs/DECISIONS.md) — move to Resolved |
| Test file added, removed, or pattern changed | [`docs/TESTING.md`](docs/TESTING.md) |
| Product scope, users, or success criteria changed | [`docs/PRD.md`](docs/PRD.md) |
| Any doc added, removed, renamed, or moved | [`docs/INDEX.md`](docs/INDEX.md) — always |
| Constraint or gotcha discovered during a task | This file (`AGENTS.md`) — append to Discoveries |

**Rule:** If a section in `AGENTS.md` summarizes something, and the full doc changes, update both the summary here and the full doc in the same commit.

---

## Workboard

The canonical task queue is `docs/workboard.json`.
Schema and usage contract: [`docs/workboard.md`](docs/workboard.md).
Machine validation schema: [`docs/workboard.schema.json`](docs/workboard.schema.json).

Use the `/query-workboard` skill to inspect it. Use the `/start-task` skill to execute a task end-to-end. Use the `/edit-workboard` skill to author new tasks, edit fields, and split heavy tasks. Never dump the full board into context — use targeted `jq` queries.

A task is startable when:
- `status == "todo"`
- `blocked_by` is empty or missing
- all `depends_on` tasks have `status == "done"`

Targeted edit rules:
- Never rewrite the full `workboard.json`.
- Only update the status fields of the task currently being worked.
- Roll back `in_progress → todo` if blocked mid-task and unresolved.
- Use `/edit-workboard` for all structural changes (new tasks, field edits, splits, blocking) — never hand-edit the JSON directly.

Task group IDs for this project: `SCAFFOLD`, `ADMIN`, `PUBLIC`, `CHAT`, `POLISH`, `AUTHOR`.

---

## Agent Workflow

Standard task cycle for this project:

1. Read this file (`AGENTS.md` / `CLAUDE.md`) at the start of every session.
2. Run `/query-workboard` to find the next startable task.
3. Run `/start-task` to execute it (reads docs, implements, verifies, updates board).
4. Update this file if you discovered a constraint, pattern, or pitfall worth encoding.
5. Commit changes. Summarize: what was done, what was skipped, what is next.

For multi-task runs: `/ralphloop start-task iterations:N`.

### Stopping Conditions

Stop and report (do not continue) when:
- No startable task exists (all are blocked or done).
- A verification command fails and the fix is not obvious.
- An irreversible action (migration, destructive write, external publish) is required and the task does not explicitly authorize it.
- A change touches the OpenRouter API key, rate limiting logic, or auth middleware — flag for human review before proceeding.

---

## Debugging & Gotchas

- Neon uses the **serverless HTTP driver** (not TCP). Import from `@neondatabase/serverless`, not `pg`. TCP connections time out in serverless environments.
- pgvector cosine similarity requires the `vector` extension enabled on the Neon project. Run `CREATE EXTENSION IF NOT EXISTS vector;` in the Neon console before first migration.
- All Glass Atlas tables use the `glass_atlas` Postgres schema (not `public`). Drizzle must use `pgSchema('glass_atlas')` when defining tables. The Techy project owns the `public` schema on the same database.
- `AUTH_TRUST_HOST` is a Vercel-specific workaround and must **not** be set on Railway — it is not needed and could cause unexpected behavior.
- SvelteKit's `$env/static/private` is only accessible in server-side files. Importing it in a `.svelte` file causes a build error.
- Streaming responses from `/api/chat` must use `return new Response(stream)` — SvelteKit's `json()` helper buffers the full response before sending.

---

## Environment Variables

See [`docs/ENV_VARS.md`](docs/ENV_VARS.md) for the canonical variable and secret matrix.

Key variables: `DATABASE_URL`, `OPENROUTER_API_KEY`, `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `PUBLIC_SITE_URL`. Optional local-only auth shortcut: `AUTH_BYPASS=TRUE` (localhost + development only). For first-party media uploads, configure Railway bucket vars: `BUCKET`, `ENDPOINT`, `REGION`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`. (`AUTH_TRUST_HOST` is not used — Railway does not require it.)

---

## Testing

Run `npm run test:run` (Vitest, CI mode) before marking any task done.

Full test strategy, file inventory, and patterns for writing new tests: [`docs/TESTING.md`](docs/TESTING.md)

---

## Deployment

Deployments are CI-only via Railway. Pushing to `main` triggers a production deploy automatically via Railway's GitHub integration. The app runs as a persistent Bun HTTP server using `@sveltejs/adapter-node`. Never manually push secrets or deploy from a local machine. Staging uses a separate Neon branch — set `DATABASE_URL` to the branch connection string in Railway's staging service variables.

---

## Living Document

This file is a running notebook of agent discoveries. After each task cycle, update this file if you found:

- A constraint that would have saved time if it were written here.
- A debugging tip that resolves a non-obvious failure.
- A pattern that should be followed for consistency.
- A "never do X" rule that emerged from a near-miss.

Append under `## Discoveries` below. Keep each entry to 2–3 sentences with a date. Do not reorganize or rewrite existing entries — append only.

```
### YYYY-MM-DD — <short title>
<What you found and why future agents working here should know it.>
```

---

## Discoveries

<!-- Agents: append new discoveries here after each task cycle. -->
<!-- Engineers: seed this section with known pitfalls at project setup time. -->

### 2026-04-26 — `@sveltejs/vite-plugin-svelte` must be `^5.0.0` with Vite 6
`@sveltejs/vite-plugin-svelte@4.x` only supports Vite 5; `^5.x` is required for Vite 6 compatibility. Using `^4.0.0` causes `ERESOLVE` on `npm install`. Do not downgrade this constraint.

### 2026-04-26 — Auth.js uses JWT sessions until DB is configured
`src/auth.ts` is wired for stateless JWT sessions (no DrizzleAdapter). To switch to DB-backed sessions, add `adapter: DrizzleAdapter(db)` to the `SvelteKitAuth` config in `src/auth.ts`. The schema already has the required Auth.js tables.

### 2026-04-26 — `DATABASE_URL` uses `$env/dynamic/private`, not static
`src/lib/server/db/index.ts` reads `DATABASE_URL` at runtime so the dev server starts without a configured database. Queries throw at the call site when the URL is missing, not at import time. Do not change this to `$env/static/private`.

### 2026-04-28 — `npm audit` remediation policy for current stack
Apply direct high-impact fixes promptly (for example `drizzle-orm` security patches), then re-run lint/tests and audit. Low/transitive findings tied to framework-held dependencies (such as the `@sveltejs/kit` -> `cookie` chain) can be intentionally deferred when there is no clean, non-breaking upgrade path. Record the deferral rationale in `docs/DECISIONS.md` so future agents do not churn dependency versions without context.

### 2026-04-28 — Railway Buckets are private-only for media delivery
Railway Storage Buckets do not provide public bucket URLs; serve uploaded note media through presigned GET URLs by default. Proxy streaming through the app is optional for transforms/access control, but it incurs Railway service egress and should not be the default path.

### 2026-04-28 — Cover media type scope is closed
Use only JPEG, PNG, SVG, GIF, and MP4 for note cover media. Do not reintroduce YouTube/Vimeo iframe embeds unless a new decision explicitly reopens that scope.

### 2026-04-30 — `drizzle-kit migrate` hangs in WSL2 (websocket limitation)
`drizzle-kit migrate` uses `@neondatabase/serverless` websockets which fail silently (hangs indefinitely) in WSL2 and non-interactive CI shells. Use `npm run db:migrate:http` (`scripts/migrate.js`) instead — it reads the journal, applies each SQL file via the Neon HTTP driver, and updates `public.__drizzle_migrations`. The Railway production deploy environment is not affected (Linux, no WSL2).

### 2026-04-30 — All schema tables must use `pgSchema('glass_atlas')`, not `pgTable`
Using bare `pgTable` puts tables in the `public` schema, which is owned by the Techy project on the same Neon database. Always use `const glassAtlas = pgSchema('glass_atlas')` and `glassAtlas.table(...)` for every table definition. Also set `schemaFilter: ['glass_atlas']` in `drizzle.config.ts` so drizzle-kit does not manage or drop `public` schema objects.

### 2026-04-30 — Never set `trustHost` explicitly in `src/auth.ts` for Railway
Setting `trustHost: Boolean(env.AUTH_TRUST_HOST)` forces `trustHost: false` in production (since `AUTH_TRUST_HOST` must not be set on Railway), breaking the OAuth callback. The `@auth/sveltekit` adapter's action path defaults `trustHost ??= true`, but explicit `false` overrides this. Omit `trustHost` from the `SvelteKitAuth` config entirely — let the adapter set it. The `AUTH_SECRET`, `AUTH_GITHUB_ID`, and `AUTH_GITHUB_SECRET` vars must use `$env/static/private` (not dynamic).

### 2026-04-30 — New SvelteKit routes need generated `$types` before lint
Adding a new route that imports `./$types` can make `npm run lint` fail until `svelte-kit sync` has regenerated `.svelte-kit/types`. Run `npm run check` or `npx svelte-kit sync` before the required lint pass when adding routes. `npm run check` is also the only current command that runs `svelte-check` against `.svelte` files.

### 2026-04-30 — Admin editor metadata must be schema-backed
The admin note editor tasks require `image`, `published_at`, and `series` fields to persist through `createNote()`/`updateNote()`. Keep these fields on the `notes` table and in the DB helper plain-object types; do not handle them with inline route SQL or client-only form state.

### 2026-04-30 — `/api/admin/**` routes need explicit auth checks until hook coverage is expanded
`src/hooks.server.ts` currently guards `/admin` pages but does not automatically block `/api/admin/**` endpoints. New admin API handlers should call `event.locals.auth()` and return `401` when unauthenticated to avoid accidental exposure. Keep this route-level check in place unless the global hook is broadened in a dedicated task.

### 2026-04-30 — Bucket env vars must be runtime-loaded to keep Docker/Railway builds green
Importing `BUCKET`/`ACCESS_KEY_ID`/`SECRET_ACCESS_KEY` from `$env/static/private` makes `vite build` fail when upload vars are not present at build time. Load bucket vars from `$env/dynamic/private` inside `src/lib/server/storage/bucket.ts` and fail only when upload endpoints are actually used.

### 2026-04-30 — `PUBLIC_SITE_URL` should be runtime-loaded with fallback
Using `$env/static/public` for `PUBLIC_SITE_URL` can fail `vite build` if the var is unset in the build environment. Use `$env/dynamic/public` and fall back to `url.origin` (sitemap) or `http://localhost:5173` (layout metadata) so builds stay reproducible while production still sets the canonical domain.

### 2026-04-30 — Docker builds should use `npm ci` (not `bun install`) for this lockfile
`package-lock.json` resolves `vscode-textmate` to `git+ssh://git@github.com/...`, which makes `bun install` fail during lockfile migration in container builds. In Docker, install `git`, `python3`, `make`, `g++`, and `npm`, then run `npm ci` before `bun run build`.

### 2026-04-30 — Railway Dockerfile builds need `ARG` for build-time env access
When deploying with a custom Dockerfile, Railway-provided/service variables are only available to `RUN` steps if declared with `ARG` in that build stage. This matters for `$env/static/private` imports like Auth.js credentials, which must exist during `vite build`.

### 2026-04-30 — `@auth/sveltekit@1.0.0` on Railway requires explicit `trustHost: true`
With this package version, `setEnvDefaults()` initializes `config.trustHost` from `dev` before core env defaults run, so production can remain `false` and raise `UntrustedHost` even when `AUTH_TRUST_HOST` is set. Set `trustHost: true` directly in `src/auth.ts` for Docker/Railway deployments; keep `AUTH_URL` at the site origin only (no `/auth` suffix) to avoid `env-url-basepath-redundant` warnings.

### 2026-04-30 — Local auth bypass must stay localhost + development scoped
`AUTH_BYPASS=TRUE` is intentionally constrained to `NODE_ENV=development` and local hosts (`localhost`, `127.0.0.1`, `::1`) inside `src/hooks.server.ts`. Keep this guard strict so preview/production environments can never bypass OAuth by mistake. Prefer `$env/dynamic/private` for this toggle so builds do not require it.

### 2026-04-30 — Admin markdown preview should stay client-local and fail-soft
The split-pane editor contract is live typing feedback without network calls on keystrokes (`body` state -> wiki-link transform -> preview render). Keep preview rendering in client-safe modules only; never pull `src/lib/server/**` into admin `.svelte` files for this. If preview transform fails, keep typing and save/publish actions working and show a non-blocking preview error state.

### 2026-04-30 — Public chat quota identity is anonymous cookie session, not IP
Rate-limit fairness now targets per-browser anonymous sessions instead of per-IP buckets, so quota enforcement should key off a server-issued opaque cookie token (`chat_session`) and persist counters in DB. Keep identifiers anonymous (store only token hashes server-side), and accept cookie-clearing as a valid quota reset behavior for no-login visitors.

### 2026-05-01 — `drizzle-kit generate` rename prompts need an interactive TTY
When a schema change renames a column (for example `ip_hash` -> `session_hash`), `drizzle-kit generate` prompts for create-vs-rename resolution and fails in non-TTY shells. Run it in an interactive TTY and select the rename mapping so Drizzle emits a clean rename migration instead of a destructive drop/create sequence.

### 2026-05-01 — Confidence gate must skip LLM entirely, not just change the prompt
The confidence fallback for insufficient coverage must return a canned SSE stream directly — never forward an empty context string to the LLM. An empty context still allows the LLM to answer from training data, violating the grounding contract. Use `hasSufficientCoverage()` in `chat.ts` to gate before the LLM call and emit the fallback via `makeFallbackStream()` in the same SSE format so the client sees a seamless response.

### 2026-05-01 — Inline body media uses `{{media ...}}` tokens, not raw HTML blocks
Inline assets in note bodies are now represented as markdown tokens (for example `{{media src="..." type="video" align="wide"}}`) and transformed by the shared `remarkInlineMediaEmbeds()` pass in both preview and public renderers. Keep this token flow aligned across `src/lib/utils/markdown-preview.ts` and `src/lib/server/markdown.ts`; do not rely on author-written raw `<img>`/`<video>` HTML for feature behavior.

### 2026-05-01 — Keep `redirect()` outside broad `try/catch` blocks in route handlers
SvelteKit `redirect()` throws to short-circuit the handler; catching it as a generic error causes false failure logs and can convert successful redirects into error responses. In endpoints like `/api/admin/media/access-url`, wrap only fallible pre-redirect work (signing/lookup) in `try/catch`, then call `redirect()` after the catch block.

### 2026-05-01 — Railway bucket upload failures can be CORS-only even when signing works
If `POST /api/admin/media/upload-url` succeeds but browser `PUT` to the presigned bucket URL fails (`net::ERR_FAILED`), treat it as a bucket CORS issue first, not missing env vars. Railway bucket CORS is configured via S3-compatible API/CLI (not app-service env vars and not a dedicated dashboard toggle in current UX). Ensure CORS allows app origins, `PUT`, and `Content-Type` before debugging app code.

### 2026-05-01 — Auth.js prod config: `AUTH_URL` must be origin-only and auth secrets should be runtime-loaded
Setting `AUTH_URL` with a path suffix (for example `/auth`) triggers `env-url-basepath-redundant` and can cause `UnknownAction` routing failures in production. Keep `AUTH_URL` as origin-only (or unset) and do not set `AUTH_TRUST_HOST` on Railway. Load `AUTH_SECRET`, `AUTH_GITHUB_ID`, and `AUTH_GITHUB_SECRET` via `$env/dynamic/private` so credentials are not baked into Docker build artifacts.

### 2026-05-01 — Reserve `/auth/*` for Auth.js actions; host custom sign-in outside that prefix
With `@auth/sveltekit`, the hook intercepts `/auth/*` as Auth.js action routes. A custom SvelteKit page at `/auth/signin` causes client-side `__data.json` requests like `/auth/signin/__data.json`, which Auth.js parses as `signin` with provider id and throws `UnknownAction: Unsupported action`. Put custom UI at `/signin` (or another non-`/auth` path) and set `pages.signIn` accordingly.

### 2026-05-01 — Chat social-intent lane must stay allowlisted and non-factual
`POST /api/chat` now short-circuits a small allowlist of conversational intents (greeting/thanks/identity/capability/how-it-works) before retrieval and LLM calls, returning templated SSE replies. Keep this lane strictly non-factual and steering-only so it does not become a general-purpose chatbot path. Any informational claim still has to flow through retrieval + grounding constraints.

### 2026-05-04 — Admin review should use the OpenRouter free-model router
The old hardcoded `google/gemini-2.0-flash-exp:free` review model can return `404 No endpoints found` when OpenRouter has no active provider for that experimental variant. Keep admin critique on `openrouter/free` by default and use `OPENROUTER_REVIEW_MODEL` only for a currently available free model/router unless a new decision changes the cost policy.

### 2026-05-04 — Legacy `rehype-shiki` theme names are limited
`rehype-shiki@0.0.9` uses the old `shiki-themes` package and does not include newer theme names like `github-dark`; using one causes note rendering to 500 with `Unable to load theme`. Use bundled legacy names such as `dark_plus`, `nord`, or `monokai` unless the markdown renderer dependency is upgraded.

### 2026-05-05 — Chat confidence thresholds must be calibrated against real chunk embeddings
Raw user queries can score around `0.5–0.65` cosine distance even when they clearly match the only relevant note because chunks are embedded with metadata scaffolding. Keep semantic query alias expansion narrow and local (`creator`, `Aden`, `RAG`, `LLM`) and validate threshold changes against both known in-corpus prompts and unrelated prompts before tightening the fallback gate.

### 2026-05-20 — Security headers live in `securityHeaders` handle; keepalive is a startup side-effect
All HTTP security response headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`) are applied centrally via a `securityHeaders` handle appended to the `sequence(...)` in `hooks.server.ts` — never per-route. The Neon keep-alive ping (`SELECT 1` every 4 minutes) lives in `src/lib/server/db/keepalive.ts` and is imported once as a side-effect at the top of `hooks.server.ts`; do not add DB ping logic elsewhere.

### 2026-05-20 — `adminGuard` hook covers `/api/admin/**` with 401 JSON, not redirect
`adminGuard` now catches both `/admin/**` (redirect to sign-in) and `/api/admin/**` (401 JSON) so a future route that forgets its own auth check is still blocked. `GET /api/admin/media/access-url` is listed in `PUBLIC_API_PATHS` as the sole intentional public exception — it must remain open so bucket-hosted note media renders on public pages. Never extend the exception set without a deliberate decision. `POST /api/chat` enforces a 2 000-character message cap (checked before quota) to prevent cost-amplification attacks via oversized inputs.

### 2026-06-07 — Chat default model `google/gemini-2.0-flash-001` was retired upstream (404)
The public chat default in `openrouter.ts` returned `404 No endpoints found` because OpenRouter removed that model. Paid successors (`google/gemini-2.5-flash`) return `402` since the account has no credits, so the replacement must be a `:free` model. New default is `google/gemma-4-31b-it:free` — clean `content`-only streaming and good grounding adherence. Verify a candidate with a real `curl` to `/chat/completions` (expect `200` + clean stream, not just that the slug exists) before switching; many `:free` slugs now 404 or 429. Avoid `gpt-oss-*:free` here — it interleaves `reasoning` tokens that stall the visible answer (client reads only `delta.content`).

### 2026-06-08 — Agent authoring is draft-only and reuses the existing save pipeline
The `/write-post` skill (group `AUTHOR`) writes notes through `scripts/create-note.js`, which calls `createNote()` + `reindexNoteAfterSave()` — so wiki-link graph, note embedding, and chunks come for free; never hand-roll that persistence. Status is **hard-forced to `draft`**; nothing in this lane publishes. Blog voice lives in `docs/VOICE.md` (the long-form cousin of `personality.ts`), loaded by both the skill and the `ai/draft-review.ts` scorer — never inline it. The draft-review score is recorded/shown but non-blocking (DECISIONS.md OPEN-01). Factual spine is author-sourced (interview + existing notes); any agent-added outside knowledge is flagged in the terminal report only, never written into the note body.

### 2026-06-08 — Plain Node scripts can import SvelteKit helpers through Vite SSR
`scripts/create-note.js` uses Vite's SSR middleware loader to import `createNote()`, `reindexNoteAfterSave()`, and `slugify()` because those modules depend on `$lib` and `$env/dynamic/private`. Keep this loader pattern for local scripts that must reuse app helpers; do not replace it with duplicated SQL or custom embedding/link logic. Load `.env` into `process.env` before creating the Vite server so dynamic private env reads match local app behavior.

### 2026-06-08 — `/write-post` must load slugs before drafting
The `/write-post` skill reads existing note slugs through `listNotes()` via the same Vite SSR pattern before it drafts. If the note list cannot load, stop before writing prose; guessing or forward-linking `[[slug]]` targets breaks the wiki-link contract. After saving, verify/report draft status, embedding presence, semantic index state, chunk count, and outlink count so the author knows whether the local pipeline completed cleanly.

### 2026-06-08 — Mermaid fences need a renderer fallback with legacy Shiki
`rehype-shiki@0.0.9` does not register `mermaid` as a highlightable language and cannot tokenize `text`/`plaintext` fences, so those blocks can 500 public/admin preview pages. Keep the `rehypeUnsupportedCodeAsPlainText` fallback in `src/lib/server/markdown.ts` unless a real Mermaid renderer or newer highlighter is added; Mermaid blocks currently render as styled unhighlighted code, not diagrams.

### 2026-06-08 — `/write-post` drafts need a Markdown polish gate
Agent-written note bodies must not be plain prose dumps or accidentally copied patch text. Before review/save and again after save, check for standalone `+` lines, `+##` heading prefixes, plus-prefixed code fences, `+|` table rows, and similar diff artifacts, then make sure the draft uses intentional Markdown structure such as headings, blockquotes, emphasis, lists/tables, and fenced examples where useful.

### 2026-06-08 — Legacy `dark_plus` Shiki emits black default text on its dark background
`rehype-shiki@0.0.9` stamps every `<pre>` with a dark background (`#1E1E1E`) but emits its *default* token color as pure `#000000`, and un-tokenized blocks (plain ``` ``` ``` fences, the `unhighlighted-code-source` fallback) get no color at all and inherit the page body's dark text. Both render as near-black-on-near-black — unreadable. The `rehypeFixDarkThemeForeground` pass in `src/lib/server/markdown.ts` fixes this by adding `color: #D4D4D4` to the dark `<pre>` and rewriting inline `#000000` spans to `#D4D4D4`; keep it in the pipeline (after `rehypeShiki`) unless the highlighter is upgraded. Switching themes does not help — every bundled legacy theme has a dark background and a black default foreground.

### 2026-06-29 — DB migration tasks must include production application
Any future workboard task that changes the database schema must include generating the Drizzle migration and applying it to the production Neon database before the task is marked done. Keep this requirement in that same task's acceptance criteria/commands instead of splitting production migration into a later follow-up.

### 2026-06-30 — Append metadata to an in-flight SSE `ReadableStream` via pull-through wrapping; mock with a real upstream in tests
To attach trailing JSON (e.g. chat source metadata) to an SSE stream from `POST /api/chat` without buffering, wrap the upstream `ReadableStream` in a new one whose `pull()` drains the upstream reader and enqueues the extra `data:` event only once `done` is seen, then closes. Keep the extra payload's shape free of the OpenAI `choices` key so existing client-side `extractToken`-style parsers treat it as a harmless empty token. Constructing such a wrapper eagerly calls `pull()` once (default `highWaterMark` 1), which calls `reader.read()` on the upstream — a bare `mockResolvedValue(new ReadableStream())` (no `start` controller) never resolves `read()` and hangs forever; tests that read the wrapped stream's body need a real upstream fixture (a stream that actually `enqueue`s and `close`s), not an empty `ReadableStream()`.

### 2026-06-30 — Chat source snippet is pre-escaped HTML; title is not — render accordingly, and override child-component trigger classes with `:global()`
`CitedNote.snippet`/`ChatSource.snippet` already passes through `buildSourceSnippet()` -> `escapeHtml()` on the server, so the client must render it via `{@html source.snippet}` — interpolating it as plain Svelte text (`{source.snippet}`) double-escapes entities (e.g. `&amp;` becomes visible `&amp;amp;`). `title` is raw and must use normal `{source.title}` interpolation instead. Also: `Dialog.svelte`'s `triggerClass` prop renders inside `Dialog.svelte`'s own template, not the caller's, so a caller's scoped `<style>` block cannot target it directly — wrap the override selector in `:global(...)` (same pattern already documented for `Select.svelte`'s `triggerClass` in `docs/CONVENTIONS.md`). `npm run build` currently fails on `main` (unrelated, pre-existing): `NoteGraph.svelte` imports `d3`, which is not installed, so Rollup cannot resolve it; this is not part of any `CHAT-*` task and was verified via `git stash` to predate this change. Use `npm run dev` + a manual smoke fetch for UI verification until that `d3` dependency gap is fixed in a dedicated task.

### 2026-06-30 — `d3` "not installed" gap was a stale `node_modules`, not a missing dependency
The previously-recorded `d3` Rollup-resolution failure (`npm run build` / `npm run check` erroring on `NoteGraph.svelte`'s `import('d3')`) was caused by `node_modules` being out of sync with `package.json`/`package-lock.json` — `d3` and `@types/d3` were already correctly declared as dependencies but absent from `node_modules` (`npm ls d3` showed `(empty)`). Running `npm install` (no lockfile changes; `package-lock.json` already pinned the right versions) installed the missing packages and resolved both `npm run check`'s `Cannot find module 'd3'` errors and the `npm run build` failure. If a future cycle hits "module not installed despite being in package.json," run `npm install` and re-check before assuming a dependency needs to be added or pinned.

### 2026-06-30 — `getNoteQualityWarnings()` exists as a pure mapper only; editor UI wiring is still open
`ADMIN-12A` added `src/lib/server/admin/quality-warnings.ts` (`getNoteQualityWarnings()` + deterministic `isWeakTitle()`) per its scoped `files[]` (helper + tests only, no `.svelte` files). `docs/ARCHITECTURE.md`/`docs/CONVENTIONS.md` already described the intended `/admin/notes/new` and `/admin/notes/[slug]/edit` warning UI ahead of this task; that wiring (calling the helper from route load functions and rendering the warnings) is still a separate follow-up — do not assume the editor pages already surface these warnings just because the docs describe the target flow.

### 2026-07-01 — `rehypeRaw` silently renames hyphenated hast properties to camelCase, even without raw nodes
While implementing `PUBLIC-05B` (code block controls in `src/lib/server/markdown.ts`), a `data-filename` property set on a `<code>` hast node right after `remarkRehype` (reading the mdast code node's `.data.meta`, which does not survive `rehypeRaw`) came back as `undefined` when read by a later plugin. Cause: `rehypeRaw` (`hast-util-raw`) stringifies+reparses the *entire* tree even when no literal `raw` node is present, and `hast-util-from-parse5`/`property-information` normalize any `data-*` attribute to a camelCase hast property (`data-filename` → `dataFilename`) during that reparse. A property set with a hyphenated key **before** `rehypeRaw` runs will read back camelCased later; the same key set **after** `rehypeRaw` stays hyphenated. `markCodeNodeAsUnhighlighted()`'s `data-language` property is set from both sides of `rehypeRaw` in this pipeline (pre-raw for the failed-Mermaid fallback, post-raw for the plaintext-fence fallback), so any later reader must check both `'data-language'` and `dataLanguage` keys — do not assume a hyphenated hast property key you set is stable across a pipeline step that includes `rehypeRaw`.

### 2026-06-30 — `ADMIN-12B` split quality warnings into a client-safe content mapper plus a server-only composer, not a load-time-only mapper
`/admin/notes/new` has no saved DB note in its `load` function at all (only `noteSlugs`), and the existing `checklist`/"Preflight" panels on both editor pages already recompute live from `$state` form fields — so a single server-only `getNoteQualityWarnings(note)` called once at `load` could not satisfy "warnings appear in both new and edit note editors" for unsaved content, and would have been stale relative to in-progress edits on the `edit` page. Fix: extracted the content-only checks (missing takeaway, no internal links, weak title) into a new client-safe `getContentQualityWarnings()`/`isWeakTitle()` in `src/lib/utils/quality-warnings.ts` (no `$lib/server` import — same constraint as `markdown-preview.ts`), and made `src/lib/server/admin/quality-warnings.ts`'s `getNoteQualityWarnings()` delegate to it while adding the `semantic-index` warning from `getSemanticIndexDisplay()`. A new shared `src/lib/components/admin/QualityWarningsPanel.svelte` takes live `{title, takeaway, body}` props plus an optional server-supplied `semanticIndex` prop (only passed when `getSemanticIndexDisplay(...).showWarning` is true) and recomputes content warnings via `$derived.by(...)` on every keystroke. `docs/ARCHITECTURE.md` and `docs/CONVENTIONS.md` were updated in the same commit to describe this split; if a future task touches quality-warning heuristics, edit the logic once in `src/lib/utils/quality-warnings.ts` and let the server module's re-export/delegation carry it through — do not re-duplicate the heuristics in the server file.

### 2026-07-01 — Server-side Mermaid rendering (`PUBLIC-05A`) needs jsdom + SVG method shims, and must never leave those globals installed outside a render
`mermaid` is fundamentally browser-oriented (D3-based layout reads `window`/`document` as ambient globals with no DI seam), and jsdom implements neither `SVGElement.prototype.getBBox` nor `getComputedTextLength`/`getScreenCTM` — calling `mermaid.render()`/`mermaid.parse()` against a bare jsdom window throws (`getBBox is not a function`) until those three methods are patched with fixed-size stand-ins. This was verified experimentally (scratch script) before implementation: real headless-browser rendering (`mermaid-isomorphic`, the engine behind `rehype-mermaid`) requires installing Playwright + a Chromium binary, which is too heavy for this deployment; the jsdom+shim approach produces valid, non-pixel-perfect SVG without that dependency. `src/lib/server/mermaid-render.ts` installs `window`/`document`/`navigator`/`DOMParser`/`SVGElement`/`HTMLElement`/`Element`/`CSSStyleSheet`/`getComputedStyle` onto `globalThis` **immediately before** each render and restores the prior values **immediately after**, in a `try/finally`, serialized through a single in-process mutex (concurrent renders would otherwise clobber each other's installed globals). Do not cache these as a permanent process-wide singleton — leaving jsdom's `window`/`document` installed indefinitely would make any other server code that branches on `typeof window` (GSAP, and potentially others) incorrectly believe it is running in a browser for the rest of the process lifetime, a correctness risk far worse than the CPU cost of re-installing/restoring globals per render.

### 2026-07-01 — Mermaid fences render server-side to real SVG; invalid/empty diagrams share the plaintext fallback path
`src/lib/server/markdown.ts` gained a `rehypeRenderMermaidDiagrams` plugin (runs before `rehypeRaw`/`rehypeShiki`) that calls `renderMermaidToSvg()` for every `<pre><code class="language-mermaid">` block: on success it mutates the node in place into `<div class="mermaid-diagram">` wrapping the SVG (spliced from a `{ type: 'raw' }` hast node by `rehype-raw`, added as a new pipeline dependency); on failure it calls the same `markCodeNodeAsUnhighlighted()` helper the plaintext/text/txt fallback path uses, so a bad or empty diagram renders as readable source instead of throwing. `mermaid` no longer sits in `UNHIGHLIGHTED_CODE_LANGUAGES` — only `plaintext`/`text`/`txt` do. `markdown.test.ts` calls the real `renderMarkdown()` end-to-end (no mocking of `mermaid`/`jsdom`) since the renderer manages its own DOM shimming internally and Vitest's default `node` test environment has no ambient `window`/`document` to conflict with it.

### 2026-07-01 — `NoteGraph.svelte` hover/motion polish (`PUBLIC-04C`) uses CSS transitions + `classed(...)`, not JS-driven animation
Hover feedback (dim non-neighbors, highlight the hovered node's direct links, enlarge the hovered node) is implemented by toggling `is-dimmed`/`is-focused`/`is-active` classes via D3's `.classed(...)`, with the actual easing (`r`, `opacity`, `stroke-opacity`, `stroke-width`) defined as plain CSS `transition`s — this keeps interaction state and animation concerns separate and lets a single `@media (prefers-reduced-motion: reduce)` block disable all of it. Reduced motion also fully skips the animated force-simulation unfold: `simulation.stop()` + synchronous `tick()` calls until convergence (`Math.log(alphaMin) / Math.log(1 - alphaDecay)`), then one static paint — the `.on('tick', ...)` listener is never attached in that branch, so no motion is shown at all, not just faster motion. Also fixed a latent unmount race: the `$effect` cleanup now sets a `cancelled` flag checked at the top of the `import('d3').then(...)` callback, since the original code only guarded via `sim?.stop()`, which is a no-op if the dynamic import resolves after unmount (the callback would otherwise still call `d3.select(el)` on a stale SVG element). Local manual smoke-testing wasn't possible in this environment (no `DATABASE_URL` configured, so `npm run dev` 500s on every DB-backed route) — verified via `npm run test:run`, `npm run lint`, and `npm run check` plus code review instead.

### 2026-07-01 — Static, DB-free public pages *do* smoke-test fine under `npm run dev` with no `DATABASE_URL`
Only routes whose `+page.server.ts`/`load` actually calls into `src/lib/server/db/**` 500 when `DATABASE_URL` is unset (per the prior discovery). A route with no server load at all — e.g. `/how-it-works` (`POLISH-05`, pure static `+page.svelte`, no `+page.server.ts`) — renders `200` under `npm run dev` even with zero DB configuration, so it's worth actually trying `curl` against a new static page before assuming manual smoke-testing is blocked; don't default to "DB not configured, skip manual verification" for every route without checking whether that specific route touches the DB first. Also: `.ga-code-block` (the shipped "blueprint panel" recipe in `app.css`) uses `--color-surface-2` unconditionally in both light and dark — despite `docs/styleguide.md` §5.7 prose reading "surface-2 in light, surface-1 in dark" — because the token itself already has different light/dark values; don't add a conditional `:root.dark` override on top of a token that already flips per-theme, that just doubles the swap and risks a CSS syntax error mixing a selector list with a bare `@media` block.

### 2026-07-01 — CSS grid: reordering DOM children needs `grid-row` pinned too, not just `grid-column`
`POLISH-06` reordered `src/routes/+page.svelte`'s hero markup (chat `<aside>` before the copy `<div>`) so the collapsed mobile single-column layout shows chat first, ahead of the headline/CTA, while desktop keeps the original copy-left/chat-right split via explicit `grid-column` placement on both children. Pinning only `grid-column` was not enough — verified by rendering the actual grid CSS in a static HTML fixture with `google-chrome --headless --screenshot` (this repo has no Playwright/Puppeteer, but `google-chrome` is on `PATH` and works fine for one-off layout verification when `DATABASE_URL` isn't configured for a live `npm run dev` smoke test). Auto-placement pushed the out-of-DOM-order item to a second grid row instead of sharing row 1 with its sibling, breaking the desktop layout (items stacked vertically instead of side by side). Fix: explicitly set `grid-row: 1` on both `.hero-copy` and `.hero-chat` at the base breakpoint, and reset both `grid-column: auto` and `grid-row: auto` together in the mobile media query. When reordering grid children via markup instead of relying on DOM order, pin every axis that placement depends on, not just the one axis you changed.

### 2026-07-06 — `PageTransitionOverlay` (`POLISH-07E`) must mount outside the smooth-scroll wrapper, not inside it
A `transform` on an ancestor element establishes a new containing block for any `position: fixed` descendant, so a fixed-position overlay nested inside `#smooth-content` would be fixed relative to that (ScrollSmoother-transformed) div instead of the real viewport once the smoother applies its scroll-simulation transform. `src/lib/components/PageTransitionOverlay.svelte` is therefore mounted in `src/routes/+layout.svelte` as a sibling of the `#smooth-wrapper`/`#smooth-content` block, not inside it. The overlay itself creates no `ScrollTrigger` instances (plain `gsap.fromTo` clip-path tweens driven by `beforeNavigate`/`afterNavigate` only) so it cannot duplicate or interfere with the smooth-scroll layer's own `ScrollTrigger.refresh()` scheduling, and it stays `pointer-events: none` for its entire lifecycle so a visually-covering overlay can never trap clicks/focus. `WebFetch` to arbitrary external domains (gsap.com, tympanus.net, codepen.io) is blocked in this sandbox ("Unable to verify if domain ... is safe to fetch") even though `WebSearch` still returns live results/snippets — for the required GSAP.md inspiration-pass research, use `WebSearch` and cite the links/snippets it returns rather than assuming all web research tools are unavailable.

### 2026-07-06 — Check for `.env.local` (gitignored, machine-specific) before assuming no DB in a given sandbox; drive real browser-state QA over CDP, not `--dump-dom`
Prior discoveries in this file state flatly that "this sandbox has no `.env`/`DATABASE_URL`" — that only ever meant no *committed* `.env` file exists; a gitignored `.env.local` can still be present on a given machine/session (`git check-ignore -v .env.local` confirms it's excluded from the repo) and both `npm run dev` and plain `vite` auto-load it, while `npm run test:run` does not (unit tests still correctly log "DATABASE_URL is not set" regardless of `.env.local`). Check for `.env.local` specifically before assuming DB-backed routes are unreachable in a fresh session. Separately, for `POLISH-07G`'s cross-page navigation QA, `--dump-dom` proved too coarse: it captures one static snapshot and can't await a GSAP tween finishing, confirm a client-side SPA navigation actually completed, or read `ScrollTrigger.getAll().length` across repeated navigations. Driving headless Chrome directly over the Chrome DevTools Protocol from a small Node script (`google-chrome --headless=new --remote-debugging-port=<port>`, fetch the *page* target's `webSocketDebuggerUrl` from `GET /json/list` — not `/json/version`, which is the browser-level target and rejects `Runtime.evaluate` — then drive `Page.navigate`/`Runtime.evaluate` with `awaitPromise: true` and `Input.dispatchKeyEvent` over Node's built-in global `WebSocket`) gives real waits, real SPA-navigation clicks, real keyboard events, and a genuine page-console error feed via `Runtime.consoleAPICalled`/`Runtime.exceptionThrown`. Full technique and exact commands are recorded in `docs/TESTING.md`'s "Motion QA" section; reuse this for any future task that needs to verify actual browser JS state (not just rendered markup) without a real Playwright/Cypress harness in the repo.

### 2026-07-06 — `Nav.svelte` overflows horizontally at 390px mobile width, but only in the authenticated (`ADMIN`/`SIGN OUT` visible) state
`POLISH-07G`'s mobile QA pass found `document.documentElement.scrollWidth` (456px) exceeding `clientWidth` (390px) on every public route. Root cause isolated by removing `a[href="/admin"]` and `.ga-nav__auth-form` from the live DOM in a 390×844 CDP session, which brought `scrollWidth` back to exactly 390 — the overflow is caused entirely by `Nav.svelte`'s `ga-nav__controls-right` group growing too wide once the `ADMIN` link and `SIGN OUT` form render (visible here only because this session's `.env.local` has `AUTH_BYPASS=TRUE` active on `localhost` + `development`, per the existing `AUTH_BYPASS` discovery above). Anonymous public visitors never see these two controls, so this does not affect the default logged-out mobile experience, and no `POLISH-07` task touches `Nav.svelte` — this is a pre-existing, motion-unrelated responsive-layout gap in the authenticated nav state, left unfixed here as out of scope, and is a good candidate for a dedicated `Nav.svelte` mobile-responsive task if an agent is authenticated on a phone-width viewport in the future.

### 2026-07-06 — `Nav.svelte` mobile overflow fixed: stacked/wrapped `brand-row` layout under 480px, not a 3-column grid
Fixed the overflow flagged above. At ≤480px, `.ga-nav__brand-row` (`src/lib/components/Nav.svelte`) previously stayed a 3-column grid (`auto 1fr auto`) that tried to fit `links-left` (NOTES/CHAT/HOW IT WORKS) and `controls-right` (search icon + optional ADMIN + SIGN OUT + theme toggle) side by side with the logo — the combined content width vastly exceeds a 390px viewport once the authenticated controls render. Changed the ≤480px rule to `display: flex; flex-direction: column` with the logo first (`order: -1`, unchanged), and made `.ga-nav__links-left`/`.ga-nav__controls-right` each `width: 100%; justify-content: center; flex-wrap: wrap` so they stack as their own centered, wrappable rows below the logo instead of competing for horizontal space. Verified via the CDP technique from the entry above, authenticated (`AUTH_BYPASS=TRUE`) at 390×844: `scrollWidth` now equals `clientWidth` (390) with both `a[href="/admin"]` and `.ga-nav__auth-form` present in the DOM.

### 2026-07-06 — GSAP ScrollSmoother's fixed-wrapper mode overlapped Nav on every real desktop browser (invisible to headless-Chrome testing)
User reported "the middle column/section of every page looks pushed up and misaligned" on both the deployed Railway site and local dev, persisting through hard refresh. Root cause: `node_modules/gsap/src/ScrollSmoother.js:395` sets `#smooth-wrapper` (`src/routes/+layout.svelte`) to `position: fixed; inset: 0` (full viewport, ignoring document flow) whenever `ScrollSmoother`'s own touch check (`ScrollTrigger.isTouch === 1`, keyed off `matchMedia('(hover: none), (pointer: coarse)')`) is false — i.e., on every real mouse-driven desktop browser, given this repo's `PUBLIC_SMOOTH_SCROLL_CONFIG` (`src/lib/motion/smooth-scroll.ts`) has `smooth: 0.45` (truthy) and `smoothTouch: 0`. Since `Nav` (`src/lib/components/Nav.svelte`) is a plain `position: static` sibling rendered *before* `#smooth-wrapper` in `+layout.svelte`, with no `z-index` and no compensating top offset on the wrapper's content, the fixed wrapper's hero content visually overlapped/hid behind Nav from `y:0`, cutting off the nav logo and dropping the hero eyebrow/H1 up into the nav rows — reproduced pixel-for-pixel against the user's screenshot once verified.

**Why this was invisible to automated/headless testing**: headless Chrome (even with `--use-angle=swiftshader`) has no real pointer device, so `matchMedia('(hover: none), (pointer: coarse)')` always matches `true` — CDP's `Emulation.setDeviceMetricsOverride`/`setEmulatedMedia` do **not** override this in the tested Chrome version. This keeps `ScrollTrigger.isTouch === 1`, which forces ScrollSmoother into its `smoothTouch`-driven branch (`smoothTouch: 0` here → falsy → wrapper stays `position: relative`), silently skipping the entire buggy code path. Dozens of headless repro attempts (fresh loads, resizes, SPA nav, narrow widths, cold server starts, local production build) all rendered correctly for this reason alone — none of them exercised real desktop-pointer conditions. To force and verify the real branch in headless Chrome, use CDP's `Page.addScriptToEvaluateOnNewDocument` to monkey-patch `window.matchMedia` (return `matches: false` for any query containing `hover`/`pointer`) and `Object.defineProperty(navigator, 'maxTouchPoints', { value: 0 })` **before navigation**, so the override is in place before GSAP's `Observer` plugin runs its own detection at load time. This is the only way found in this sandbox to make headless Chrome take the same code path as a real mouse-driven browser for touch-gated GSAP logic.

**Fix** (`src/lib/components/Nav.svelte`, `src/lib/motion/smooth-scroll.ts`, `src/app.css`): (1) Nav's root `<header>` is now measured via `ResizeObserver` (bound with `bind:this`) and its live height written to a `--ga-nav-height` CSS custom property on `documentElement`, so it stays correct across responsive breakpoints and auth-state width changes. (2) `.ga-nav` gets `position: relative; z-index: 40` so it always stacks above the wrapper regardless of the wrapper's own positioning. (3) `publicSmoothScroll` (`smooth-scroll.ts`) now independently replicates GSAP's own branch check (`!matchMedia('(hover: none), (pointer: coarse)').matches`) right after creating the smoother, and stamps the *real* outcome onto the wrapper as `data-public-smooth-fixed="true"/"false"` (cleared in `killSmoother()` too) — this cannot be inferred from GSAP's own `data-public-smooth-scroll-ready` attribute, which is set in *both* branches. (4) `app.css` adds `padding-top: var(--ga-nav-height, 0px)` to `[data-public-smooth-content]`, scoped strictly to `[data-public-smooth-fixed="true"]` — scoping it to `-ready` instead (tried first) double-counts Nav's height in the "relative" branch, since that branch already reserves space for Nav via normal document flow, producing a large unwanted gap. Confirmed via the matchMedia-patch harness: pre-fix, forced-fixed-mode `heroChatRect.top` was `84` (inside Nav's `0–132.5` height range, i.e. overlapping); post-fix it's `217`, exactly matching the never-broken "relative-mode" position.

### 2026-07-06 — Wave-grid asset reworked into a shared loader/spinner (`POLISH-07H`); scene/layer logic generalized by fraction, not hardcoded index
Per direct user request (not a pre-existing workboard task — added retroactively as `POLISH-07H`), the `POLISH-07F` wave-grid asset moved from a homepage decoration (`WaveGridField.svelte`, a bounded band between hero and stats) to a reusable loader/spinner mounted in three places: `PageTransitionOverlay.svelte` (`variant="overlay"`), a new `InitialLoadScreen.svelte` boot splash (`variant="overlay"`, public routes only), and `Chat.svelte`'s "Searching notes…" placeholder (`variant="compact"`). The homepage band was removed entirely per the user's explicit choice, not replaced with a static fallback. The three.js scene/layer builder (`createWaveGridLayers` in the new `src/lib/motion/wave-grid-engine.ts`) previously hardcoded emphasis row/column indices (`[0, 4, 9]`/`[0, 9, 18]`) assuming the original 9-row/18-column grid; these are now computed as fractions of `config.rows`/`config.columns` (`fractionToIndex(0.5, rows)`, etc.) so the same builder produces a sensible emphasis pattern for both the original overlay-sized grid and a much smaller `WAVE_GRID_COMPACT_CONFIG` (8×5) used for the inline spinner — a future third grid size should work without touching this function, but verify emphasis placement visually if the row/column count gets very small (e.g. under ~4), since the 0/0.5/1 fraction split degenerates toward duplicate indices at small counts.

`PageTransitionOverlay.svelte` mounts the loader with `{#if showLoader}` rather than always-mounted-but-hidden, specifically so the three.js `requestAnimationFrame` loop and WebGL context only exist during the brief cover→reveal window of an actual navigation, not continuously for the app's whole lifetime (the overlay `<div>` itself is still mounted once in `+layout.svelte` for the whole session, per the existing `position: fixed` containing-block constraint — only the loader child inside it mounts/unmounts per navigation). `InitialLoadScreen.svelte` is gated to public routes only via the same `isPublicSmoothScrollPath` check already used for smooth scroll, matching `docs/styleguide.md` §7.1's "admin stays low-motion" rule — do not show boot splashes on admin/auth hard loads without a dedicated decision to change that scope.

Same day, follow-up: `InitialLoadScreen`'s min-display floor was changed from a `Promise.race` against a max-timeout cap (400ms min / 1200ms cap) to a `Promise.all([wait(1500ms), fontsReady])` with **no** upper cap, per direct user request ("hold to 1.5s for anything that lasts quicker, whatever loads later should just be whenever it loads"). The distinction matters: a `race`-with-cap can cut the splash short before real readiness on a slow load; `Promise.all` with no cap guarantees the splash never disappears before both conditions are met, at the cost of no longer having a safety net if `document.fonts.ready` never resolves (a rare browser bug) — accepted here since it was the explicit ask, but worth reconsidering if that scenario is ever reported. Verified via CDP (repeated `document.querySelector('.initial-load-screen')`/`.is-fading` polling at fixed wall-clock offsets from `Page.navigate`) that the splash mounts near `t≈500ms` (warm dev server), holds un-faded through `t≈1500ms`, starts fading by `t≈2000ms`, and is fully removed by `t≈2300ms` — i.e. held for the full floor, then gone shortly after, not before.

### 2026-07-06 — Theme toggle wave wipe (`POLISH-07I`) uses the native View Transitions API, not GSAP; `::view-transition-*` pseudo-elements must be styled globally, not in scoped component CSS
Per direct user request, `Nav.svelte`'s light/dark toggle now plays a left-to-right directional wipe instead of an instant class swap, using `document.startViewTransition()` (feature-detected via `typeof document.startViewTransition === 'function'`, additionally gated on `canUseSpatialMotion(window)`) wrapping the existing `.dark`-class toggle logic. This API automatically snapshots the before/after paint and exposes `::view-transition-old(root)`/`::view-transition-new(root)` pseudo-elements to animate between them — but these are **not real DOM nodes**: a Svelte component's scoped `<style>` block (which works by rewriting selectors to include a component-specific attribute) cannot target them at all, since there's no element to attach that attribute to. The wipe CSS (`old` gets `animation: none` and stays fully visible; `new` animates `clip-path` from `inset(0 100% 0 0)` to `inset(0 0 0 0)` over 550ms) had to go in the global `src/app.css`, reusing the exact same clip-path values `page-transition.ts`'s `PAGE_TRANSITION_IDLE_CLIP_PATH`/`PAGE_TRANSITION_COVERED_CLIP_PATH` already establish for the route-transition wipe, just written directly as CSS since there's no GSAP-tweenable element reference for a pseudo-element. TypeScript's bundled `lib.dom.d.ts` already types `Document.startViewTransition` as of the TS version pinned here (5.9.3, confirmed via `grep`) — no `@types` package or manual ambient declaration was needed. Verified live via CDP: `document.getAnimations({ subtree: true })` lists a running `theme-wave-wipe`-named animation ~80ms after clicking the toggle, and the list is empty again ~700ms after the click (past the 550ms duration) — this is the only way found to confirm a View Transition is actually animating (rather than silently no-op'ing) without a visual screenshot diff.

### 2026-07-07 — Chat expand (`POLISH-07J`): reparent to `document.body` for fixed overlays born inside `#smooth-content`; reparenting resets scroll + focus
`Chat.svelte`'s expand-to-centered-rectangle feature portals the live `<section>` to `document.body` before pinning it `position: fixed` (leaving a same-size placeholder in the hero grid), because a fixed element inside the ScrollSmoother-transformed `#smooth-content` resolves against the transform, not the viewport — the same constraint that forced `PageTransitionOverlay` outside the wrapper, but solved by runtime reparenting since the chat must live in the hero when collapsed. Two non-obvious side effects of moving a live Svelte component's DOM node: the inner scrollable viewport's `scrollTop` resets and the focused element loses focus, so both must be captured before the move and restored after (Svelte 5 state/handlers survive the move fine, including a mounted three.js `<canvas>`). Background scroll locks via `ScrollSmoother.get()?.paused(true)` when a smoother exists — `overflow: hidden` alone does not stop the smoother's scrolling.

### 2026-07-07 — Suggested-prompt chip uses a curated server lane; free-model reliability findings (nemotron/gemma)
The chat's empty-state "Try it" chip sends `SUGGESTED_CHAT_PROMPT` ("How does this site work?", exported from `src/lib/utils/chat-format.ts` and shared by `Chat.svelte` and `POST /api/chat` so the strings can never drift). The server answers it from a curated static reply (`SUGGESTED_PROMPT_REPLY`) instead of RAG because this was tested end-to-end first: the real pipeline passed the confidence gate but answered thinly ("I haven't written a technical architecture note yet") since the notes corpus doesn't document the site's own build — and the free-model path is too flaky for a guaranteed-good first impression. Model findings from that test: `google/gemma-4-31b-it:free` was 429 "temporarily rate-limited upstream" (transient, not retired — distinct from the earlier 404 pattern); `nvidia/nemotron-3-ultra-550b-a55b:free` works (clean `delta.content`, reasoning tokens stay in a separate `delta.reasoning` field so the client renders fine, just with a visible-answer delay) but intermittently returns an **in-band SSE error event with HTTP 200** (`"error":{"code":502,"message":"Upstream error from Nvidia: ResourceExhausted..."}` with empty `choices`) — a 200 status does not mean the stream carried an answer; check for in-band `error` events when evaluating models. The curated lane is matched by exact normalized equality only and must stay author-written text — see `docs/CONVENTIONS.md` chat lane ordering.

### 2026-07-07 — Correction: Svelte does NOT remove a reparented component node on unmount — collapse before teardown
The 2026-07-07 chat-expand discovery above claimed "Svelte removes the section itself" on unmount while the section is reparented to `document.body`. Wrong: SvelteKit page teardown removes the old page's subtree, and a node moved out of that subtree survives as a stranded orphan — user-visible as an unclosable fixed chat overlay persisting across SPA navigation (its `svelte:window` listeners are gone too, so Escape can't help). Any component that reparents its own DOM out of its subtree must move it back before teardown: `Chat.svelte` now runs `forceCollapseNow()` (kill in-flight GSAP tweens, then instant `restoreCollapsedState()`) from both `beforeNavigate` (early, deterministic) and the `$effect` teardown (fallback for non-navigation unmounts).
