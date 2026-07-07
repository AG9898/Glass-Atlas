# Glass Atlas — Architectural Decisions

Tracks open questions and resolved design decisions for Glass Atlas.

---

## Open Decisions

### OPEN-01 — Should the draft-review score ever gate publishing, and at what threshold?

**Raised:** 2026-06-08
**Question:** The `/write-post` draft-review scorer (`src/lib/server/ai/draft-review.ts`) produces a 0–100 voice/AI-tell score. Today it is **recorded and shown but never enforced** — no draft is blocked by a low score. Should a minimum score ever become a soft gate (warn-and-confirm) or hard gate (block save) once the scoring is calibrated against real published posts? If so, what threshold, and on which dimension(s)?
**Why deferred:** The scorer is new and uncalibrated. Thresholds set before we have a corpus of human-approved posts would be guesswork and would risk blocking good writing or rubber-stamping bad writing. We need real score distributions across genuinely-good and genuinely-AI-leaning drafts first.
**Resolution criteria:** Revisit after enough posts have gone through the flow to plot score distributions. Decide gate type (none / soft / hard), threshold value(s), and which dimensions count.
**Affects:** `src/lib/server/ai/draft-review.ts`, `.claude/skills/write-post/SKILL.md`, docs/CONVENTIONS.md, docs/VOICE.md

---

## Resolved Decisions

### RESOLVED-25 — Chat Response Quality and Model Fallback Refresh

**Resolved:** 2026-07-07
**Decision:** Tune chat for conversational synthesis over excerpt repetition while preserving strict grounding. Retrieved chunks remain the only factual source, but the prompt should explicitly tell the model to paraphrase, connect evidence, and be more talkative/verbose when the retrieved notes support a fuller answer; verbatim quotation should be reserved for quote-seeking user requests. Retrieval should exclude stale/pending/failed semantic indexes from answer context, strengthen lexical/topic support for natural-language questions, and avoid showing irrelevant nearest-neighbor notes in low-confidence fallback copy. Switch the primary chat model to `nvidia/nemotron-3-ultra-550b-a55b:free` and add `openrouter/free` as a last-resort fallback for provider rate limits/outages. The fallback may emit reasoning fields; the app consumes visible `delta.content` only and ignores reasoning tokens.
**Why:** The July 2026 chat audit found direct-topic vector retrieval generally mapped well, but natural full-question lexical support was weak, some published index state was stale/pending, low-confidence fallback could surface odd related links, and the current default model (`google/gemma-4-31b-it:free`) was returning upstream `429`. Raw `Excerpt:` prompt context also leaves room for the model to answer by repeating the note rather than speaking conversationally.
**Alternatives rejected:** Keeping the current default model without fallback was rejected because free-provider availability is unstable. Using `openrouter/free` as the primary model was rejected because it may route to reasoning-heavy providers with delayed visible content. Allowing low-confidence related links for any nearest-neighbor result was rejected because it can reduce trust on unrelated questions. Forcing terse answers was rejected because the desired assistant should feel more conversational when the retrieved notes have enough evidence.
**Affects:** docs/PRD.md, docs/ARCHITECTURE.md, docs/CONVENTIONS.md, docs/ENV_VARS.md, docs/TESTING.md, `src/lib/server/ai/openrouter.ts`, `src/lib/server/personality.ts`, `src/lib/server/chat.ts`, `src/routes/api/chat/+server.ts`, `src/lib/utils/chat-format.ts`, `src/lib/components/Chat.svelte`
**Implementation status (2026-07-07):** `CHAT-07A` implemented the model switch and OpenRouter fallback adapter; `CHAT-07B`/`CHAT-07C` tightened retrieval/index readiness; `CHAT-07D` tuned synthesis prompt wording and low-confidence fallback behavior. Remaining chat-quality refinements, if any, should preserve the same split: high/borderline paths may cite citable evidence, while low-confidence fallback omits nearest-neighbor source/related links entirely.
**Audit outcome (2026-07-07, `CHAT-07E` via `npm run chat:audit`):** Retrieval, confidence tiers, and fallback behavior all verified correct — direct questions tiered high (best distances 0.33–0.42) with accurate cited/source slugs, adjacent questions tiered borderline (0.54–0.55) and the answer explicitly flagged limited coverage, and all unrelated questions tiered low (0.90–0.92) with the deterministic fallback and **no** sources event. Both configured models probed available. Two gaps remain, recorded as `CHAT-08A`/`CHAT-08B` instead of fixed in the audit: (1) `nvidia/nemotron-3-ultra-550b-a55b:free` intermittently (3 of 7 citable questions, plus one >60s stall) returns HTTP 200 with a single in-band SSE `error` event (`502 ResourceExhausted`, `provider_unavailable`) and zero content — the adapter treats 200 as success, so the fallback model never engages and the client renders an empty answer bubble that still carries a Sources control; (2) quote-copy runs of 31 and 18 shared words were observed despite the `CHAT-07D` paraphrase instruction.

### RESOLVED-24 — Reader Trust and Navigation Polish Scope

**Resolved:** 2026-06-29
**Decision:** Add a reader trust/navigation polish phase focused on recruiter/developer evaluation. The homepage remains chat-first and automatically populated. Chat assistant messages with retrieved sources should expose a subtle source button that opens a popup with note titles and brief snippets from the retrieval context; source links navigate to the relevant note, and confidence/coverage language stays subtle. Note detail pages should prioritize semantic related notes plus explicit backlinks/outlinks, while keeping the graph small but more fluid/polished. Admin quality checks live inside editor pages and are warning-only for stale embeddings, missing takeaways, no internal links, and weak titles. Add a `/how-it-works` page that is both reader-friendly and technical-colophon style, includes stack/architecture, and does not include chat privacy/rate-limit details. Technical block polish should add Mermaid rendering plus richer code controls using the blueprint panel recipe.
**Why:** The core blog/RAG/admin system exists; the next leverage point is making the author's thinking easier to inspect and trust. Source transparency and reader paths help visitors move from one answer or note into the underlying work. Warning-only admin checks improve publishing quality without turning the editor into a gatekeeper.
**Alternatives rejected:** Topic/tag/series landing pages were rejected for now because the published corpus is not large enough to support curated entry points. Open Graph image generation was deferred because it needs a separate visual/product planning pass. Publish-blocking quality checks were rejected; warnings are enough for a single-author workflow.
**Affects:** docs/PRD.md, docs/ARCHITECTURE.md, docs/CONVENTIONS.md, docs/styleguide.md, docs/TESTING.md, future `CHAT`, `PUBLIC`, `ADMIN`, and `POLISH` workboard tasks
**Implementation status (2026-06-29):** Decision accepted and documented; implementation tasks to be drafted.

### RESOLVED-23 — Agent-Assisted Note Authoring (`/write-post`, Draft-Only, Interview-Grounded, Non-Blocking Score)

**Resolved:** 2026-06-08
**Decision:** Add an inline `/write-post` skill that lets the author direct an agent to write a full note in the canonical blog voice and persist it. The flow is: load `docs/VOICE.md` + category list + existing note slugs, run an **extensive interview** (structured `AskUserQuestion` batches + free-form follow-ups), draft the post in voice, run a **non-blocking** voice/AI-tell review score, then write the note via a local node script (`scripts/create-note.js`) that calls `createNote()` + `reindexNoteAfterSave()`. Persisted notes are **always `status: 'draft'`** — the script hard-forces it; nothing in this path can publish. The author reviews and publishes in the existing `/admin` editor. Grounding rule: the factual spine comes from the interview (plus existing notes); the agent **may** add outside knowledge but must **flag every such passage in the terminal report** for verification — flags are terminal-only and are never written into the note body. Relational links are author-directed: the agent emits `[[slug]]` only for slugs that already exist (auto-synced into `note_links` by `createNote`), and reports any named targets that don't yet exist. Embedding + chunking happen for free via the existing `reindexNoteAfterSave()` pipeline. A new draft-review module (`src/lib/server/ai/draft-review.ts`), **separate** from the in-editor critique (`ai/review.ts`), produces a calibratable 0–100 score that is recorded/shown but enforced by nothing for now (see OPEN-01).
**Why:** The author wants to maximize output without losing their voice or the grounding guarantees the rest of the system depends on. Draft-only keeps publishing a deliberate human act and makes the whole authoring lane non-destructive. Interview-grounding with flagged outside knowledge is the strongest practical defense against AI-slop and fabricated personal anecdotes while still letting the agent fill in real technical context. Reusing `createNote`/`reindexNoteAfterSave` means embeddings, chunks, and the wiki-link graph stay identical to hand-authored notes with zero new pipeline. A dedicated voice spec and scorer keep "the voice" in one auditable place rather than buried in a prompt.
**Alternatives rejected:** Writing through the admin HTTP form/action was rejected because it needs an authenticated browser session and adds no value over a local script for a single author. Letting the agent publish directly was rejected as too easy to misfire on an irreversible, outward-facing action. Letting the agent research freely / weave outside knowledge silently was rejected as the highest fabrication-risk option. Extending the existing `ai/review.ts` critique was rejected in favor of a separate `draft-review.ts` so the authoring scorer can be tuned and (eventually) gated independently of the editor critique. Enforcing a score threshold now was deferred to OPEN-01 because the scorer is uncalibrated. Keeping the voice spec only in code or only in the skill prompt was rejected in favor of `docs/VOICE.md` as a human-editable single source.
**Affects:** docs/VOICE.md (new), docs/INDEX.md, docs/ARCHITECTURE.md, docs/CONVENTIONS.md, docs/ENV_VARS.md, docs/PRD.md, docs/TESTING.md, CLAUDE.md, `.claude/skills/write-post/SKILL.md` (new), `src/lib/server/ai/draft-review.ts` (new), `scripts/create-note.js` (new)
**Implementation status (2026-06-08):** Decision accepted and documented; implementation queued as the `AUTHOR` workboard group. No code shipped yet.

---

### RESOLVED-22 — Fail-Soft Reindexing Preserves Previous Embeddings

**Resolved:** 2026-05-04
**Decision:** Admin note saves should preserve the previous note-level and chunk-level embeddings when a fresh embedding run fails. New vectors replace old vectors only after generation succeeds. The admin experience should expose stale-index state so the author can see when saved note content is newer than the semantic index.
**Why:** The author workflow should not lose edits because an embedding provider is temporarily unavailable, but silent stale vectors make chat behavior hard to reason about. Keeping old vectors preserves the last known good retrieval state, while admin-visible status makes the mismatch actionable.
**Alternatives rejected:** Wiping the note-level embedding to `null` on failure was rejected because it removes a useful previous index. Blocking save/publish on embedding failure was rejected because it makes writing depend too tightly on external AI availability. Server-only logs were rejected as insufficient for a single-author admin workflow.
**Affects:** docs/ARCHITECTURE.md, docs/CONVENTIONS.md, docs/TESTING.md, admin embedding workflow tasks
**Implementation status (2026-05-04):** Implemented. Admin note create/save/publish now call `reindexNoteAfterSave()`, which preserves previous note-level and chunk-level vectors unless the fresh note embedding and every chunk embedding are generated successfully. Notes now record `semantic_index_status`, `semantic_index_error`, `semantic_indexed_at`, and `semantic_index_source_updated_at` so admin surfaces can distinguish current, failed, and stale semantic indexes.

### RESOLVED-21 — Chat Confidence Tiers and Playful Grounded Voice

**Resolved:** 2026-05-04
**Decision:** Chat retrieval should use numeric confidence tiers derived primarily from semantic chunk cosine distance, with lexical matches as supporting evidence. High-confidence retrieval proceeds to the normal LLM answer path. Borderline retrieval still calls the LLM, but with explicit limited-coverage instructions so the assistant can discuss related note material without pretending the exact answer is documented. Low-confidence retrieval skips the LLM and returns the deterministic insufficient-coverage SSE fallback. The assistant voice should remain first-person and grounded, but lean more relaxed, informal, friendly, and lightly playful than the current rigid knowledge-base tone.
**Why:** The embedding model separates relevant and irrelevant chunks well enough to support a cutoff, but with a small corpus the nearest neighbor for an unrelated question is still a published chunk. Tiered gating preserves trust while letting borderline evidence produce a more natural human response than a canned fallback. The voice change better matches the site's personal editorial premise without weakening the grounding boundary.
**Alternatives rejected:** Treating any non-empty retrieval as sufficient was rejected because unrelated questions can reach the LLM. A hard cutoff for all borderline cases was rejected because it can feel too brittle and wastes useful adjacent note context. General-purpose personality role-play was rejected because the assistant must stay a guide to published notes, not an unconstrained character.
**Affects:** docs/PRD.md, docs/ARCHITECTURE.md, docs/CONVENTIONS.md, docs/TESTING.md, chat confidence/personality implementation tasks
**Implementation status (2026-05-04):** Partially implemented. `CHAT-04G` ships centralized semantic-distance confidence tiers and exposes high/borderline/low metadata from `assembleContext()`. High and borderline evidence can still reach the LLM, while low-confidence or empty retrieval returns the deterministic fallback without an LLM call. The stricter limited-coverage prompt path and more playful grounded voice remain planned for `CHAT-04H`.

### RESOLVED-20 — Production Auth Routing Failure (`UnknownAction`) Root Cause and Fix

**Resolved:** 2026-05-01
**Decision:** Reserve `/auth/*` exclusively for Auth.js action endpoints and host custom sign-in UI outside that prefix (`/signin`), configured via `pages.signIn`. Keep provider initiation delegated to the Auth.js `signIn` action from `/signin`, now with immediate client-side auto-submit for direct GitHub redirect UX while retaining a manual fallback button. Also remove `AUTH_URL` from Railway for this `@auth/sveltekit@1.0.0` setup to avoid redundant base-path warnings and ambiguous action URL construction.
**Why:** Production login failed with `error=Configuration` and deploy logs showed `UnknownAction: Unsupported action` plus `env-url-basepath-redundant`. Root cause was twofold: (1) custom route collision (`/auth/signin` page under the same prefix Auth.js intercepts for actions), which made SvelteKit client data requests like `/auth/signin/__data.json` hit Auth.js and parse as unsupported sign-in action variants; (2) `AUTH_URL` remained set in Railway, producing redundant base-path warnings and increasing auth-route ambiguity during troubleshooting. After stabilizing route ownership, `/signin` auto-submit was added to preserve a direct-to-provider experience without reintroducing `/auth/*` collisions.
**Alternatives rejected:** Keeping custom UI under `/auth/signin` and attempting to special-case requests in hooks was rejected as brittle and contrary to Auth.js route ownership. Renaming environment keys (for example changing `AUTH_GITHUB_ID`) was rejected because provider env key names were not the failure mode.
**Affects:** `src/auth.ts` (`pages.signIn`), `src/hooks.server.ts` (admin redirect target), `src/routes/signin/*` (custom sign-in UI/action + auto-submit guard), `src/lib/components/Nav.svelte` (login link), Railway production variables (`AUTH_URL` removed), docs/ARCHITECTURE.md, docs/CONVENTIONS.md, docs/TESTING.md, AGENTS.md discoveries

### RESOLVED-19 — Inline Body Media Strategy (Markdown Token + Shared Renderer Pass)

**Resolved:** 2026-05-01
**Decision:** Keep the note body markdown-first and add inline media embeds via a structured token format: `{{media ...}}`. Transform these tokens with a shared remark pass (`remarkInlineMediaEmbeds`) in both admin live preview and the public note renderer. Reuse the existing admin media upload endpoint to insert embed snippets into note `body`.
**Why:** This preserves the existing raw-markdown authoring model while enabling inline image/MP4 placement with high preview/public parity. It avoids introducing a block-composer data model or storing layout JSON while still supporting practical editorial control in a single-column article flow.
**Alternatives rejected:** Full block-composer UI was rejected as disproportionate complexity for current scope. Raw HTML embeds in author markdown were rejected for lower safety/predictability and weaker renderer consistency.
**Affects:** docs/PRD.md, docs/ARCHITECTURE.md, docs/CONVENTIONS.md, docs/TESTING.md, `src/lib/utils/inline-media.ts`, `src/lib/utils/markdown-preview.ts`, `src/lib/server/markdown.ts`, admin note forms

### RESOLVED-18 — Chat Retrieval Orchestration (Always-On Light Hybrid + Confidence-Gated Fallback)

**Resolved:** 2026-04-30
**Decision:** For chat retrieval, use an always-on light hybrid strategy: run semantic retrieval (chunk similarity once chunk model ships) and topic/lexical retrieval in parallel, fuse/rerank a small candidate set server-side, and only answer directly when confidence is sufficient. The original fallback design allowed related-topic note links for low-confidence results rather than speculation; current behavior supersedes that link portion below.
**Why:** Chunked semantic retrieval improves granularity but can still surface near-neighbor context that is semantically adjacent yet not answer-complete. Always-on hybrid retrieval improves precision/recall balance and reduces wrong-but-confident responses. Confidence gating preserves trust by preferring transparent fallback over speculative completion.
**Alternatives rejected:** Fallback-only lexical/topic retrieval was rejected because it still allows borderline semantic misses to be answered too confidently before fallback logic runs. Pure vector-only retrieval was rejected for insufficient precision on topic-framed questions. LLM-driven DB/tool queries were rejected for higher latency variance, weaker determinism, and unnecessary complexity at this scale.
**Affects:** docs/PRD.md, docs/ARCHITECTURE.md, docs/CONVENTIONS.md, docs/TESTING.md, docs/workboard.json (CHAT retrieval tasks)
**Implementation status (2026-07-07):** Superseded in part by RESOLVED-25 and `CHAT-07D`: low-confidence fallback still avoids speculation and skips the LLM, but it no longer presents related-topic note links because those can be irrelevant nearest-neighbor matches. High and borderline citable paths remain responsible for source/related-note links.

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
**Implementation status (2026-05-01):** `ADMIN-07` ships this decision with `POST /api/admin/media/upload-url` (admin-only MIME-validated presigned `PUT`) and `GET /api/admin/media/access-url?key=...` (public redirect to presigned `GET`). `/admin/notes/new` now stages cover/inline files locally (`blob:` URLs for preview) and uploads them only when Create is submitted; `/admin/notes/[slug]/edit` keeps immediate upload behavior. Browser direct-upload requires bucket CORS to allow app origins + `PUT` + `Content-Type`.

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
**Decision:** Add an optional manual "Review" button to both admin note editors (new + edit) that streams an LLM critique via `POST /api/admin/notes/review`, using a free-tier OpenRouter model/router (`openrouter/free` by default, overrideable with `OPENROUTER_REVIEW_MODEL`). The endpoint accepts `{ title, takeaway, body }` from current form state so unsaved drafts can be reviewed. Critique is never a gate on saving or publishing.
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

**Resolved:** 2026-04-25 · **Superseded:** 2026-06-07 and again on 2026-07-07 (see RESOLVED-25)
**Decision:** Use `google/gemma-4-31b-it:free` via OpenRouter as the default chat model.
**Why:** As of 2026-06-07, `google/gemini-2.0-flash-001` returns `404 No endpoints found` (the original default was retired from OpenRouter), and paid successors like `google/gemini-2.5-flash` return `402 Payment Required` because the OpenRouter account holds no credits. `google/gemma-4-31b-it:free` is the closest free drop-in: same vendor/tone, 262k context, streams clean `content`-only deltas (no reasoning leakage), and obeyed the grounding system prompt in testing.
**Alternatives rejected:** `openai/gpt-oss-120b:free` works but interleaves `reasoning` tokens that stall visible output; several free Llama/Qwen/Kimi endpoints returned `429`. Adding account credits to keep a paid Gemini was deferred — free model is adequate at blog scale.
**Original (2026-04-25) decision:** Use `google/gemini-2.0-flash-001` for ~400–600 ms TTFT and reliable personality injection. Retired upstream; preserved here for history.
**Affects:** ARCHITECTURE.md, ENV_VARS.md, src/lib/server/ai/openrouter.ts
**Current status:** Superseded by RESOLVED-25, which switches the primary default to `nvidia/nemotron-3-ultra-550b-a55b:free` and adds `openrouter/free` as a fallback router.

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
**Decision:** Render public note bodies using `unified` with `remark-gfm` and `rehype-shiki` for syntax-highlighted code blocks. Use the bundled Shiki `dark_plus` theme with the current legacy `rehype-shiki@0.0.9` stack.
**Why:** The wiki-link pipeline (`renderWikiLinks`) already requires an AST-aware pass to avoid matching inside code fences. A `remark` plugin integrates at the AST level and eliminates that fragility. `rehype-shiki` produces high-quality, theme-aware syntax highlighting with no extra configuration. `unified` is the most future-proof foundation — additional plugins (footnotes, callouts, etc.) can be added without changing the rendering architecture.
**Alternatives rejected:** `marked` was rejected because its plugin system is thin and wiki-link handling would remain a regex pass. `markdown-it` was rejected as a smaller ecosystem with less idiomatic Svelte/Vite integration.
**Affects:** src/routes/notes/[slug]/+page.svelte, PUBLIC-02 workboard task
