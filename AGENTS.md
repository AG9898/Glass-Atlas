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
