# Glass Atlas

<p align="left">
  <img src="./static/favicon.png" alt="Glass Atlas logo" width="120">
</p>

<p align="left">
  <a href="https://kit.svelte.dev/"><img alt="SvelteKit" src="https://img.shields.io/badge/SvelteKit-2.x-FF3E00?style=flat-square&logo=svelte&logoColor=white"></a>
  <a href="https://svelte.dev/"><img alt="Svelte 5" src="https://img.shields.io/badge/Svelte-5.x-FF3E00?style=flat-square&logo=svelte&logoColor=white"></a>
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white"></a>
  <a href="https://tailwindcss.com/"><img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind-4.x-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white"></a>
  <a href="https://orm.drizzle.team/"><img alt="Drizzle ORM" src="https://img.shields.io/badge/Drizzle-ORM-C5F74F?style=flat-square"></a>
  <a href="https://neon.tech/"><img alt="Neon Postgres" src="https://img.shields.io/badge/Neon-Postgres-00E699?style=flat-square"></a>
  <a href="https://openrouter.ai/"><img alt="OpenRouter" src="https://img.shields.io/badge/OpenRouter-LLM_API-111827?style=flat-square"></a>
</p>

Glass Atlas is a SvelteKit editorial knowledge site for a single author. It combines:

- A public notes library (`/notes`)
- A protected admin writing workspace (`/admin`)
- A streaming, grounded RAG chat experience (`/api/chat`) that answers from published notes only

The project is designed for deploy-on-push hosting (Railway), Neon Postgres + pgvector retrieval, and strict server-side boundaries for auth, DB, and AI I/O.

## What It Includes

- GitHub OAuth-protected admin authoring flow (Auth.js)
- Markdown note CRUD with wiki-link support and note relationships
- Write-time embeddings for notes/chunks (OpenRouter embeddings)
- Public semantic chat with SSE streaming and anonymous cookie-based rate limiting
- First-party media upload path via private Railway Buckets + presigned URLs
- Typed server architecture (SvelteKit + TypeScript + Drizzle)

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | SvelteKit 2 + Svelte 5 (runes) |
| Language | TypeScript (strict mode) |
| Styling/UI | Tailwind CSS v4, Bits UI, GSAP |
| Database | Neon PostgreSQL (`glass_atlas` schema) |
| Vector search | `pgvector` cosine similarity |
| ORM / Migrations | Drizzle ORM + drizzle-kit |
| AI provider | OpenRouter (chat + embeddings) |
| Auth | Auth.js + GitHub OAuth |
| Storage | Railway Storage Buckets (private, S3-compatible) |
| Runtime / Deploy | Bun HTTP server on Railway via `@sveltejs/adapter-node` |
| Testing | Vitest + ESLint + TypeScript + svelte-check |

## Architecture Snapshot

```text
src/
  lib/server/      # DB, chat orchestration, embeddings, personality, storage
  lib/components/  # UI components (chat, cards, editors, nav)
  lib/utils/       # slugify, taxonomy, wiki-link, preview utilities
  routes/          # pages + API endpoints
  hooks.server.ts  # auth/session guard rails
docs/              # PRD, architecture, conventions, env, testing, decisions
```

Key architectural rules:

- External I/O stays server-side (`src/lib/server/**`, API handlers, server load/actions)
- Chat responses stream via `ReadableStream`/SSE (never buffered JSON)
- Personality/system prompt is centralized in `src/lib/server/personality.ts`
- Embeddings are generated on note save/update (not from full note bodies at query time)

## Quick Start

```bash
npm install
cp .env.example .env.local
# fill .env.local
npm run dev
```

Open `http://localhost:5173`.

## Environment Setup

Minimum required values (local/dev):

- `DATABASE_URL`
- `OPENROUTER_API_KEY`
- `AUTH_SECRET`
- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`
- `PUBLIC_SITE_URL`

Optional/feature-scoped:

- `AUTH_BYPASS=TRUE` (localhost development only)
- `BUCKET`, `ENDPOINT`, `REGION`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY` (first-party media uploads)
- model/rate limit overrides (`OPENROUTER_MODEL`, `EMBEDDING_MODEL`, `CHAT_RATE_LIMIT_*`)

See [docs/ENV_VARS.md](docs/ENV_VARS.md) for the full matrix and import rules.

## Use This Repo As a Template

If you want to bootstrap your own knowledge blog/chat system from this codebase:

1. Create your own repository from this one.
   - GitHub UI: `Use this template`
   - Or clone and re-publish under a new remote
2. Update project identity.
   - `package.json` name/version/description
   - app metadata/title and social URLs
   - `PUBLIC_SITE_URL` for your domain
3. Provision infrastructure.
   - Neon Postgres database
   - Enable `pgvector`: `CREATE EXTENSION IF NOT EXISTS vector;`
   - Optional Railway Storage Bucket for media uploads
4. Configure auth for your admin account.
   - Create a GitHub OAuth app
   - Add callback URLs:
     - local: `http://localhost:5173/auth/callback/github`
     - prod: `https://<your-domain>/auth/callback/github`
5. Configure secrets/env vars in `.env.local` and your deployment platform.
6. Run schema migrations.
   - Standard: `npm run db:migrate`
   - WSL2/non-interactive fallback: `npm run db:migrate:http`
7. Start and verify locally.
   - `npm run dev`
   - create/publish a note in `/admin`
   - confirm it appears in `/notes`
   - test `/api/chat` responses are grounded in your content
8. Deploy to Railway (or compatible Node adapter host) and set all production env vars.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | TypeScript + ESLint |
| `npm run check` | `svelte-kit sync` + `svelte-check` |
| `npm run test` | Vitest (watch) |
| `npm run test:run` | Vitest one-shot (CI style) |
| `npm run db:generate` | Generate Drizzle migration files |
| `npm run db:migrate` | Apply migrations via drizzle-kit |
| `npm run db:migrate:http` | Apply migrations via Neon HTTP fallback |
| `npm run db:push` | Push schema via drizzle-kit |
| `npm run db:studio` | Open Drizzle Studio |

## Documentation Map

- [docs/PRD.md](docs/PRD.md) — product goals and scope
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — full topology/data flow
- [docs/CONVENTIONS.md](docs/CONVENTIONS.md) — coding and architecture rules
- [docs/DECISIONS.md](docs/DECISIONS.md) — architecture decision log
- [docs/ENV_VARS.md](docs/ENV_VARS.md) — env var contract
- [docs/TESTING.md](docs/TESTING.md) — testing strategy
- [docs/workboard.md](docs/workboard.md) — task lifecycle and board rules

## Notes for Contributors

- Keep server/client boundaries strict (no server module imports in client components)
- Keep documentation in sync with code changes in the same commit
- Run fast verification before completion:

```bash
npm run test:run
npm run lint
```
