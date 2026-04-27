# Handoff: Glass Atlas

A single-author developer notebook with a RAG-powered "Ask the Archive" chat surface and a private admin editor. Visual direction is **Soft Editorial Brutalism**: a warm-paper palette, sharp 0px corners, line-led structure, dense editorial typography, and a single sage accent.

---

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes showing the intended look and behavior, not production code to copy directly. The HTML uses inline-Babel JSX and global components (`window.GALanding`, `window.GAChat`, `window.GAAdmin`) purely so multiple artboards can render side-by-side on a design canvas; this is a delivery format, not an architecture suggestion.

The task is to **recreate these designs in the target codebase's existing environment** (the comments hint at SvelteKit + Drizzle + pgvector; treat that as confirmed if it matches the repo, otherwise pick the framework that fits the project) using its established patterns and libraries. If no environment exists yet, choose the most appropriate stack and implement the designs there.

## Fidelity

**High-fidelity.** Colors, typography, spacing, dividers, and copy are final. Recreate the UI pixel-perfectly using the design tokens listed below. The token file (`tokens.css`) is included verbatim — port these into the target codebase's token system rather than re-deriving them.

---

## Screens / Views

Three screens are delivered. Each is a top-level page-sized artboard rendered against `tokens.css`.

### 1. Landing — `landing.jsx` → `<GALanding />`

**Purpose.** Public homepage. Surfaces the latest note, the "Ask the Archive" RAG chat affordance, recent notes feed, topic browse, and author colophon.

**Page layout (top → bottom):**

1. **Header** — two stacked rows.
   - Top utility row: `VOL. 02 — APRIL 2026` left, `187 NOTES PUBLISHED · LAST EDIT 2 DAYS AGO` center, `RSS` and `LIGHT / DARK` right. Padding `14px 48px`. Bottom border 1px `--color-line-1`.
   - Brand row: 3-col grid (`1fr auto 1fr`). Left = nav (`NOTES` underlined active, then `CHAT` / `TOPICS` / `ABOUT`, all `t-label`). Center = `Glass Atlas` wordmark, `t-display` overridden to 44px / line-height 1 / letter-spacing −0.04em. Right = a search affordance (`⌕ SEARCH NOTES ⌘K`, bottom border 1px `--color-line-2`, min-width 220px). Padding `28px 48px`. Header has bottom border 2px `--color-line-3`.

2. **Hero** — 5-col grid `1fr 1px 5fr 1px 4fr`, min-height 520px. Bottom border 4px `--color-line-3`.
   - Left rail: vertical writing-mode (`writing-mode: vertical-lr`) showing `ISSUE 02 / NOTE 042` at top and `EST. 2025 — SINGLE AUTHOR` at bottom, padding `32px 16px`.
   - 1px vertical rule `--color-line-3`.
   - Center: 64px×48px padding. `FEATURED · BUILD LOG` accent label (`--color-accent-700`), then a `t-display` headline at 88px / line-height 0.93 / letter-spacing −0.035em. The word "show his work" is rendered in italic Literata (font-family swap mid-sentence, weight 500). Below: a single line button `READ THE LATEST →`.
   - 1px vertical rule.
   - Right: the **ASK module** — accent-100 background tinted to `rgb(225,231,221)`. `⟶ ASK THE ARCHIVE` label + `RAG · 187 NOTES INDEXED` meta. A short paragraph in `t-body` accent-900. Then a list of 3 example queries, each a row with `"…"` italicized question + `→` arrow, separated by 1px accent-700 rules. Footer: an inline "search box" with 2px accent-900 border, bg `--color-bg`, with `›` prompt and `↵` glyph.

3. **MetaStrip** — single row, 4 equal columns. Each column has `t-meta` label + `t-h2` value at 48px. Stats: `Published notes 187`, `Topics covered 12`, `Avg. words / note 1,420`, `Chat citations served 3,108`. 1px column dividers `--color-line-2`. Bottom border 2px `--color-line-3`.

4. **NotesFeed** — heading row (`SECTION 01 — RECENT NOTES` accent-700 label + `The latest field notes.` `t-h1` at 56px) plus right-side `SORT — NEWEST FIRST` and `FILTER — ALL TOPICS ↓` meta. Padding `64px 48px 32px`.
   - Followed by 5 NoteRow articles. Each row is a 7-col grid `120px 1px 1.4fr 1px 2fr 1px 200px` with vertical 1px rules between content cols. Padding `36px 24px` per cell. Each row has top + bottom 2px `--color-line-3` borders.
   - Cells: (a) `NOTE` label + 44px number; (b) category label + date/read meta; (c) `t-h3` title + `t-body-sm` excerpt + tag chips (`t-meta`, 1px `--color-line-2` border, padding `4px 8px`); (d) `OPEN ↗` or `★ EDITOR'S PICK` meta + `READ NOTE` underlined label.
   - Note 041 (the pgvector note) is the **accent row**: background `--color-accent-100`, all text shifted to `--color-accent-900` / `--color-accent-700`, label reads `★ EDITOR'S PICK`.
   - Footer row: `SHOWING 5 OF 187` left, `VIEW ALL NOTES →` right, padding `32px 48px`, bottom border 4px.

5. **TopicsAndAuthor** — 2-col grid `7fr 1px 5fr`, min-height 540px.
   - Left: `SECTION 02 — TOPICS` + `Browse by what you came for.` heading. Below: 2-col internal grid of topic links. Each link is a row with `t-h3` topic name + `Nx NOTES` meta on the right; 1px dividers between rows; right border on first col.
   - Right: `ABOUT THE AUTHOR` accent-700 label, then a card with 2px line-3 border + surface-1 bg, padding 24px, containing a 96×96 placeholder photo plate and `Aden Guo` (`t-h3` 22px) + role meta + short bio. The card has a subtle `translateY(-4px)` offset overlap. Below: a `t-body-lg` paragraph and two buttons (`FULL COLOPHON` line, `FOLLOW ON GITHUB` accent-line).

6. **Footer** — 4-col grid `2fr 1fr 1fr 1fr`, gap 48px, padding `48px 48px 64px`. Cols: (a) `Glass Atlas` wordmark at 32px + tagline; (b) BROWSE; (c) ELSEWHERE; (d) COLOPHON. Each link list uses a `t-label` heading + `t-body-sm` items. Below: 1px line-2 rule, then a row with `© 2026 ADEN GUO …` left and `BUILT IN SVELTEKIT · DEPLOYED ON RAILWAY` right.

### 2. Chat — `chat.jsx` → `<GAChat />`

**Purpose.** "Ask the Archive" — RAG-grounded conversational lookup against the notes index. No fluff, no chrome.

**Page layout.** Top-level grid `320px 1fr`, min-height 1200px.

- **Sidebar** (left, `--color-surface-1`, 2px right border):
  - Brand block at top: `Glass Atlas` 22px + `ASK THE ARCHIVE · 187 NOTES` meta. 2px bottom border.
  - `+ NEW CONVERSATION` button: full-width line button, 2px line-3 border, padding `14px 16px`, `⌘N` hint right-aligned. Section has 1px bottom border.
  - **History list**, scrollable (`ga-scroll`). Three groups: `TODAY`, `THIS WEEK`, `EARLIER`. Each group has a 12px×24px label header. Each item is an `<a>` block padded `14px 24px` with 1px top border, showing the question (line-clamped to 2 lines) + `Nx TURNS · GROUNDED` meta. The active item (Today/first) has `--color-accent-100` background and accent-shifted text.
  - **Rate-limit footer**: surface-2 bg, 2px top border, padding `20px 24px`. Shows `RATE LIMIT` + `7 / 10`, a 4px progress bar (line-1 track, accent-700 fill at 70%), and `RESETS IN 47 MIN — 10 MSG / IP / HOUR` meta.

- **Main column** (right, flex column):
  - **ChatTopBar**: `CONVERSATION` label + conversation title (`t-h3` 22px). Right side: `7 TURNS`, `3 NOTES CITED`, `⤓ EXPORT`, `⌫ CLEAR`. Padding `20px 64px`. 2px bottom border.
  - **Message list** (scrollable). Two message types alternate:
    - **UserMsg**: surface-1 bg, 2px top border + 1px bottom border, padding `32px 64px`. 3-col grid `120px 1fr 120px`: `YOU →` label, `t-body-lg` strong text, right-aligned timestamp `14:22 · TODAY`.
    - **AssistantMsg**: 2px bottom border, padding `32px 64px 48px`. Header row 3-col grid `120px 1fr 200px`: `ATLAS ⟶` accent-700, then a stamp row with an 8px accent square + `GROUNDED IN 3 NOTES — GEMINI FLASH`, right-aligned `STREAMED · 1.4s`. Body uses the same 3-col grid: empty / prose+code / **citation rail**. Prose is `t-body-lg`, max-width 64ch, `text-wrap: pretty`. Inline code uses `t-code` with surface-2 background + 1px line-2 border. Inline highlights use accent-100 bg + accent-900 text. The blueprint code panel is bordered 2px line-3, surface-2 bg, with a header `SQL · DRIZZLE` + `FROM NOTE 041 · §3`. Citation rail (right, 200px) lists 3 notes — each a section with `NOTE 041` accent-700 + `↗`, title `t-body-sm`, date + match score meta. Action row at bottom: `↻ REGENERATE`, `⧉ COPY`, `+ SAVE TO NOTES`, `HELPFUL? [Y] [N]`, all line-underlined meta buttons.
  - **RefusalMsg**: same grid, surface-1 bg, label color `--color-warning`. Used when the archive can't answer (out-of-scope query). Shows closest-match suggestion with `NOTE 028 · …` accent-700 label and a `NO MATCH · 0.31 SCORE` meta on the right.
  - **Composer** (bottom): 4px top border, surface-1 bg, padding `24px 64px 32px`. Same 3-col grid. `YOU →` label, then a 2px line-3 bordered textarea container with bg `--color-bg`, 3-row textarea (`t-body`, padding `18px 20px`, no resize), and a footer row inside the container with `↑ HISTORY ⌘↵ SEND ESC CLEAR` meta + an accent-filled `SEND ⟶` button (2px accent-900 border, accent-700 bg, bg-color text). Right rail: `STREAMING · SSE` + `10 MSG / IP / HOUR` meta.
  - Below composer: `TRY ASKING` label + a row of 4 line-only suggestion chips.

### 3. Admin Note Editor — `admin.jsx` → `<GAAdmin />`

**Purpose.** Private editor for creating / editing one note. Surfaces every editable field on the `notes` table: slug, title, takeaway, body (Markdown), tags[], category, embedding status, version. Includes an optional AI critique pass (Gemini Flash) and a wiki-link autocomplete preview. Lower asymmetry, lower drama than the public site.

**Page layout.**

- **AdminBar** — two stacked rows, surface-1 bg, 2px bottom border.
  - Top crumbs row: `Glass Atlas` wordmark (20px), then `/ ADMIN / NOTES / EDIT` breadcrumb meta, with right-side `SIGNED IN AS @AG9898 · GITHUB` and `↗ VIEW SITE`. Padding `14px 32px`, 1px bottom border.
  - Action row: `← ALL NOTES` link, then note title (`Note 041 · pgvector cosine vs. inner product` `t-h3` 20px), then a **status pill** — line-only chip with 1px border + 6×6 dot, color = `--color-success` if published / `--color-warning` if draft. Then `EDITED 4 MIN AGO · AUTOSAVED` meta. Right side: three buttons — `↗ PREVIEW` (line), `SAVE DRAFT` (line), `↑ PUBLISH` / `⌫ UNPUBLISH` (accent-filled, 2px accent-900 border, accent-700 bg). Padding `20px 32px`.

- **Main grid**: `1fr 360px`, 4px bottom border.

  - **Left column** (form + editor, padding 32px, 2px right border):
    - **EmbeddingPanel** — 2px line-3 border, surface-1 bg, 3-col grid with 1px line-2 splitters. Cells: (a) `EMBEDDING STATUS` + green dot + `FRESH` (t-h3 20px in success) + `REGENERATED ON LAST SAVE — vector(1536)`; (b) `SLUG` + monospaced `pgvector-cosine-vs-inner-product` + `AUTO · slugify.ts · IMMUTABLE ONCE PUBLISHED`; (c) `VERSION` + `v7 · 19 APR 2026` + `6 PRIOR EDITS · ↻ VIEW HISTORY`.
    - **Form card** (32px below) — 2px line-3 border, bg `--color-bg`. Contains four `Field` rows. Each field is a 2-col `220px 1fr` grid with 1px top border on row + 1px right border on label gutter. Label gutter: `t-label` strong + optional small hint text. Input gutter: padding `14px 24px`. Fields:
      - **TITLE** (required) — `LineInput` (input with no border except 2px bottom line-3, padding `8px 0`, `t-body`).
      - **TAKEAWAY** — 3-row textarea with the same line-led styling. Hint: "Single-sentence summary. Sent to the LLM as context — full body is never sent."
      - **CATEGORY** — flex-wrap of category chips, one per option. Active chip: 1px accent-900 border, accent-100 bg, accent-900 text. Inactive: 1px line-2 border, transparent bg, muted text. Categories: `Systems, Databases, CI/CD, Auth, Writing, Debugging, RAG & LLMs, TypeScript, Process`.
      - **TAGS** — flex-wrap of existing tag chips (`#postgres`, `#pgvector`, `#rag`, `#benchmark`) each with `×` remove button, plus an inline tag-add LineInput at the end. Footer meta: `STORED AS text[] ON notes — KEBAB-CASE, LOWERCASE`.
    - **Body editor section** (32px below) — `BODY · MARKDOWN` label + `CODEMIRROR 6 · MARKDOWN MODE · WIKI-LINK AUTOCOMPLETE` meta. Then **MarkdownEditor**: 2px line-3 outer border, header bar (`MARKDOWN · PREVIEW` tabs left, `1,420 WORDS · 12 MIN READ · [[ WIKI-LINK ⌘K` right, surface-1 bg, 1px bottom border), then a 2-col grid `40px 1fr`: line numbers gutter (surface-1 bg, monospace, muted) + Markdown source pane (monospace, `--color-text`, white-space pre-wrap, min-height 480px). Inline highlights show `text-embedding-3-small` (accent-100 chip), `vector(1536)` and `vector_cosine_ops` (accent-700), `m=12` (warning). A blinking accent-700 caret (`@keyframes blink`) sits at the cursor position. Footer bar: `LN 14 · COL 32` + `MARKDOWN · UTF-8 · LF` meta.
    - **Footer action restate** — 2px top border, padding-top 20px. Left: `⌘S SAVE DRAFT`, `⌘⏎ PUBLISH`, `ESC BACK`. Right: `⌫ DELETE NOTE — REQUIRES CONFIRM` in `--color-error`.

  - **Right column** (sidebar, padding 32px, surface-1 bg, gap 24):
    - **CritiquePanel** — 2px border, surface-2 bg. Header: 6×6 accent dot + `AI CRITIQUE` label + `GEMINI 2.0 FLASH · FREE` meta. Body: a small disclaimer meta (`OPTIONAL — NEVER GATES SAVE`), then a 1px-rule list of 3 critiques (CLARITY/A, EVIDENCE/B, TONE/A) each with `t-label` accent-700 tag, score, and `t-body-sm` body. Then a `↻ RUN CRITIQUE AGAIN` button with `~3s` hint.
    - **Wiki-link suggest** — 2px border. Header: `[[ WIKI-LINK SUGGEST` + `3 MATCHES`. List of 3 candidate notes, each row showing monospaced `[[slug]]` + `t-body-sm` title, 1px row dividers. First row highlighted (accent-100 bg, accent-900 text). Footer: `↑ ↓ NAVIGATE` + `↵ INSERT`.
    - **Linked-from** — 2px border. Header `LINKED FROM · 4 NOTES`. List of 4 incoming references with `↗` icon per row.
    - **Pre-publish checklist** — 2px border. Header `PRE-PUBLISH CHECKLIST`. 6 rows: Title set ✓, Takeaway present (≤280 chars) ✓, Category assigned ✓, At least 1 tag ✓, Embedding fresh ✓, Cover image (optional) ○ SKIP (muted). Check marks use `--color-success`.

---

## Interactions & Behavior

- **Theme toggle.** `ga-theme-light` and `ga-theme-dark` both shipped; toggle a class on the root. Header has a `LIGHT / DARK` link slot — wire it to the theme class.
- **Hover states.** Buttons and links should darken or invert subtly. The codebase's existing patterns govern; don't introduce a new hover library. Accent buttons darken to `--color-accent-900` background. Line buttons fill on hover with `--color-line-3` bg + `--color-bg` text.
- **Active link.** Header nav uses a 2px bottom-border underline in `--color-line-3` for the current page, 4px below baseline.
- **Search.** `⌘K` opens a global search palette over notes (not designed in this handoff — implement using the codebase's command-menu pattern).
- **Chat composer.** `⌘↵` sends, `↑` recalls last message, `Esc` clears. Streamed responses arrive via SSE — render incrementally; the citation rail can populate before the prose finishes streaming. `[Y] [N]` helpfulness writes a thumbs vote against the message id.
- **Refusals.** When retrieval similarity scores are all below ~0.4 (or whatever threshold the existing RAG pipeline uses), render `RefusalMsg` instead of `AssistantMsg`. Include the closest match link.
- **Admin autosave.** Title/body/takeaway should autosave on debounced change (~1s idle). The `EDITED N MIN AGO · AUTOSAVED` meta reflects the last successful save.
- **Embedding regen.** Saving any change to body or takeaway should mark the embedding stale; the panel flips to `STALE` (warning color) until a background job regenerates. After regen, flips to `FRESH` (success).
- **Slug.** Generated from title via `slugify.ts` on first save; immutable once `status === 'published'`. UI must disable editing when published.
- **Category.** Single-select; clicking an inactive chip activates it and deactivates the previously active one.
- **Tags.** Free-form `text[]`. Add by typing + `↵`. Remove with `×`. Lowercased + kebab-cased on submit.
- **Wiki-links.** Typing `[[` in the body opens an autocomplete over note slugs. `↑↓` navigate, `↵` inserts `[[slug]]`. The right rail's "Wiki-link suggest" panel mirrors that state.
- **Publish.** Toggling status flips the pill color (warning ↔ success) and the primary button label (`↑ PUBLISH` ↔ `⌫ UNPUBLISH`).

## State Management

- **Theme** — a single root-level boolean / class. Persist to localStorage.
- **Chat** — conversations list, active conversation id, message history per conversation, streaming buffer, rate-limit counter (server-driven, mirrored client-side).
- **Admin** — `note` form state (title, takeaway, body, tags, category, status, slug, version, embeddingFresh). Plus transient: critique results, wiki-link autocomplete query/results, autosave status.

Data fetching: notes index (paginated) for landing + sidebar history; single conversation for chat; single note + linked-from list + critique-on-demand for admin.

## Design Tokens

All tokens live in **`tokens.css`** (included in this bundle). Port them verbatim. Summary:

**Light theme (`.ga-theme-light`):**
- Surfaces: `--color-bg` `#F5F1EA`, `--color-surface-1` `#F0ECE4`, `--color-surface-2` `#E7E2D9`
- Lines: `--color-line-1` `#D0CAC0` (1px hair), `--color-line-2` `#9F988D` (1px std), `--color-line-3` `#2A2824` (2/4px structural)
- Text: `--color-text-strong` `#171612`, `--color-text` `#2B2924`, `--color-text-muted` `#5D594F`
- Accent (sage, single primary): `--color-accent-100` `#E5EEDF`, `--color-accent-300` `#C2D3B8`, `--color-accent-500` `#93B184`, `--color-accent-700` `#6B8A5C`, `--color-accent-900` `#3F5634`
- Accent2 (warm taupe, secondary): `--color-accent2-100` `#F1EADD`, `…-300` `#DFCEAF`, `…-500` `#BBA079`, `…-700` `#8C7551`, `…-900` `#54422A`
- Status: success `#4F7A56`, warning `#8A6B2D`, error `#A1433D`, info `#446E86`

**Dark theme (`.ga-theme-dark`):** warm tonal off-blacks (`#1C1A15` bg). Full ramps in `tokens.css`.

**Typography roles** (verbatim — port to the target codebase's type system):
| Class | Family | Size | Weight | Line-height | Tracking |
|---|---|---|---|---|---|
| `t-display` | Space Grotesk | 72px | 700 | 0.95 | -0.03em |
| `t-h1` | Space Grotesk | 52px | 700 | 1.0 | -0.02em |
| `t-h2` | Space Grotesk | 36px | 600 | 1.1 | -0.01em |
| `t-h3` | Space Grotesk | 28px | 600 | 1.15 | -0.005em |
| `t-body-lg` | Literata | 22px | 400 | 1.65 | — |
| `t-body` | Literata | 18px | 400 | 1.7 | — |
| `t-body-sm` | Literata | 16px | 400 | 1.6 | — |
| `t-label` | Space Grotesk | 12px | 600 | 1.2 | 0.1em, UPPERCASE |
| `t-meta` | Space Grotesk | 11px | 500 | 1.25 | 0.08em, UPPERCASE |
| `t-code` | Space Grotesk | 14px | 500 | 1.5 | — |

Heads commonly override sizes inline (Display at 44px in the header, 88px in the hero, etc.) — those are deliberate; preserve them.

**Lines (`l-thin` / `l-std` / `l-strong`):** 1px line-1, 2px line-3, 4px line-3.

**Border radius — 0px everywhere.** `tokens.css` enforces this with `border-radius: 0 !important` on every descendant of `.ga-root`. Don't introduce rounded corners.

**Spacing scale.** Implicit. Page padding sits at 32px (admin) / 48px (landing) / 64px (chat surface). Section vertical padding at 32–64px. Field row padding at 14–24px.

**Selection.** `::selection` uses `--color-accent-500` bg + `--color-bg` text.

**Paper noise.** `.ga-paper` adds a near-invisible radial-gradient texture (opacity 0.018 light / 0.025 dark, 4px tile, multiply/screen blend). Optional but recommended on root surfaces.

**Stripe placeholder.** `.ga-placeholder` is a 135° hatched fill used for image plates (author photo, cover-image slots). Don't ship this in production — it marks where a real image should go.

## Assets

- **Fonts.** Space Grotesk (400/500/600/700) and Literata (variable, italic + roman). Loaded from Google Fonts in `tokens.css`. The codebase should self-host both via its existing font pipeline.
- **Images.** No real imagery shipped. The author photo is a hatched placeholder (`.ga-placeholder` 96×96). Cover images on note rows are hinted at but not included; they're optional per the publish checklist.
- **Icons.** No icon set is used. All glyphs are typographic: `↗ ↑ → ⟶ ↵ ⌘ ⌥ ⌫ ⌕ ⏎ ↻ ⧉ ›`. Keep them as text characters, not SVG.

## Files

- `landing.jsx` — `<GALanding />` component, the public homepage.
- `chat.jsx` — `<GAChat />` component, the Ask the Archive surface.
- `admin.jsx` — `<GAAdmin />` component, the note editor.
- `tokens.css` — full design tokens (light + dark themes, type roles, lines, utilities). **Source of truth.**
- `Glass Atlas Drafts.html` — the original design canvas with all three artboards arranged side-by-side. Use this to preview the designs visually; not intended for production.

Note that the JSX files use `React.createContext`-free component definitions and assume a global `React` (`React.useState`, etc.) — they are *not* importable modules. Treat them as visual references and re-implement in idiomatic SvelteKit components (or whatever the target framework is).
