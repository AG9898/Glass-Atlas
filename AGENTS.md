# Glass Atlas — Agent Working Guide

<!-- AGENTS.md is the canonical file. CLAUDE.md is a symlink to it.              -->
<!-- To set up after copying this file: ln -sf AGENTS.md CLAUDE.md               -->
<!-- This file is a LIVING DOCUMENT — update it after every task cycle.          -->

---

## Overview

Glass Atlas is a blog/editorial SvelteKit site where the primary content is structured knowledge notes written by the author. Agents implement workboard tasks: scaffold, note CRUD, RAG chat, public browse, and polish. The canonical task queue is `docs/workboard.json`. Skills are available at `.claude/skills/` (synced from ag.dev).

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
      admin/notes/+server.ts
      admin/notes/[slug]/+server.ts
  hooks.server.ts                       — Auth.js middleware + /admin route guard
docs/
  INDEX.md              — documentation navigation map
  PRD.md                — product requirements and scope
  ARCHITECTURE.md       — system topology and boundaries
  CONVENTIONS.md        — coding standards and patterns
  DECISIONS.md          — architectural decision log
  ENV_VARS.md           — environment variable matrix
  TESTING.md            — test strategy and inventory
  workboard.json        — canonical task queue
  workboard.schema.json — JSON Schema for task queue
  workboard.md          — workboard field definitions and usage rules
```

Docs navigation: [`docs/INDEX.md`](docs/INDEX.md)

---

## Architecture

- All external I/O (Neon, OpenRouter) goes through `src/lib/server/` — never in client components.
- Embeddings are generated at note save time (`embeddings.ts`), not at query time.
- Auth is enforced in `src/hooks.server.ts` — no client-side-only guards on `/admin` routes.
- The personality block always loads from `personality.ts` — never hardcoded in `chat.ts`.
- Chat responses stream via `ReadableStream` (SSE) — never buffered JSON.
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

Use the `/query-workboard` skill to inspect it. Use the `/start-task` skill to execute a task end-to-end. Never dump the full board into context — use targeted `jq` queries.

A task is startable when:
- `status == "todo"`
- `blocked_by` is empty or missing
- all `depends_on` tasks have `status == "done"`

Targeted edit rules:
- Never rewrite the full `workboard.json`.
- Only update the status fields of the task currently being worked.
- Roll back `in_progress → todo` if blocked mid-task and unresolved.

Task group IDs for this project: `SCAFFOLD`, `ADMIN`, `PUBLIC`, `CHAT`, `POLISH`.

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

- Neon uses the **serverless HTTP driver** (not TCP). Import from `@neondatabase/serverless`, not `pg`. TCP connections time out on Vercel.
- pgvector cosine similarity requires the `vector` extension enabled on the Neon project. Run `CREATE EXTENSION IF NOT EXISTS vector;` in the Neon console before first migration.
- Auth.js on Vercel requires `AUTH_TRUST_HOST=true` — without it, OAuth callbacks fail silently.
- SvelteKit's `$env/static/private` is only accessible in server-side files. Importing it in a `.svelte` file causes a build error.
- Streaming responses from `/api/chat` must use `return new Response(stream)` — SvelteKit's `json()` helper buffers the full response before sending.

---

## Environment Variables

See [`docs/ENV_VARS.md`](docs/ENV_VARS.md) for the canonical variable and secret matrix.

Key variables: `DATABASE_URL`, `OPENROUTER_API_KEY`, `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_TRUST_HOST` (Vercel only), `PUBLIC_SITE_URL`.

---

## Testing

Run `npm run test:run` (Vitest, CI mode) before marking any task done.

Full test strategy, file inventory, and patterns for writing new tests: [`docs/TESTING.md`](docs/TESTING.md)

---

## Deployment

Deployments are CI-only via Vercel. Pushing to `main` triggers a production deploy automatically. Never manually push secrets or deploy from a local machine. Staging uses a separate Neon branch — set `DATABASE_URL` to the branch connection string in Vercel's staging environment.

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
