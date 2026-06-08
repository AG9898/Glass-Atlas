---
name: write-post
description: Interview the author, draft a Glass Atlas note in the canonical voice, score it, and save it as a draft only.
version: 1.0.0
---

# Write Post

Use this skill when the author invokes `/write-post` with a topic or says they want the agent to draft a blog note.

This is an inline authoring flow. Do not launch a background subagent, do not publish, and do not bypass the existing note-save pipeline.

## Hard Rules

- Load `docs/VOICE.md`, `src/lib/utils/note-taxonomy.ts`, and the current note list before drafting.
- The factual spine comes from the author interview plus existing notes. Never fabricate personal anecdotes, quotes, benchmarks, dates, or project details.
- Outside knowledge is allowed only where the author explicitly permits it. Every passage that uses outside, non-author knowledge must be listed in the terminal report as "verify before publish" and must not be marked inside the note body.
- Emit `[[slug]]` links only for slugs that exist in the current note list. If the author names a target that does not exist, record it as a missing target and do not invent a slug.
- The saved body must be polished Markdown, not plain prose dumped into a field: use headings, paragraph breaks, blockquotes, bold/italic emphasis, lists, tables, and fenced examples where they improve rhythm or scanability.
- Never write patch/diff artifacts into the note body. Standalone `+` lines, `+##` heading prefixes, plus-prefixed code fences, `+text` lines, and similar artifacts are a blocker; strip them before review/save.
- Persist with `scripts/create-note.js` only. It hard-forces `status: "draft"` and calls `createNote()` plus `reindexNoteAfterSave()`.
- Run `scripts/review-draft.js` before saving. The score is non-blocking: show it, but do not let a low score prevent the draft write.

## Required Context Load

1. Read `docs/VOICE.md` in full. Treat it as the only source of truth for the blog voice.
2. Read `src/lib/utils/note-taxonomy.ts` and extract the allowed `CATEGORIES`.
3. Load existing note slugs and titles through the app query layer. Use this command from the repo root:

```bash
node --input-type=module <<'NODE'
import process from 'node:process';
import { createServer, loadEnv } from 'vite';

const loaded = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '');
for (const [key, value] of Object.entries(loaded)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

const server = await createServer({
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
});

try {
  const { listNotes } = await server.ssrLoadModule('/src/lib/server/db/notes.ts');
  const notes = await listNotes();
  console.log(
    JSON.stringify(
      notes.map(({ slug, title, status, category, tags, series }) => ({
        slug,
        title,
        status,
        category,
        tags,
        series,
      })),
      null,
      2,
    ),
  );
} finally {
  await server.close();
}
NODE
```

If the note list cannot be loaded because `DATABASE_URL` is missing or unavailable, stop before drafting and report the blocker. Do not guess link targets.

## Interview Contract

Run an extensive interview before drafting. Use `AskUserQuestion` batches when available, then free-form follow-ups. If the tool is not available, ask the same batches directly in the chat, one batch at a time.

Batch 1: angle and audience

- What is the post really about, in one sentence?
- What take are we defending?
- Who is the reader, and what do they already know?
- What should the reader feel or do differently after reading?

Batch 2: scope and shape

- Desired length: short riff, normal note, or deep dive?
- What should be included?
- What should be explicitly out of scope?
- Any sections, code snippets, examples, or screenshots/media the author already has in mind?

Batch 3: factual spine in the author's words

- What happened, what was built, or what was learned?
- What claims are safe to make?
- What anecdotes, implementation details, constraints, or mistakes are author-sourced?
- Are there exact terms, repo names, product names, or dates that must be used?

Batch 4: taxonomy and links

- Category from the allowed category list.
- Tags and optional series.
- Takeaway one-liner.
- Existing notes to link, chosen from the loaded slug list.
- Author-named link targets that are not in the slug list.

Batch 5: outside-knowledge boundary

- Where may the agent use general technical knowledge to add context?
- Where is outside knowledge off-limits?
- Are comparisons to libraries, frameworks, products, benchmarks, or recent events allowed?
- Which claims need an explicit "verify before publish" item?

Ask follow-ups until these fields are concrete: thesis, audience, scope, factual spine, category, tags, takeaway, intended existing links, missing link targets, length, outside-knowledge boundary, and media opportunities. Do not draft with vague placeholders.

## Drafting Rules

Before writing prose, build a private outline with:

- `author_sourced_facts`: claims, anecdotes, code, and constraints from the interview.
- `existing_note_context`: relevant slugs/titles and what each link supports.
- `outside_knowledge_passages`: any planned general-knowledge additions and why they need verification.
- `missing_link_targets`: author-named targets that are not existing slugs.
- `media_suggestions`: where manual screenshots, diagrams, or demos would improve the post.

Then draft the note body:

- Follow `docs/VOICE.md`: first-person, smart-casual, opinionated, prose-first, no hollow intro or listicle padding.
- Do not write outside-knowledge labels, comments, or verification markers into the body.
- Use polished Markdown suitable for the admin editor and public note renderer:
  - Use `##` sections with short, voiceful labels.
  - Use blockquotes for the central claim, sharp takeaway, or author stance.
  - Use **bold** for the few phrases that should carry the argument, and *italics* for quoted commands, asides, or emphasis.
  - Use bullets or tables when they make routing, comparisons, or examples easier to scan.
  - Use fenced code blocks for concrete snippets, routing trees, docs excerpts, or command examples.
  - Prefer `text`, `md`, `bash`, and other renderer-safe fences for examples. Mermaid fences currently render as code, not diagrams, unless the renderer changes.
- Use `[[slug]]` or `[[slug|label]]` only for existing slugs from the loaded note list.
- Do not emit forward links for missing targets.
- Keep the title slug-friendly, but do not manually construct the final slug. `scripts/create-note.js` will call `slugify()`.

Before scoring, run a Markdown polish and artifact pass:

- Remove every diff/patch artifact from the body: no standalone `+` lines and no content lines beginning with a stray `+` prefix.
- Confirm fenced code blocks have clean opening/closing fences and are not accidentally prefixed by `+`.
- Confirm the post is not one long prose slab. Every major section should have at least one useful formatting beat: a blockquote, emphasized sentence, list, table, or fenced example.
- Confirm formatting serves the voice and argument. Do not decorate every sentence; use Markdown to create rhythm, routing examples, and emphasis.
- Confirm the body renders as valid Markdown in the admin preview/public renderer. If a special fence language may not render as intended, use a safer text/tree/code fallback.

Self-check the draft against the top AI-tell bans in `docs/VOICE.md` before scoring:

- No habitual em-dashes.
- No "not just X, it's Y" construction.
- No filler such as "it's worth noting", "in today's landscape", or "at the end of the day".
- No fabricated personal detail.

## Score And Write

Create a temporary JSON payload outside the repo, for example:

```json
{
  "title": "Draft title",
  "body": "Full markdown body",
  "takeaway": "One-line takeaway",
  "category": "engineering",
  "tags": ["tag-one", "tag-two"],
  "series": null
}
```

Run the non-blocking review:

```bash
npm run review-draft -- --file /tmp/glass-atlas-draft.json
```

If the reviewer fails because OpenRouter is unavailable, keep going, but record the failure in the final report as `score: unavailable (<reason>)`.

Write the draft:

```bash
npm run create-note -- --file /tmp/glass-atlas-draft.json
```

The writer prints JSON containing `slug`, `status`, `editUrl`, `semanticIndexStatus`, and `semanticIndexError`. If the writer fails, do not retry with direct SQL. Fix the payload or report the blocker.

## Post-Save Verification

After a successful write, verify the saved draft through the app query layer. Replace `the-saved-slug` before running:

```bash
node --input-type=module <<'NODE'
import process from 'node:process';
import { createServer, loadEnv } from 'vite';
import { count, eq } from 'drizzle-orm';

const slug = 'the-saved-slug';
const loaded = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '');
for (const [key, value] of Object.entries(loaded)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

const server = await createServer({
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
});

try {
  const [{ db }, { noteChunks }, { getNoteBySlug, getOutlinks }] = await Promise.all([
    server.ssrLoadModule('/src/lib/server/db/index.ts'),
    server.ssrLoadModule('/src/lib/server/db/schema.ts'),
    server.ssrLoadModule('/src/lib/server/db/notes.ts'),
  ]);

  const note = await getNoteBySlug(slug);
  const outlinks = await getOutlinks(slug);
  const [chunkCount] = await db
    .select({ count: count() })
    .from(noteChunks)
    .where(eq(noteChunks.noteSlug, slug));

  console.log(
    JSON.stringify(
      {
        slug,
        exists: Boolean(note),
        status: note?.status ?? null,
        hasEmbedding: Boolean(note?.embedding),
        semanticIndexStatus: note?.semanticIndexStatus ?? null,
        chunkCount: chunkCount?.count ?? 0,
        outlinkCount: outlinks.length,
      },
      null,
      2,
    ),
  );
} finally {
  await server.close();
}
NODE
```

The expected result is a draft note with `hasEmbedding: true`, `semanticIndexStatus: "current"`, chunk count greater than zero, and outlinks matching any emitted `[[slug]]` links. If embeddings fail, the note may still save with `semanticIndexStatus: "failed"`; report that clearly and tell the author to re-save after fixing the upstream issue.

Also verify formatting hygiene after save:

- Re-load the saved note body and confirm no line is exactly `+` and no line starts with a stray patch prefix such as `+##`, a plus-prefixed code fence, `+|`, or `+text`.
- Render or preview-check the saved body when possible and confirm there are no raw fence artifacts, unresolved emitted wiki links, or obvious formatting breakage.
- If formatting hygiene fails, update the note through `updateNote()`/`reindexNoteAfterSave()` using the app query layer. Do not leave a malformed draft for the author to clean manually.

## Final Report

Finish with a concise terminal report:

- `slug`: saved slug.
- `edit_url`: `/admin/notes/<slug>/edit`.
- `status`: always `draft`.
- `review_score`: numeric score and short breakdown, or unavailable with reason.
- `semantic_index`: current/failed plus any error.
- `formatting_check`: confirm no diff artifacts and that the Markdown rendered cleanly, or describe the remaining issue.
- `verify_before_publish`: every outside-knowledge passage to verify, plus any scorer flagged lines that matter.
- `missing_link_targets`: author-named targets that did not exist and were not emitted as `[[slug]]`.
- `media_suggestions`: places to add screenshots, diagrams, GIFs, MP4 demos, or cover media manually in `/admin`.
- `manual_checks`: confirm the draft is visible in `/admin`, links resolve as expected, and no outside-knowledge flags were written into the body.

Do not end by offering to publish. Publishing remains a human action in the admin editor.
