# Glass Atlas — Architectural Decisions

Tracks open questions and resolved design decisions for Glass Atlas.

---

## Open Decisions

### OPEN-01 — Wikilinks Implementation Approach

**Question:** How should `[[wikilink]]` syntax be parsed, resolved, and stored — at render time, in a persistent link table, or both?
**Context:** The plan defers wikilinks to a later phase and notes two viable approaches: inline parsing at render time versus a `note_links` join table. The choice affects whether backlinks and a graph view are feasible without a schema migration later. The `note_links` table design is already anticipated in the schema notes.
**Options under consideration:**
1. **Parse at render time** — Process `[[slug]]` syntax in the markdown renderer on every page load, resolving slugs to `/notes/[slug]` links. Tradeoff: Zero schema changes, but backlinks and graph view are not possible without a full-table scan on every request.
2. **Maintain a `note_links` join table** — Populate `(source_id, target_id)` rows on note save. Tradeoff: Enables backlinks and graph view efficiently, but requires a migration and update logic on every note write.
3. **Both — render-time parsing and link table** — Parse inline for display and also write to `note_links` for backlinks and graph. Tradeoff: Full capability, but most implementation work; table and renderer must stay in sync.
**Blocking:** Nothing currently blocked. Wikilinks are not in Phase 1–5 scope.
**See also:** ARCHITECTURE.md (schema notes), PRD.md

---

### OPEN-02 — Rate Limiting Implementation

**Question:** How should per-IP rate limiting be enforced on the chat endpoint — via a Neon counter table, Vercel KV (Upstash Redis), or an in-memory Map?
**Context:** The plan identifies the need for rate limiting on the `/api/chat` route to prevent abuse and control OpenRouter API costs. Three approaches are noted but no decision was made. The choice has cost, accuracy, and operational complexity implications.
**Options under consideration:**
1. **Neon counter table** — Store request counts per IP in PostgreSQL. Tradeoff: Persists across deploys and is accurate across serverless instances, but adds a DB write on every chat request, increasing latency and cost.
2. **Vercel KV (Upstash Redis)** — Use a Redis-backed KV store for fast atomic increments. Tradeoff: Fast and accurate with no DB overhead, but introduces an additional dependency and billing surface.
3. **In-memory Map** — Track counts in a module-level Map on the edge function. Tradeoff: Zero cost and complexity, but resets on cold start and may undercount across concurrent instances.
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
