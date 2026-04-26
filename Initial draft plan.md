# Knowledge Blog — Project Plan

---

## Senior SE Manager Assessment

*Reading this proposal as someone who reviews dozens of portfolio sites a month:*

**What immediately stands out (positive):**

The self-referential architecture is genuinely clever. Most candidates say "I know AI/ML integration" in a bullet point. You're proposing to *demonstrate* it by building a RAG pipeline over your own notes — and the interview question "what does this guy know about CI/CD?" is answered by the site itself in real time. That's a portfolio that talks back, which is memorable.

The personality injection idea shows awareness of prompt engineering that goes beyond "I called the ChatGPT API." Designing a system prompt that produces a coherent first-person voice — honest about gaps, specific about experience — is a non-trivial skill that most junior devs haven't thought about.

The hybrid note format (structured metadata + freeform narrative) is the right call. It's queryable and human-readable simultaneously, which is exactly what a RAG system needs.

**What I'd flag as risks:**

1. **Content is the actual moat.** The tech stack is replicable in a weekend by another candidate. What makes this impressive 6 months from now is whether you have 40 well-written notes or 4. The discipline to keep writing is the hard part, not the build.

2. **LLM hallucinating about you to a recruiter is worse than no chat.** If someone asks "Does he know Kubernetes?" and the model confidently fabricates an answer, that's a liability. You need guardrails: ground answers strictly in retrieved notes, and have the model say "I don't have a note on that yet" rather than invent.

3. **First impressions under cold start.** Neon serverless + OpenRouter latency on a first load = slow first chat response. A recruiter with 30 tabs open will not wait. Performance matters.

**What would make me schedule the interview:**
- Notes that show *process and mistakes*, not just finished knowledge. "I got this wrong and here's why" is more credible than "here's what X is."
- A personality prompt that's authentic, not a marketing brochure.
- The chat citing actual notes with links (proof the system is grounded, not hallucinating).

**On the blog-first framing:** This is the right call. A portfolio says "look at what I built." A blog says "watch how I think." The latter ages better and is far rarer. You've already got a portfolio — this is the complement that makes the portfolio credible. Keep the writing honest and process-focused ("I got this wrong, here's why") and you'll stand out from every candidate who writes only success stories.

**Verdict:** Strong proposal. The tech differentiates; the content compounds. Build it and feed it consistently.

---

## Context

This is a new standalone project — a **blog/editorial site** where the primary content is personal knowledge notes written in a hybrid format (structured frontmatter + freeform narrative body). The purpose is to publicly document experience, workflow, process, and knowledge in software development. A separate portfolio site exists for personal/project showcasing; this site is about the work and thinking, not the person.

The differentiating feature is a public LLM chat that performs semantic search over those notes and answers visitor questions in the author's voice, citing the actual notes as sources. A key use case: a recruiter asks "What does this guy know about CI/CD?" and the chat answers from real notes, with links.

It borrows the Techy stack and patterns (SvelteKit + Svelte 5, Drizzle ORM, Neon PostgreSQL, OpenRouter, Tailwind) but is architecturally different: public-first (no login wall for visitors), semantic search via pgvector embeddings, and a personality-injected system prompt.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | SvelteKit + Svelte 5 (runes) + TypeScript | Same as Techy |
| Styling | Tailwind CSS v4 | Same as Techy |
| Database | Neon PostgreSQL (serverless HTTP) | Add pgvector extension |
| ORM | Drizzle ORM | Same as Techy |
| LLM | OpenRouter (via OpenAI-compatible API) | Same adapter as Techy |
| Embeddings | OpenRouter or dedicated embedding model | New — for semantic search |
| Auth | Auth.js + GitHub OAuth | Admin only (note CRUD) |
| Testing | Vitest | Same as Techy |
| Hosting | Vercel | Same as Techy |

---

## Database Schema

### `notes`
```sql
id          uuid primary key
title       text not null
slug        text unique not null
body        text not null                    -- full markdown with ## sections
tags        text[] not null default '{}'
category    text not null                    -- canonical category (same list as Techy)
type        text not null                    -- 'experience' | 'concept' | 'process' | 'tool'
status      text not null default 'draft'   -- 'draft' | 'published'
date        date                            -- when experience/knowledge was acquired
embedding   vector(1536)                    -- pgvector for semantic search
created_at  timestamptz default now()
updated_at  timestamptz default now()
```

### `conversations` (public, no auth)
```sql
id          uuid primary key
session_id  text not null                   -- browser-generated anonymous session
created_at  timestamptz default now()
```

### `messages`
```sql
id              uuid primary key
conversation_id uuid references conversations(id) on delete cascade
role            text not null               -- 'user' | 'assistant'
content         text not null
cited_note_ids  uuid[]                      -- notes cited in this response
created_at      timestamptz default now()
```

Auth.js tables: `users`, `accounts`, `sessions` (same as Techy).

**Key difference from Techy:** No `note_revisions`. Embeddings are the primary retrieval mechanism.

**Wikilinks:** To be incorporated — the exact approach (display, resolution, graph view) will be specified separately. Plan for a `note_links` table or inline `[[slug]]` parsing at render time.

---

## Note Format

```markdown
---
title: Debugging a race condition in production
category: Concepts & Methodologies
type: experience
tags: [concurrency, go, debugging]
date: 2026-02-10
status: published
---

## Context
[What situation/problem prompted this note]

## What I did
[Actions taken, tools used, approach]

## What I learned
[Key insight or takeaway]

## Takeaway
[One-sentence summary — this is what the LLM will prioritize in its answer]
```

The `Takeaway` section is intentionally short — it becomes the LLM's anchor when summarizing the note for a visitor.

---

## Architecture: Public Chat (RAG Flow)

```
visitor types: "What does this guy know about CI/CD?"
        ↓
1. Embed query → vector(1536)
2. pgvector cosine similarity search → top 5 published notes
3. Build prompt:
   [personality block]
   [retrieved note bodies with titles + slugs]
   [conversation history]
4. OpenRouter → streaming response in author's voice
5. Response includes: answer + cited note slugs
6. Frontend renders answer + clickable note links
```

**Guardrail rule in system prompt:** "If no retrieved note is relevant to the question, say so honestly. Do not speculate beyond what the notes contain."

---

## Latency Strategy

The RAG flow has two sequential network calls before the user sees output: (1) embed the query, (2) call the LLM. Total realistic latency without mitigation: **1.5–4 seconds** to first character, which kills perceived polish.

**The solution is streaming + optimistic UI, not a faster pipeline.**

### What actually matters: time-to-first-token (TTFT)
A 3-second response that streams from token 0 feels faster than a 1-second response that appears all at once. Streaming is non-negotiable.

### Step-by-step mitigation

| Step | What to do | Effect |
|---|---|---|
| Query embedding | Show "searching notes..." immediately on send | Hides ~300ms embedding call |
| Vector search | Runs in Neon, ~10–50ms | Not a problem |
| LLM call | Use a fast model (see below) | Biggest lever |
| Token delivery | Stream via SSE (`ReadableStream` in SvelteKit) | User sees output in ~500ms |
| Context length | Only send `Takeaway` + first paragraph of each retrieved note, not full bodies | Reduces prompt tokens → faster generation |

### Recommended model: `google/gemini-2.0-flash-001` via OpenRouter
- ~400–600ms TTFT, fast streamer
- Instruction-following is strong (important for personality injection)
- Cheap enough to not worry about rate costs on a personal blog
- Fallback: `meta-llama/llama-3.3-70b-instruct` (slightly slower but strong personality adherence)

**Do not use:** GPT-4o or Claude Sonnet as the default — they're 2–5x slower on TTFT and the quality difference doesn't justify it for this use case.

### SvelteKit implementation note
Use `+server.ts` with `return new Response(stream)` pattern (not `json()`). The chat component reads the SSE stream and appends tokens. This is the same pattern used in Techy's chat if it exists there — check `src/routes/api/chat/+server.ts`.

---

## Personality System Prompt Block

A dedicated section prepended to every chat system prompt:

```
You are [Name], answering questions about your background and experience on your behalf.

Voice: direct, technically precise, honest about gaps. You do not oversell.
If you don't have experience with something, you say so.

Background: [1-2 sentences — role, years, focus areas]
Currently learning: [...]
Values: [e.g., "understanding fundamentals before frameworks"]

Answer as though the visitor is asking you directly in a technical conversation.
```

This section lives in a dedicated file (`src/lib/server/personality.ts`) so it can be updated without touching chat logic.

---

## Pages & Routes

**Public (no auth):**
- `/` — Landing page with chat front-and-center + note preview cards below
- `/notes` — Browse all published notes (filter by category, type, tags, search)
- `/notes/[slug]` — Full note detail page

**Admin (GitHub OAuth, author only):**
- `/admin` — Dashboard (counts, recent notes, drafts)
- `/admin/notes/new` — Create note (hybrid format editor with section scaffolding)
- `/admin/notes/[slug]/edit` — Edit note
- `/admin/notes/[slug]/delete` — Delete note

**API:**
- `POST /api/chat` — Chat endpoint (rate-limited, public)
- `POST /api/admin/notes` — Create note + generate embedding
- `PATCH /api/admin/notes/[slug]` — Update note + regenerate embedding

---

## Rate Limiting

Public chat endpoint (`POST /api/chat`) needs protection against cost abuse:
- Track requests per IP in-memory (Vercel edge) or via a simple Neon counter
- Limit: 10 messages per IP per hour (tunable)
- Return 429 with a message: "Chat limit reached — feel free to browse the notes directly."
- No rate limit on note reading (static-ish, cheap)

---

## Admin Note Editor

Since there's no Obsidian import, the admin editor is the primary authoring tool:
- Markdown textarea with the hybrid format pre-scaffolded (section headers auto-inserted on new note)
- Tag input (comma-separated → array)
- Category dropdown (canonical list from Techy's `note-taxonomy.ts`)
- Type selector (experience / concept / process / tool)
- Date picker
- Draft / Published toggle
- On save: upsert note → regenerate embedding → redirect to `/notes/[slug]`

---

## SEO

- `<meta>` tags on all public pages (`title`, `description`, `og:*`)
- Note pages: title = note title, description = first 160 chars of Context section
- `sitemap.xml` generated from all published notes
- `robots.txt` allowing all crawlers

---

## Critical Files to Create (by phase)

### Phase 1 — Scaffold
- `package.json`, `svelte.config.js`, `vite.config.ts`
- `src/lib/server/db/schema.ts` — Drizzle schema including pgvector
- `drizzle.config.ts`
- `src/hooks.server.ts` — Auth middleware (admin routes only)

### Phase 2 — Notes CRUD (Admin)
- `src/routes/admin/notes/new/+page.svelte`
- `src/routes/admin/notes/[slug]/edit/+page.svelte`
- `src/lib/server/db/notes.ts` — Query layer
- `src/lib/server/embeddings.ts` — Embed on create/update

### Phase 3 — Public Notes
- `src/routes/notes/+page.svelte` — Browse/search
- `src/routes/notes/[slug]/+page.svelte` — Detail
- `src/lib/components/NoteCard.svelte`

### Phase 4 — Chat
- `src/routes/api/chat/+server.ts` — Rate-limited RAG endpoint
- `src/lib/server/chat.ts` — Embedding search + prompt assembly
- `src/lib/server/personality.ts` — Personality block (editable)
- `src/lib/components/Chat.svelte` — Chat UI with streaming

### Phase 5 — Landing + Polish
- `src/routes/+page.svelte` — Landing with chat + note previews
- SEO meta tags
- Design pass

---

## Reuse from Techy

| Pattern | Techy file | Notes |
|---|---|---|
| OpenRouter adapter | `src/lib/server/ai/openrouter.ts` | Copy and adapt |
| Neon DB connection | `src/lib/server/db/index.ts` | Copy directly |
| Drizzle config | `drizzle.config.ts` | Copy directly |
| Auth.js setup | `src/hooks.server.ts`, `src/routes/auth/` | Copy, restrict to admin routes |
| Slugify utility | `src/lib/utils/slugify.ts` | Copy directly |
| Note taxonomy | `src/lib/utils/note-taxonomy.ts` | Copy canonical categories |
| Tailwind theme vars | `src/app.css` | Adapt (different color palette) |

---

## Verification

1. **Admin flow:** Create a note, verify it appears in `/notes`, click through to detail page
2. **Embedding:** After save, check `notes.embedding` is non-null in Neon console
3. **Chat RAG:** Ask "what do you know about [topic of a real note]?" — verify response cites that note with a working link
4. **Guardrail:** Ask about a topic with no note — verify response says "I don't have a note on that yet" rather than hallucinating
5. **Rate limit:** Send 11 messages from same IP — verify 429 on the 11th
6. **Public access:** Open an incognito window — verify notes and chat work without login
7. **Admin protection:** Navigate to `/admin` without auth — verify redirect to sign-in
