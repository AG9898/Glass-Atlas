# Glass Atlas — Architectural Decisions

Tracks open questions and resolved design decisions for Glass Atlas.

---

## Open Decisions

### OPEN-02 — Rate Limiting Implementation

**Question:** How should per-IP rate limiting be enforced on the chat endpoint — via a Neon counter table, Upstash Redis, or an in-memory Map?
**Context:** The plan identifies the need for rate limiting on the `/api/chat` route to prevent abuse and control OpenRouter API costs. The choice has cost, accuracy, and operational complexity implications. Note: deployment has moved to Railway (persistent Bun server), so in-memory state now survives between requests — unlike on Vercel serverless. This significantly improves the viability of the in-memory Map approach.
**Options under consideration:**
1. **Neon counter table** — Store request counts per IP in PostgreSQL. Tradeoff: Persists across deploys and is accurate if scaled horizontally, but adds a DB write on every chat request, increasing latency and cost.
2. **Upstash Redis** — Use a Redis-backed KV store for fast atomic increments. Tradeoff: Fast and accurate with no DB overhead, but introduces an additional dependency and billing surface.
3. **In-memory Map** — Track counts in a module-level Map on the persistent server. Tradeoff: Zero cost and complexity; resets only on deploy (acceptable for a blog). Undercounts only if scaled beyond one instance (not expected at current scale).
**Blocking:** Phase 4 (chat endpoint implementation).
**See also:** ARCHITECTURE.md, ENV_VARS.md

---

### OPEN-03 — Embedding Model Selection

**Question:** Which embedding model should be used to generate note vectors — `text-embedding-3-small` via OpenRouter, or a dedicated third-party embedding service?
**Context:** The plan specifies `vector(1536)` in the pgvector schema, which is consistent with `text-embedding-3-small` (1536 dimensions), but notes "OpenRouter or dedicated embedding model" without committing to either. The choice affects retrieval quality, API key management, and cost.
**Options under consideration:**
1. **`text-embedding-3-small` via OpenRouter** — 1536 dimensions, cheap, and keeps the stack to a single API key. Tradeoff: Embedding quality is good but not state-of-the-art; couples embeddings to OpenRouter availability.
2. **Dedicated embedding service (e.g. Voyage AI, Cohere)** — Potentially higher retrieval quality, especially for longer documents. Tradeoff: Adds a separate API key, separate billing, and another external dependency to manage.
**Blocking:** Phase 2 (embeddings.ts implementation).
**See also:** ARCHITECTURE.md (pgvector schema), ENV_VARS.md

---

## Resolved Decisions

### RESOLVED-08 — Wiki-link Implementation Approach (Both Render-time + Link Table)

**Resolved:** 2026-04-27
**Decision:** Option 3 — parse `[[slug]]` / `[[slug|text]]` at render time for display and maintain the `note_links` join table for backlinks and graph capability.
**Why:** Render-time parsing alone cannot support backlinks or graph views without a full-table scan on every request. The join table enables `getBacklinks()` and `getOutlinks()` efficiently. The extra write cost (one `syncNoteLinks()` call per note save) is negligible for a single-author blog.
**Alternatives rejected:** Render-time-only was rejected because it makes backlinks impractical at scale. Link-table-only was rejected because a render-time fallback is still needed for forward references (target note may not exist yet).
**Affects:** `src/lib/utils/wiki-links.ts`, `src/lib/server/db/notes.ts` (`syncNoteLinks`), `src/lib/server/db/schema.ts` (`note_links` table), ARCHITECTURE.md

---

### RESOLVED-09 — Admin Markdown Editor: CodeMirror 6 + Split-Pane

**Resolved:** 2026-04-27
**Decision:** Use CodeMirror 6 with `@codemirror/lang-markdown` as the admin note editor, displayed as a split-pane layout (markdown source left, rendered preview right). TipTap WYSIWYG was rejected.
**Why:** Note bodies are stored and processed as raw markdown throughout the pipeline — `parseWikiLinks`, `renderWikiLinks`, and the embedding pipeline all operate on the raw string. CodeMirror sources markdown natively with no serialization round-trip. The `@codemirror/autocomplete` package provides a first-class API for the `[[` wiki-link completion trigger. The split-pane tradeoff (author sees syntax) is acceptable for a single-author admin tool where source precision is more valuable than WYSIWYG feel.
**Alternatives rejected:** TipTap was rejected because its `@tiptap/extension-markdown` serialization layer adds a format conversion step with no benefit here, and its Svelte 5 integration requires more boilerplate. Plain textarea + split-pane was rejected because it offers no wiki-link autocomplete without significant custom work.
**Affects:** ARCHITECTURE.md, CONVENTIONS.md, `src/lib/components/MarkdownEditor.svelte` (to be created), admin note form routes

---

### RESOLVED-10 — LLM Note Critique: Free OpenRouter Model, Non-Blocking

**Resolved:** 2026-04-27
**Decision:** Add an optional "Review" button to the admin editor that streams an LLM critique of the note body via `POST /api/admin/notes/[slug]/review`, using a free-tier OpenRouter model (e.g. `google/gemini-2.0-flash-exp:free`). Critique is never a gate on saving or publishing.
**Why:** A single author triggers at most a handful of reviews per day — well within the 200 req/day free-tier limit. Making critique optional and non-blocking means free model unavailability or rate-limit hits (`429`, `503`) never interrupt the authoring flow. Paid models were rejected for a quality-of-life feature on a personal tool.
**Alternatives rejected:** Blocking save on critique was rejected — it couples publishing to free model availability. Running critique on every save automatically was rejected as wasteful and disruptive to flow.
**Affects:** ARCHITECTURE.md, CONVENTIONS.md, `src/lib/server/ai/review.ts` (to be created), `src/routes/api/admin/notes/[slug]/review/+server.ts` (to be created)

---

### RESOLVED-06 — Database Schema Strategy (Shared Neon, Separate Postgres Schema)

**Resolved:** 2026-04-27
**Decision:** Use the same Neon project and database as the Techy project, but scope all Glass Atlas tables to a dedicated `glass_atlas` Postgres schema. Techy continues to use the default `public` schema.
**Why:** Keeps a single Neon compute tier (lower cost) while maintaining full table isolation. Postgres schemas allow cross-schema SQL queries when needed (e.g. importing or referencing Techy notes). Drizzle's `pgSchema('glass_atlas')` scopes all ORM operations automatically.
**Alternatives rejected:** Separate Neon databases were rejected because they don't support cross-database SQL in Postgres, requiring HTTP API calls to cross-reference data. Fully merged tables (shared schema with an `app` discriminator) were rejected as too tightly coupled.
**Affects:** ARCHITECTURE.md, ENV_VARS.md, src/lib/server/db/schema.ts, src/lib/server/db/index.ts

---

### RESOLVED-07 — Deployment Platform (Railway + Bun, not Vercel)

**Resolved:** 2026-04-27
**Decision:** Deploy to Railway using the SvelteKit node adapter with Bun as the runtime, instead of Vercel serverless functions.
**Why:** The RAG chat endpoint streams long-lived responses — a poor fit for serverless function timeout limits and cold starts. A persistent Bun server on Railway eliminates both problems. Railway's Hobby plan (~$5/mo) is sufficient for blog-scale traffic. Bun's fast startup and lower memory overhead are a natural fit for the node adapter output.
**Alternatives rejected:** Vercel was rejected because serverless cold starts degrade streaming chat UX and function timeouts are a risk for long completions. Fly.io, Render, and Hetzner+Coolify were considered; Railway was chosen for the best DX/cost tradeoff at this scale.
**Affects:** ARCHITECTURE.md, ENV_VARS.md, svelte.config.js, package.json (adapter swap), CLAUDE.md

---

### RESOLVED-01 — LLM Model Choice

**Resolved:** 2026-04-25
**Decision:** Use `google/gemini-2.0-flash-001` via OpenRouter as the default chat model.
**Why:** Delivers ~400–600 ms time-to-first-token, streams reliably, and follows system-prompt personality injection well. Cost is appropriate for personal blog scale.
**Alternatives rejected:** GPT-4o and Claude Sonnet were rejected for 2–5x slower TTFT. Llama 3.1 8B was rejected for weaker instruction-following with personality-injected prompts.
**Affects:** ARCHITECTURE.md, ENV_VARS.md (OPENROUTER_API_KEY)

---

### RESOLVED-02 — Authentication Scope

**Resolved:** 2026-04-25
**Decision:** Auth.js with GitHub OAuth for admin access only. All visitors are permanently anonymous.
**Why:** Only one author exists, so visitor accounts add no value. GitHub OAuth is simple to configure and is familiar to the target audience of the blog.
**Alternatives rejected:** Email/password auth was rejected as overkill for a single-user system. Supabase Auth was rejected to avoid adding an extra dependency.
**Affects:** ARCHITECTURE.md, hooks.server.ts

---

### RESOLVED-03 — Site Framing (Blog vs. Portfolio)

**Resolved:** 2026-04-25
**Decision:** Glass Atlas is an editorial and knowledge blog, not a portfolio site.
**Why:** A portfolio communicates finished work; a blog communicates how the author thinks. A separate portfolio site already exists, so duplicating that framing here would be redundant and dilute the editorial identity.
**Alternatives rejected:** Portfolio-first framing was rejected because the author has an explicit dedicated portfolio site and wants this project to serve a distinct purpose.
**Affects:** PRD.md

---

### RESOLVED-04 — Chat Response Delivery (Streaming vs. Buffered)

**Resolved:** 2026-04-25
**Decision:** Deliver chat responses as a ReadableStream over Server-Sent Events (SSE), not as a buffered JSON response.
**Why:** Time-to-first-token is the primary chat UX metric. Streaming makes a 3-second full-generation feel fast by showing text immediately. A buffered response forces the user to wait for the entire generation before seeing anything.
**Alternatives rejected:** Buffered JSON response was rejected because the resulting perceived latency is unacceptable for a conversational interface.
**Affects:** ARCHITECTURE.md, CONVENTIONS.md, src/routes/api/chat/+server.ts

---

### RESOLVED-05 — Prompt Context Content (Takeaway + First Paragraph vs. Full Bodies)

**Resolved:** 2026-04-25
**Decision:** Inject only the Takeaway section and the first paragraph of each retrieved note into the chat prompt, not full note bodies.
**Why:** Reduces prompt token count, which lowers generation latency and cost. The Takeaway section is explicitly designed to be the LLM's anchor — a dense summary of the note's core argument — making it the highest-signal content per token.
**Alternatives rejected:** Sending full note bodies was rejected for higher latency, higher per-request cost, and context dilution that can degrade response quality.
**Affects:** ARCHITECTURE.md, src/lib/server/chat.ts
