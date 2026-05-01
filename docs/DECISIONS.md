# Glass Atlas — Architectural Decisions

Tracks open questions and resolved design decisions for Glass Atlas.

---

## Open Decisions

No open decisions right now.

---

## Resolved Decisions

### RESOLVED-18 — Chat Retrieval Orchestration (Always-On Light Hybrid + Confidence-Gated Fallback)

**Resolved:** 2026-04-30
**Decision:** For chat retrieval, use an always-on light hybrid strategy: run semantic retrieval (chunk similarity once chunk model ships) and topic/lexical retrieval in parallel, fuse/rerank a small candidate set server-side, and only answer directly when confidence is sufficient. When confidence is low, respond with an explicit limited-coverage fallback and provide related-topic note links (italicized footer), rather than speculating.
**Why:** Chunked semantic retrieval improves granularity but can still surface near-neighbor context that is semantically adjacent yet not answer-complete. Always-on hybrid retrieval improves precision/recall balance and reduces wrong-but-confident responses. Confidence gating preserves trust by preferring transparent fallback over speculative completion.
**Alternatives rejected:** Fallback-only lexical/topic retrieval was rejected because it still allows borderline semantic misses to be answered too confidently before fallback logic runs. Pure vector-only retrieval was rejected for insufficient precision on topic-framed questions. LLM-driven DB/tool queries were rejected for higher latency variance, weaker determinism, and unnecessary complexity at this scale.
**Affects:** docs/PRD.md, docs/ARCHITECTURE.md, docs/CONVENTIONS.md, docs/TESTING.md, docs/workboard.json (CHAT retrieval tasks)
**Implementation status (2026-04-30):** Decision accepted and queued for CHAT task execution; production retrieval remains the existing note-level semantic flow until CHAT retrieval tasks ship.

### RESOLVED-17 — Chat Quota Identity Strategy (Anonymous Cookie Session, DB-Backed Counter)

**Resolved:** 2026-04-30
**Decision:** Enforce `/api/chat` quota per anonymous browser session cookie, not per IP. Use an opaque random `chat_session` token stored in an HTTP-only cookie and persist counters in Neon (`chat_rate_limits`) keyed by a hash of that token. Keep the quota at 10 requests per 60 minutes by default.
**Why:** Per-IP limiting can unfairly throttle multiple users behind the same network and does not map to "one visitor = one quota bucket." Anonymous cookie sessions better match user-level fairness without adding visitor accounts or PII. DB-backed counters survive deploy/restart and support consistent enforcement.
**Alternatives rejected:** In-memory IP map was rejected because it is tied to process lifetime and remains unfair for shared IPs. Redis-backed counters were rejected for now to avoid adding another paid service/dependency at this scale. Visitor login/accounts were rejected because public chat is intentionally anonymous.
**Accepted tradeoff:** Clearing browser cookies resets the anonymous session quota; this is explicitly accepted for the no-login visitor model.
**Affects:** docs/PRD.md, docs/ARCHITECTURE.md, docs/CONVENTIONS.md, docs/ENV_VARS.md, docs/TESTING.md, chat rate-limit implementation tasks
**Implementation status (2026-05-01):** Mostly implemented. `CHAT-05A` shipped the DB layer migration (`chat_rate_limits.ip_hash` -> `session_hash`) and atomic quota persistence helper (`consumeChatRateLimit`), and `CHAT-05B` shipped `/api/chat` cookie issuance + per-session enforcement before retrieval/LLM work with route-level coverage. Additional quota test hardening remains queued in `CHAT-05C`.

### RESOLVED-16 — Semantic Retrieval Upgrade Direction (Chunked + OpenRouter)

**Resolved:** 2026-04-30
**Decision:** Keep OpenRouter-hosted embeddings for now (`text-embedding-3-small`, `vector(1536)`) and evolve retrieval from one-vector-per-note to section-aware chunk embeddings. Chunk payloads should include note metadata context (`title`, `category`, `tags`, `series`) alongside chunk text, and chat context should use a hybrid format: note summary (`takeaway`/fallback) plus top retrieved chunk excerpt(s).
**Why:** The current body-level single vector is cheap and simple but can blur intent for targeted queries. Section-aware chunk vectors improve semantic precision and recall without introducing a new provider or inference infrastructure. Metadata inclusion helps taxonomy-driven matching while preserving semantic body grounding.
**Alternatives rejected:** Staying with one vector per full note was rejected due lower retrieval granularity. Switching to self-hosted embeddings now was rejected due operational overhead and migration complexity for this phase.
**Affects:** docs/workboard.json, docs/ARCHITECTURE.md, docs/CONVENTIONS.md, docs/TESTING.md
**Implementation status (2026-05-01):** `CHAT-04A` shipped the chunk storage/retrieval foundation (`note_chunks` schema + indexes, `replaceNoteChunks`, `searchChunksBySimilarity`). Chat orchestration still uses note-level retrieval in production; chunk generation, prompt integration, and hybrid rerank steps remain queued in later CHAT tasks.

---

### RESOLVED-15 — Admin Split-Pane Preview Strategy (Live Typing, Client-Local)

**Resolved:** 2026-04-30
**Decision:** Implement admin markdown preview as a live split-pane on both `/admin/notes/new` and `/admin/notes/[slug]/edit`, updating on every editor change with a client-local pipeline (`body` state -> `renderWikiLinks` -> markdown-to-HTML preview render). Do not call server endpoints while typing.
**Why:** The authoring workflow needs immediate structural feedback without save/preview navigation loops. Keeping preview rendering local avoids avoidable latency and avoids coupling typing UX to network/auth state. It also preserves the raw-markdown source-of-truth model from RESOLVED-09.
**Alternatives rejected:** Server-roundtrip preview endpoints were rejected because keystroke-driven network requests add latency/failure modes and provide no value for single-author admin UX. Exact public-renderer parity in the editor pane (including server-side highlight details) was rejected as unnecessary complexity for typing-time feedback.
**Affects:** docs/ARCHITECTURE.md, docs/CONVENTIONS.md, docs/TESTING.md, admin note form routes, `src/lib/components/MarkdownEditor.svelte`

---

### RESOLVED-14 — Media Type Scope for Notes (JPEG/PNG/SVG/GIF/MP4)

**Resolved:** 2026-04-28
**Decision:** Support these cover media types only: JPEG, PNG, SVG, GIF, and MP4 video. Implement with a `media_type` column that accepts `'image-jpeg' | 'image-png' | 'image-svg' | 'image-gif' | 'video-mp4'`.
**Why:** This set covers current editorial needs (still captures, lightweight diagrams, animated GIF demos, and short MP4 demos) without introducing broad codec/embed complexity. Restricting to explicit formats keeps validation, rendering behavior, and accessibility requirements deterministic across admin and public surfaces.
**Alternatives rejected:** Third-party video embeds were rejected (no iframe provider dependency, no autoplay/embed policy complexity). Open-ended "any image/video URL" support was rejected due validation and UX inconsistency risk.
**Affects:** docs/ARCHITECTURE.md, docs/PRD.md, docs/styleguide.md, docs/workboard.json (ADMIN-06 chain)
**Implementation status (2026-04-30):** `ADMIN-06a` + `ADMIN-06b` are shipped. `notes.media_type` is persisted through admin create/edit form actions, admin forms expose the five-option media type selector beside the cover URL input, and public note renderers dispatch by `media_type` (`<img>` for image types, `<video controls preload="metadata">` for `video-mp4`) inside 16/9 containers with no autoplay.

### RESOLVED-13 — Asset Storage Strategy (Railway Bucket + Presigned URLs)

**Resolved:** 2026-04-28
**Decision:** Use Railway Storage Buckets for first-party note media uploads, with presigned URLs for both upload and public delivery. Bucket objects remain private; public media access is granted via time-limited presigned GET URLs (or backend proxy only when transformation/access-control logic is required).
**Why:** The app already deploys on Railway, so bucket credentials and environment scoping integrate cleanly with current operations. Railway Buckets are S3-compatible and align with project scale/cost goals. S3 was rejected due higher bandwidth cost profile for this use case; adding an extra external provider (R2) was rejected because Railway now offers native buckets with the required functionality.
**Alternatives rejected:** URL-reference-only was rejected as the long-term default because it keeps hosting responsibility outside the app and blocks first-party upload UX. Cloudflare R2 was rejected for now because it adds another provider without enough upside over Railway-native buckets for this project. AWS S3 was rejected for higher expected egress cost and added account/policy overhead.
**Affects:** docs/ARCHITECTURE.md, docs/ENV_VARS.md, docs/styleguide.md, ADMIN-06 planning assumptions
**Implementation status (2026-04-30):** `ADMIN-07` ships this decision with `POST /api/admin/media/upload-url` (admin-only MIME-validated presigned `PUT`) and `GET /api/admin/media/access-url?key=...` (public redirect to presigned `GET`). Admin new/edit forms now upload directly to the bucket and persist the stable app access path in `notes.image`.

### RESOLVED-12 — Audit-Driven Dependency Remediation Scope

**Resolved:** 2026-04-28
**Decision:** Apply `npm audit` remediation for direct high-risk dependencies now (`drizzle-orm` and `drizzle-kit`), and intentionally defer the remaining low/moderate transitive advisories tied to the `cookie` chain and Drizzle tooling internals.
**Why:** `drizzle-orm@0.39.3` was below the patched threshold for GHSA-gpj5-g38j-94v9, so moving to `0.45.2` was a required production-safety fix. `drizzle-kit` was also upgraded (`0.30.6` -> `0.31.10`) to reduce tooling exposure while preserving current project compatibility. Remaining advisories are either low-severity and transitive via `@sveltejs/kit`/`cookie@0.6.x`, or moderate findings on dev tooling internals that do not currently have a clean, non-breaking path under the existing stack constraints.
**Alternatives rejected:** Forcing `cookie` overrides or major framework shifts purely to silence low audit noise was rejected due to avoidable compatibility risk and unclear security payoff for this deployment profile.
**Affects:** package.json, package-lock.json, AGENTS.md

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
**Decision:** Add an optional manual "Review" button to both admin note editors (new + edit) that streams an LLM critique via `POST /api/admin/notes/review`, using a free-tier OpenRouter model (e.g. `google/gemini-2.0-flash-exp:free`). The endpoint accepts `{ title, takeaway, body }` from current form state so unsaved drafts can be reviewed. Critique is never a gate on saving or publishing.
**Why:** A single author triggers at most a handful of reviews per day — well within the 200 req/day free-tier limit. Making critique optional and non-blocking means free model unavailability or rate-limit hits (`429`, `503`) never interrupt the authoring flow. Paid models were rejected for a quality-of-life feature on a personal tool.
**Alternatives rejected:** Blocking save on critique was rejected — it couples publishing to free model availability. Running critique on every save automatically was rejected as wasteful and disruptive to flow. A slug-only endpoint was rejected because it cannot serve new unsaved drafts cleanly.
**Affects:** ARCHITECTURE.md, CONVENTIONS.md, `src/lib/server/ai/review.ts` (to be created), `src/routes/api/admin/notes/review/+server.ts` (to be created)

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

---

### RESOLVED-11 — Public Note Renderer: unified + remark-gfm + rehype-shiki

**Resolved:** 2026-04-28
**Decision:** Render public note bodies using `unified` with `remark-gfm` and `rehype-shiki` for syntax-highlighted code blocks.
**Why:** The wiki-link pipeline (`renderWikiLinks`) already requires an AST-aware pass to avoid matching inside code fences. A `remark` plugin integrates at the AST level and eliminates that fragility. `rehype-shiki` produces high-quality, theme-aware syntax highlighting with no extra configuration. `unified` is the most future-proof foundation — additional plugins (footnotes, callouts, etc.) can be added without changing the rendering architecture.
**Alternatives rejected:** `marked` was rejected because its plugin system is thin and wiki-link handling would remain a regex pass. `markdown-it` was rejected as a smaller ecosystem with less idiomatic Svelte/Vite integration.
**Affects:** src/routes/notes/[slug]/+page.svelte, PUBLIC-02 workboard task
