# PRD — Glass Atlas

> **Status** (2026-04-25)
>
> | Track | State |
> |---|---|
> | Shipped | Nothing yet |
> | In Progress | Nothing yet |
> | Planned | Phase 1–5 (full build) |

---

## Objective

Glass Atlas is a blog and editorial site for a single software developer to publicly document their experience, workflow, process, and knowledge. It is not a portfolio. Its primary differentiator is an LLM chat interface grounded strictly in the site's published notes — a recruiter or developer can ask "What does this person know about CI/CD?" and receive an answer sourced from real, linked notes rather than a generic summary.

---

## Users

| Role | Access | Auth |
|---|---|---|
| Visitor (public) | Read published notes, use the chat interface | None — always anonymous |
| Author / Admin | Create, edit, publish, and delete notes via `/admin` | GitHub OAuth (Auth.js) — one account only |

Visitors are never asked to log in. No visitor accounts exist. Session IDs for rate limiting are anonymous and contain no PII.

---

## Scope

### Phase 1 — Scaffold
Project skeleton: `package.json`, `svelte.config.js`, `vite.config.ts`, Drizzle schema (notes table, pgvector embeddings, Auth.js session/account tables), `hooks.server.ts` auth middleware.

### Phase 2 — Admin Notes CRUD
Protected `/admin` routes (redirect to GitHub OAuth if unauthenticated). Note editor with Markdown input and section scaffolding. Embedding generated and stored on save.

### Phase 3 — Public Notes
`/notes` — browsable, filterable, searchable note index. `/notes/[slug]` — individual note detail page. `NoteCard` component.

### Phase 4 — Chat
`/api/chat` RAG endpoint with IP-based rate limiting (10 messages/hour, 429 on the 11th). Semantic search against pgvector embeddings. Streaming SSE responses. `Chat.svelte` component. `personality.ts` system prompt that enforces grounding.

### Phase 5 — Landing + Polish
`/` landing page with chat front-and-center and note preview cards. SEO meta tags, `sitemap.xml`, final design pass.

---

## Out of Scope

- Real-time collaboration on notes
- Public user accounts or any visitor login flow
- Native mobile app
- Personal project showcase (handled by a separate portfolio site)
- Obsidian import pipeline — the admin editor is the sole authoring tool
- Note graph view / wikilinks rendering (deferred, approach TBD)

---

## Success Criteria

| # | Criterion | How to verify |
|---|---|---|
| 1 | Chat cites actual notes with working links | Manually ask a covered topic; response includes slug links that resolve |
| 2 | Chat declines out-of-scope topics | Ask about a topic with no note; response says "I don't have a note on that" |
| 3 | Admin publish flow works end-to-end | Create a note in `/admin`, publish it, confirm it appears on `/notes` immediately |
| 4 | Embedding is stored on save | Inspect the Neon console; embedding column is non-null after save |
| 5 | Rate limit enforces 10 msg/hour per IP | Send 11 chat messages from one IP; 11th returns HTTP 429 |
| 6 | `/admin` requires authentication | Visit `/admin` without a GitHub session; confirm redirect to OAuth |
| 7 | Public routes work without auth | Open `/notes` and chat in incognito; confirm full functionality |

---

## Constraints

- **LLM grounding** — all chat responses must be derived from retrieved notes only. Hallucination outside retrieved context is not acceptable.
- **No visitor PII** — visitor session IDs for rate limiting must be anonymous (IP hash or similar). No personal data stored.
- **Rate limiting** — 10 chat messages per IP per hour, enforced server-side, to control LLM API costs.
- **Auth scope** — GitHub OAuth is for the single author only. No OAuth flows for visitors.
- **Stateless deployment** — hosted on Vercel; no persistent in-memory state between requests. All state lives in Neon PostgreSQL.
- **Stack is fixed** — SvelteKit + Svelte 5 (runes), TypeScript, Tailwind CSS v4, Bits UI, GSAP (for advanced motion), Neon PostgreSQL + pgvector, Drizzle ORM, OpenRouter (Gemini Flash default), Auth.js, Vitest.

---

## Non-Goals

- This site will not showcase personal projects — that is the role of the separate portfolio site.
- This site will not support multiple authors or any collaborative editing workflow.
- This site will not provide a native mobile app or PWA offline mode.
- The chat will not answer questions outside the scope of published notes, and will not be tuned to act as a general-purpose assistant.
