# PRD — Glass Atlas

> **Status** (2026-04-25)
>
> | Track | State |
> |---|---|
> | Shipped | Nothing yet |
> | In Progress | Nothing yet |
> | Planned | Phase 1–7 (full build + reader trust/navigation polish) |

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
Protected `/admin` routes (redirect to GitHub OAuth if unauthenticated). Note editor with Markdown input, section scaffolding, inline body media embeds (`{{media ...}}` tokens rendered in preview/public notes), and an optional cover media URL field (supported formats: JPEG, PNG, SVG, GIF, MP4 — see DECISIONS.md RESOLVED-14). First-party upload storage is Railway Buckets with presigned URL flow (see DECISIONS.md RESOLVED-13): `/admin/notes/new` stages uploads locally for preview and uploads on Create submit; `/admin/notes/[slug]/edit` uploads immediately. Embedding generated and stored on save.

### Phase 3 — Public Notes
`/notes` — browsable, filterable, and text-searchable note index (title and tag ILIKE search via `?q=` param). `/notes/[slug]` — individual note detail page. `NoteCard` component. Nav search icon links to `/notes?focus=search`. Cover media renders conditionally when a URL is set: JPEG/PNG/SVG/GIF via `<img>`, MP4 via `<video controls>` (no autoplay).

### Phase 4 — Chat
`/api/chat` RAG endpoint with anonymous browser-session rate limiting (10 messages/hour per session ID, 429 on the 11th). Session identity is stored in an opaque cookie and enforced server-side. Hybrid semantic/lexical retrieval uses pgvector chunk embeddings and confidence tiers: high-confidence evidence gets a direct streamed answer, borderline evidence gets a streamed limited-coverage answer with genuine adjacent sources, and low-confidence retrieval skips the LLM with a deterministic no-coverage fallback that does not show nearest-neighbor sources or related links. `Chat.svelte` component. `personality.ts` system prompt enforces grounding while using a relaxed, friendly, lightly playful first-person author voice. Answers should synthesize retrieved notes conversationally and may be more talkative when the retrieved evidence supports it; they should not copy retrieved excerpts verbatim unless the user explicitly asks for a quote.

### Phase 5 — Landing + Polish
`/` landing page with chat front-and-center and note preview cards. SEO includes site-level Open Graph metadata, per-note `<title>` + first-sentence descriptions on `/notes/[slug]`, and `sitemap.xml` entries for `/`, `/notes`, and each published note slug. The canonical visual target for all pages is `docs/styleguide.md` (Section 10) and the reference mockups in `reference/UI/design_handoff_glass_atlas/`. The chat-first hierarchy holds on both desktop and mobile: the collapsed single-column mobile layout shows the chat panel before the headline/CTA copy, not after (`POLISH-06`).

### Phase 6 — Agent-Assisted Authoring
A local `/write-post` skill lets the author direct an agent to draft a full note in the canonical blog voice (`docs/VOICE.md`) and persist it as a **draft** for review in `/admin`. The flow runs an extensive interview to nail the angle and factual spine, drafts in voice, scores the draft for voice fit / AI-tells (non-blocking — see DECISIONS.md OPEN-01), and writes via a local script through the existing `createNote()` + `reindexNoteAfterSave()` pipeline (so embeddings, chunks, and `[[wiki-link]]` graph are populated identically to hand-authored notes). The factual spine comes from the author's interview answers plus existing notes; any agent-added outside knowledge is flagged in the terminal for verification. This path is **draft-only** and never publishes (see DECISIONS.md RESOLVED-23).

### Phase 7 — Reader Trust + Navigation Polish
This phase keeps the site optimized for recruiters and developers evaluating the author's thinking. The landing page remains chat-first and automatically populated from published notes, but the surrounding reading experience becomes more connected and more transparent. Chat assistant messages with retrieved sources expose a subtle source button that opens a brief source popup: note titles and retrieved snippets are shown, and each source links to its note. Note detail pages emphasize semantic related notes plus backlinks/outlinks from the wiki-link table, while the existing small graph remains a supporting widget with planned interaction polish. Admin note editors show warning-only quality checks for stale semantic indexes, missing takeaways, no internal links, and weak titles. A public `/how-it-works` page explains the site in both reader-friendly and technical-colophon terms, including the stack and architecture without presenting the project as a portfolio page. Technical writing polish includes rendered Mermaid diagrams and richer code block controls (copy, language labels, optional filename labels, and wrapping controls) using the blueprint panel visual recipe.

---

## Out of Scope

- Real-time collaboration on notes
- Public user accounts or any visitor login flow
- Native mobile app
- Personal project showcase (handled by a separate portfolio site)
- Obsidian import pipeline — authoring happens through the admin editor or the local `/write-post` agent flow (Phase 6), not bulk import
- Topic/series/tag landing pages — deferred until the published corpus is large enough to support curated or filtered entry points
- Open Graph image generation — deferred for a separate planning pass

---

## Success Criteria

| # | Criterion | How to verify |
|---|---|---|
| 1 | Chat cites actual notes with working links | Manually ask a covered topic; response includes slug links that resolve |
| 2 | Chat handles insufficient coverage safely | Ask covered, borderline, and unrelated topics; covered topics answer from notes, borderline topics clearly frame related-but-limited coverage, and unrelated topics skip speculation |
| 3 | Admin publish flow works end-to-end | Create a note in `/admin`, publish it, confirm it appears on `/notes` immediately |
| 4 | Embedding is stored on save | Inspect the Neon console; embedding column is non-null after save |
| 5 | Rate limit enforces 10 msg/hour per anonymous browser session | Send 11 chat messages from one browser session; 11th returns HTTP 429 |
| 6 | `/admin` requires authentication | Visit `/admin` without a GitHub session; confirm redirect to OAuth |
| 7 | Public routes work without auth | Open `/notes` and chat in incognito; confirm full functionality |
| 8 | Chat source transparency links to real notes | Ask a covered topic; source button opens retrieved note snippets and links resolve |
| 9 | Note detail supports reader paths | Open a note with links/semantic neighbors; related notes and backlinks/outlinks are visible without disrupting reading |
| 10 | Admin editor quality checks warn without blocking | Open an imperfect draft; warnings appear, but save and publish remain available |
| 11 | Technical diagrams/code blocks are readable and usable | Open a note with Mermaid and code fences; diagram renders and code controls work |
| 12 | `/how-it-works` explains the site without portfolio framing or privacy/quota detail | Open `/how-it-works` without auth; page loads, covers notes/chat/stack/architecture, and omits rate-limit/privacy specifics |

---

## Constraints

- **LLM grounding** — all chat responses must be derived from retrieved notes only. Hallucination outside retrieved context is not acceptable.
- **No visitor PII** — visitor session IDs for rate limiting must be random, opaque, and anonymous (no account linkage, no personal identifiers). No personal data stored.
- **Rate limiting** — 10 chat messages per anonymous browser session per hour, enforced server-side, to control LLM API costs.
- **Session reset behavior** — clearing browser cookies may reset the anonymous chat quota. This is an accepted tradeoff for a no-login public visitor model.
- **Auth scope** — GitHub OAuth is for the single author only. No OAuth flows for visitors.
- **Stateless deployment** — hosted on Railway as a persistent Bun HTTP server. In-memory state may survive between requests on one instance, but chat quota correctness must not depend on process memory. State that must survive across deploys (including chat quota counters) lives in Neon PostgreSQL.
- **Stack is fixed** — SvelteKit + Svelte 5 (runes), TypeScript, Tailwind CSS v4, Bits UI, GSAP (for advanced motion), Neon PostgreSQL + pgvector, Drizzle ORM, OpenRouter (free chat model default with free-router fallback), Auth.js, Vitest.
- **Production migrations** — any task that introduces a database schema change must include generating the Drizzle migration and applying that migration to the production Neon database in the same task before it can be marked done.

---

## Non-Goals

- This site will not showcase personal projects — that is the role of the separate portfolio site.
- This site will not support multiple authors or any collaborative editing workflow.
- This site will not provide a native mobile app or PWA offline mode.
- The chat will not answer questions outside the scope of published notes, and will not be tuned to act as a general-purpose assistant.
