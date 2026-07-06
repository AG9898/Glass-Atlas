# Style Guide — Glass Atlas

This document is the canonical visual system for Glass Atlas. It defines enforceable design rules for implementation across public and admin surfaces.

Implementation references:

- [bits-ui.md](bits-ui.md)
- [GSAP.md](GSAP.md)

---

## 1) Brand Direction

Glass Atlas uses **Soft Editorial Brutalism**:

- Architectural structure with visible rules and sharp geometry.
- Editorial reading comfort with restrained color and typography hierarchy.
- Controlled asymmetry as a brand signature.
- Flat surfaces with no shadow-based depth.

### Non-Negotiable Traits

- `Light + Dark` parity is required.
- Accent system is fixed to two families from the handoff token source: primary sage (`--color-accent-*`) + secondary warm taupe (`--color-accent2-*`).
- Structural geometry is strict: `0px` corner radius.
- Divider hierarchy is fixed: `1px`, `2px`, `4px`.
- Feed/list browsing is row-first (not card-heavy).

---

## 2) Product Surface Rules

### Landing (`/`)

- Highest visual expression in the product.
- Asymmetry, overlaps, and offset blocks are allowed when content remains readable.
- Hero modules may break grid symmetry; body modules must return to structural rhythm.
- Default landing hero split is editorial copy (~40%) and compact chat (~60%) on desktop; collapse to single-column on narrow viewports.
- The landing chat panel must use the standard neutral surface token in dark mode: `--color-surface-1` (`#232019`), not a custom olive override.
- The homepage remains chat-first. Supporting note lists, stats, and prompts should be populated automatically from published notes unless a future curation decision changes that.
- **Shipped (`POLISH-06`):** chat-first hierarchy is reinforced on mobile, not just desktop. `+page.svelte`'s hero markup places the chat `<aside>` before the copy `<div>` in DOM order, so the collapsed single-column mobile layout shows the chat panel first (no headline/CTA scroll penalty before reaching it). Desktop keeps the original copy-left/chat-right visual split via explicit `grid-column` **and** `grid-row` placement on both children (both are required — pinning only `grid-column` lets auto-placement push the out-of-DOM-order item to a second row instead of sharing row 1 with its sibling). The mobile media query resets both properties to `auto` so single-column stacking follows DOM order.
- **Shipped (`POLISH-07C`):** landing motion is now a page-local GSAP enhancement. The first viewport remains chat-first while hero rules, copy, CTA, chat panel, and stats enter with short staggered timing; the latest-note section uses a one-shot ScrollTrigger reveal for its rule/header/rows. Motion hooks are `data-motion` attributes, and reduced-motion mode exits before spatial transforms are applied so the page stays immediately readable.

### Notes Index (`/notes`)

- Default pattern is **rule-separated rows**.
- Use horizontal and vertical dividers to structure content density.
- Avoid decorative cards for standard note previews.
- Keep a compact filter bar with `Search`, `Topic`, and `Sort`; search and topic filters must compose in the URL (`?q=` + `?topic=`).
- **Shipped (`POLISH-07D`):** notes rows now use page-local GSAP choreography on first load and filter/sort URL changes. The motion is limited to small `y` offsets plus opacity on the first visible rows, keyed to the filtered slug list, and reduced-motion mode exits before any spatial transform is applied.

### Note View / Main Blog (`/notes/[slug]`)

- Prioritize reading comfort and scanability.
- Use the same type and spacing scales as the index, with fewer layout disruptions.
- Emphasize section dividers, pull quotes, diagrams, and code/technical callouts.
- Reader-path modules should distinguish semantic related notes from backlinks/outlinks. Keep them line-led, compact, and secondary to the article body.
- The note graph remains a small supporting widget, but motion/interaction should feel fluid and exploratory rather than static.
- **Shipped (`POLISH-07D`):** note detail motion is one restrained editorial sequence for cover media, category, title, metadata, tags, and takeaway, followed by a one-shot reveal for only the first four major article blocks. Do not extend this into paragraph-by-paragraph choreography; the long-form body must remain stable and immediate.

### Chat (`/` and shared chat UI)

- Structural but calm.
- Keep strong typography and divider language.
- Limit visual disruption so conversation scanning remains primary.
- Source controls live inside or directly attached to assistant messages only when sources exist. Use a compact label/icon button and a popup/dialog with note titles plus brief snippets; the popup should feel like evidence inspection, not a separate browsing surface.
- Public confidence/coverage language should be subtle. Avoid large badges or alarm styling for ordinary partial coverage.

### Admin (`/admin/**`)

- Shared token system with public surfaces.
- Lower asymmetry and lower visual drama.
- Optimize for speed of editing and form clarity.
- Editor-page quality warnings are cautionary, not blocking. Use warning semantics with explicit labels and keep them close to the note status/editor controls.

### How It Works (`/how-it-works`)

- Tone should work as both reader-friendly explanation and technical colophon.
- Include the stack and architecture at a high level, but do not turn the page into a portfolio/project showcase.
- Do not include chat privacy/rate-limit details unless a future product decision reopens that scope.
- Composition should be editorial and scannable: short sections, structural rules, and restrained technical panels for architecture details.
- **Shipped (`POLISH-05`):** the page is a single-column editorial shell (`max-width: 900px`) with rule-bound header/section dividers (`--line-strong`/`--line-thin`) matching the notes-index rhythm. The "Stack" and "How the pieces fit" sections each use a scoped `.blueprint-panel` (the same `2px` border + uppercase header-strip + `surface-2` tonal recipe as `.ga-code-block`, but component-scoped rather than global since no HTML injection is involved). `Nav.svelte`'s left link group gained a `HOW IT WORKS` entry next to `NOTES`/`CHAT`.

---

## 3) Token Contract

Token names and values below are normative implementation targets and must stay in sync with `reference/UI/design_handoff_glass_atlas/tokens.css`.

### 3.1 Color Tokens

#### Neutral Scale (Light)

| Token | Value | Usage |
|---|---|---|
| `--color-bg` | `#F5F1EA` | App/page background |
| `--color-surface-1` | `#F0ECE4` | Primary panels |
| `--color-surface-2` | `#E7E2D9` | Alternate panels |
| `--color-line-1` | `#D0CAC0` | Subtle separators |
| `--color-line-2` | `#9F988D` | Standard borders |
| `--color-line-3` | `#2A2824` | High-emphasis rules |
| `--color-text-strong` | `#171612` | Headings, key labels |
| `--color-text` | `#2B2924` | Body text |
| `--color-text-muted` | `#5D594F` | Secondary metadata |

#### Neutral Scale (Dark)

| Token | Value | Usage |
|---|---|---|
| `--color-bg` | `#1C1A15` | App/page background |
| `--color-surface-1` | `#232019` | Primary panels |
| `--color-surface-2` | `#2C281F` | Alternate panels |
| `--color-line-1` | `#38342B` | Subtle separators |
| `--color-line-2` | `#5A554A` | Standard borders |
| `--color-line-3` | `#C9C2B2` | High-emphasis rules |
| `--color-text-strong` | `#E8E1CE` | Headings, key labels |
| `--color-text` | `#CFC8B7` | Body text |
| `--color-text-muted` | `#968F80` | Secondary metadata |

#### Accent Scale (Primary Sage — Light)

| Token | Value | Usage |
|---|---|---|
| `--color-accent-100` | `#E5EEDF` | Light fills, subtle highlights |
| `--color-accent-300` | `#C2D3B8` | Soft emphasis surfaces |
| `--color-accent-500` | `#93B184` | Primary accent |
| `--color-accent-700` | `#6B8A5C` | Active emphasis |
| `--color-accent-900` | `#3F5634` | High-contrast accent text/icons |

#### Accent Scale (Primary Sage — Dark)

| Token | Value | Usage |
|---|---|---|
| `--color-accent-100` | `#1A2118` | Accent-adjacent low-emphasis surfaces |
| `--color-accent-300` | `#2E3B29` | Secondary emphasis surfaces |
| `--color-accent-500` | `#8EA481` | Primary accent |
| `--color-accent-700` | `#A8BE9B` | Active emphasis |
| `--color-accent-900` | `#C5D3BC` | High-contrast accent text/icons |

#### Accent2 Scale (Secondary Warm Taupe — Light)

| Token | Value | Usage |
|---|---|---|
| `--color-accent2-100` | `#F1EADD` | Subtle alternate highlight surfaces |
| `--color-accent2-300` | `#DFCEAF` | Soft alternate emphasis |
| `--color-accent2-500` | `#BBA079` | Secondary accent base |
| `--color-accent2-700` | `#8C7551` | Secondary accent active emphasis |
| `--color-accent2-900` | `#54422A` | Secondary accent high contrast text/icons |

#### Accent2 Scale (Secondary Warm Taupe — Dark)

| Token | Value | Usage |
|---|---|---|
| `--color-accent2-100` | `#2A241A` | Subtle alternate highlight surfaces |
| `--color-accent2-300` | `#463B28` | Soft alternate emphasis |
| `--color-accent2-500` | `#BBA079` | Secondary accent base |
| `--color-accent2-700` | `#CFB58E` | Secondary accent active emphasis |
| `--color-accent2-900` | `#E4D2B0` | Secondary accent high contrast text/icons |

#### Semantic Utility Tokens

Brand accent does not replace utility semantics.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--color-success` | `#4F7A56` | `#8BC090` | Confirmed success states |
| `--color-warning` | `#8A6B2D` | `#C9A761` | Caution, non-fatal warnings |
| `--color-error` | `#A1433D` | `#E08C85` | Errors and destructive alerts |
| `--color-info` | `#446E86` | `#8BB6CF` | Informational statuses |

### 3.2 Accent Usage Budget

- Accent surfaces: max `15%` of visible viewport area per screen.
- Accent text/labels: max `20%` of text elements per section.
- At most one accent-dominant module in view at a time.
- Utility colors must appear only in semantic contexts, never as decoration.

### 3.3 Typography Tokens

Fonts are **self-hosted**.

- Sans family: `Space Grotesk`.
- Serif family: `Literata`.

| Role | Family | Size | Weight | Line Height | Letter Spacing | Usage |
|---|---|---:|---:|---:|---:|---|
| `--type-display` | Space Grotesk | 72px | 700 | 0.95 | -0.03em | Hero/issue headlines |
| `--type-h1` | Space Grotesk | 52px | 700 | 1.0 | -0.02em | Primary section headings |
| `--type-h2` | Space Grotesk | 36px | 600 | 1.1 | -0.01em | Secondary headings |
| `--type-h3` | Space Grotesk | 28px | 600 | 1.15 | -0.005em | Subsection headings |
| `--type-body-lg` | Literata | 22px | 400 | 1.65 | 0 | Feature intros |
| `--type-body` | Literata | 18px | 400 | 1.7 | 0 | Long-form reading |
| `--type-body-sm` | Literata | 16px | 400 | 1.6 | 0 | Supporting paragraphs |
| `--type-label` | Space Grotesk | 12px | 600 | 1.2 | 0.1em | UI labels (uppercase) |
| `--type-meta` | Space Grotesk | 11px | 500 | 1.25 | 0.08em | Dates, read time, tags |
| `--type-code` | Space Grotesk | 14px | 500 | 1.5 | 0 | Inline/blocks metadata wrappers |

### 3.4 Spacing and Grid Tokens

| Token | Value |
|---|---|
| `--space-1` | `4px` |
| `--space-2` | `8px` |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-5` | `24px` |
| `--space-6` | `32px` |
| `--space-7` | `48px` |
| `--space-8` | `64px` |
| `--space-9` | `96px` |

| Grid Token | Desktop | Tablet | Mobile |
|---|---|---|---|
| `--grid-columns` | 12 | 8 | 4 |
| `--grid-gutter` | 24px | 20px | 16px |
| `--grid-margin` | 48px | 32px | 20px |
| `--content-max` | 1440px | 100% | 100% |

### 3.5 Shape and Border Tokens

| Token | Value | Rule |
|---|---|---|
| `--radius-none` | `0px` | Only allowed radius token |
| `--line-thin` | `1px` | Internal separators |
| `--line-std` | `2px` | Default component borders |
| `--line-strong` | `4px` | Section/major rhythm breaks |

---

## 4) Composition and Asymmetry Rules

### Desktop / Wide Tablet

- Asymmetry is expected in hero and feature sections.
- Use one of: offset image plate, overlapping text slab, uneven column split (`7/5`, `8/4`, `9/3`).
- Keep at least one structural anchor axis per section (vertical or horizontal line continuity).

### Mobile

- Collapse overlaps and offsets into stacked flow.
- Preserve hierarchy via type scale and divider weight, not overlap.
- Keep content blocks full-width within grid margin; no clipped side overflow.

### Structural Rhythm

- Every major section begins or ends with a divider (`2px` or `4px`).
- Adjacent modules must share at least one alignment edge.
- Empty space is intentional; do not fill voids with decorative ornaments.

---

## 5) Component Recipes

### 5.1 Navigation/Header

- Top-level nav uses `Space Grotesk` labels in uppercase.
- Active item: line emphasis (`2px`) and stronger text token.
- Search and utility controls stay minimal and line-driven.

### 5.2 Note Feed Rows

- Row-first layout with `2px` horizontal separators.
- Optional vertical rule splits metadata from excerpt/media.
- Featured row may include one accent surface or one asymmetrical media offset.

### 5.3 Note Detail

- Long-form text uses `Literata` body roles.
- Section headers and inline callouts use `Space Grotesk`.
- Diagrams/code blocks use blueprint panel recipe (below).
- Related notes, backlinks, and outlinks use compact row/list treatments with visible rules. Do not put the article body inside a card.

### 5.4 Chat Surface

- Message groups separated by thin lines and spacing rhythm.
- User/assistant differentiation via subtle surface tone shifts, not rounded bubbles.
- Citations and source links use label/meta type with clear line-bound containers.
- Source popup triggers should use label/meta type and minimal borders. The popup content should favor scanability: source title, one brief snippet, and direct note link.

### 5.5 Admin Forms

- Same tokens as public UI.
- Use direct, linear form sections with consistent row dividers.
- Accent usage in admin is sparse; reserve for focus, primary action, and success state.
- Markdown body editing uses `MarkdownEditor.svelte` with the blueprint technical panel recipe: `2px` border, uppercase header strip, `surface-2` in light mode, and `surface-1` in dark mode.
- The note create/edit form uses a two-column editor: main column for title, takeaway, category, tags, and Markdown body; right sidebar for status, published date, series, and cover media controls.
- Cover media controls must place the `media_type` selector next to the cover media URL field in the same row on desktop (stack on mobile).
- The edit form top bar must keep the breadcrumb, visible `DRAFT`/`PUBLISHED` status badge, `PREVIEW`, `SAVE DRAFT`, and `PUBLISH` controls on the same structural row on desktop; mobile may stack the controls but must preserve the order.
- Quality warnings inside editor pages should stack as compact line-led notices, not cards. They should not visually compete with destructive or primary actions.

### 5.6 Admin Lists

- Admin index/list pages use table-style rows with explicit column labels on desktop.
- Preserve the row-first product language: `2px` row separators, uppercase metadata labels, no rounded cards.
- On mobile, collapse table columns into stacked row content while preserving the note number and action buttons.
- Status badges must pair semantic color with explicit text (`DRAFT` / `PUBLISHED`) so color is not the only signal.

### 5.7 Blueprint Technical Panels (Code/Diagrams/Demos)

- `2px` border + muted tonal surface (`surface-2` in light, `surface-1` in dark).
- Header strip with uppercase meta label and optional status marker.
- Internal regions separated by `1px` rules.
- No shadows, no glassmorphism, no rounded corners.
- Code block header strips may include language labels, optional filename labels, copy controls, and wrapping controls.
- **Shipped (`PUBLIC-05B`):** every rendered `<pre><code>` fence (highlighted, plain-text fallback, or failed-Mermaid fallback) is wrapped in a `.ga-code-block` panel: `2px` border (`--color-line-3`), `surface-2`/`surface-1` tonal chrome, a header strip (`.ga-code-block__header`) separated from the code body by a `1px` rule, holding an uppercase `Space Grotesk` language label (only when the fence's language is known), an optional uppercase filename label (from a `filename="..."` fence-meta attribute, separated from the language label by a `1px` vertical rule), and two rectangular `2px`-bordered control buttons (`COPY`, `WRAP`) on the trailing edge. Neither control changes size on state change (only border/text color), so interacting with them never shifts the panel or surrounding note-body layout.
- Mermaid diagrams render as inline SVG (see `docs/CONVENTIONS.md` — Public Markdown Technical Blocks) wrapped in a `div.mermaid-diagram` container; a diagram that fails to render falls back to the same readable unhighlighted-code-with-controls fallback state as plaintext fences (including its own `.ga-code-block` chrome and `MERMAID` language label). The `mermaid-diagram` wrapper for a *successfully rendered* diagram does not yet carry the full blueprint panel chrome (header strip, `2px` border) — that visual polish is still open follow-up work, not part of `PUBLIC-05A` or `PUBLIC-05B`.

### 5.8 Buttons, Inputs, Tags

- Buttons: rectangular, `2px` border, fill transitions only.
- Inputs: line-led styling, strong focus contrast, explicit error/success borders.
- Tags/chips: uppercase label tokens; compact sharp rectangles.

---

## 6) Imagery and Media Rules

- Default editorial visuals are technical diagrams, interface captures, and demonstration media.
- Most media should be monochrome or muted to keep accent ownership in UI structure.
- Color photos are allowed primarily in landing hero/editorial feature contexts.
- Never rely on image effects to create hierarchy that should come from layout/type/rules.

### Cover Media Technical Rules

- **All cover media is optional.** NoteCard and note detail must render correctly when no media URL is set. Never use a placeholder or fallback image.
- **All cover media containers enforce `aspect-ratio: 16/9`.** Use `object-fit: cover` for raster images and GIFs. No exceptions.
- **Allowed cover media formats are fixed:** JPEG, PNG, SVG, GIF, and MP4.
- **JPEG/PNG/SVG/GIF** render via `<img>`. GIFs animate automatically — no hover-to-play interaction needed.
- **MP4 video** renders via `<video controls preload="metadata">` inside a `16/9` aspect-ratio container. Autoplay is not permitted; muted looping background video is not permitted.
- **Media type dispatch** is driven by `media_type` (`image-jpeg` / `image-png` / `image-svg` / `image-gif` / `video-mp4`).
- **First-party uploaded media** is stored in private Railway Storage Buckets and delivered via presigned URLs. Do not assume permanent public bucket URLs.
- **Admin upload UX** (`/admin/notes/new`, `/admin/notes/[slug]/edit`) must provide file upload controls for JPEG, PNG, SVG, GIF, and MP4 and persist a stable app access path (`/api/admin/media/access-url?key=...`) in the `image` field.

---

## 7) Motion and Generated Assets

Motion belongs to the visual system. It must reinforce the same structural rules as the static design: sharp geometry, visible dividers, flat depth, restrained accent usage, and editorial reading comfort.

### 7.1 Public Motion Scope

- Public surfaces may receive the full motion treatment: landing, notes index, note detail, public editorial routes, chat moments, page transitions, and smooth scroll.
- Admin surfaces remain intentionally lower-motion. Use small state transitions only unless a dedicated admin-motion task changes that rule.
- Use [GSAP.md](GSAP.md) as the canonical implementation spec for GSAP, ScrollTrigger, ScrollSmoother, and page-transition behavior.

### 7.2 Motion Language

- Prefer line-led reveals, divider drawing, small vertical offsets, opacity, clip reveals, and subtle staggered timing.
- Avoid bounce, elastic overshoot, heavy parallax, scroll-jacking, animated decoration with no content relationship, and motion that delays reading.
- Do not animate every paragraph or every repeated item on long pages. Animate the structural arrival of a section, then let the reader read.
- Reduced-motion users must get instant state changes or simple non-spatial fades.

### 7.3 3D Grid Field Direction

The approved branded motion-asset direction is a wave-like 3D grid field.

- The field should feel like a structural coordinate plane or knowledge surface, not a literal map illustration.
- Use neutral line colors with restrained sage and warm taupe accents from the token system.
- Keep the field line-based, sparse, and readable behind or between content modules.
- Provide a static or near-static reduced-motion fallback.
- If implemented as real-time 3D, use Three.js and keep it integrated into the page structure rather than framed as a decorative card.
- Generated bitmap assets may be used for loader frames, transition plates, or static fallback frames when they match this style.

### 7.4 Loading and Transition Assets

- Loading and transition visuals should use Glass Atlas geometry: rules, grids, coordinate lines, sharp rectangular masks, and restrained type.
- Avoid stock-like abstract art, glossy glass effects, gradient-orb compositions, and mascot-style illustrations.
- Asset generation prompts must explicitly include the palette, sharp geometry, flat editorial brutalism, and no rounded/glossy decoration.

---

## 8) Accessibility and Quality Gates

- Baseline contrast target: WCAG AA across UI.
- Selective AAA target: long-form article text and key reading surfaces.
- Focus states must be keyboard-visible on every interactive element.
- Minimum body text for long-form reading: 18px equivalent.
- Do not encode meaning by color alone; pair semantic color with text/icon/label.
- Motion must respect `prefers-reduced-motion` and must not be required to understand or navigate content.

---

## 9) Anti-Patterns (Do Not Ship)

- Rounded corners on structural UI.
- Shadow-heavy elevation systems.
- Additional accent families beyond the defined `accent` + `accent2` token sets.
- Dense card mosaics as the default notes browsing pattern.
- Decorative gradients or texture overlays that reduce legibility.
- Unconstrained asymmetry that breaks reading flow on mobile.
- Whole-page scroll effects that trap input, break anchor/focus behavior, or make reading feel delayed.
- Generated motion assets that look like generic sci-fi, glossy glassmorphism, or brand-unrelated abstract decoration.

---

## 10) Implementation Alignment

- Use [bits-ui.md](bits-ui.md) as the default interactive component implementation policy.
- Use [GSAP.md](GSAP.md) as the finalized public motion implementation standard.

---

## 11) Design Reference

Canonical visual mockups are in `reference/UI/design_handoff_glass_atlas/`. These are the authority for pixel-level layout and surface decisions. When in doubt, the reference image wins over any written description.

| File | Surface |
|---|---|
| `Landing light.png` | `/` — light mode |
| `Landing dark.png` | `/` — dark mode |
| `Note viewer light.png` | `/notes/[slug]` (Note View / Main Blog) — light mode |
| `Note viewer dark.png` | `/notes/[slug]` (Note View / Main Blog) — dark mode |
| `Admin note editor light.png` | `/admin/notes/[slug]/edit` — light mode |
| `Admin note editor dark.png` | `/admin/notes/[slug]/edit` — dark mode |

### Per-page layout notes

**Landing (`/`):**
- Two-column hero: left ~40% = large Literata serif headline + CTA; right ~60% = Chat panel.
- Stats row (4 stats) below the hero.
- "The latest field notes." section with rule-separated NoteCard rows.
- **Dark mode chat panel**: use `--color-surface-1` (`#232019`) from the handoff tokens. No additional panel token should be created.
- Keep the first screen optimized for asking a question. Note previews and reading paths support the chat, not replace it.

**Note View / Main Blog (`/notes/[slug]`):**
- Three-column layout: left sidebar (notes catalog — all published notes listed by date, NEW CONVERSATION CTA at top), main column (note Markdown body), right sidebar (related notes + cite section).
- Structural pattern aligns with the chat surface conventions (line-led rails, citations, and grounded response framing), but this route remains the canonical note-view/main-blog page.
- Related notes should prioritize semantic relevance. Backlinks/outlinks should be labeled separately as explicit note connections.
- The graph should stay small, but future polish should improve movement, hover/click feedback, and perceived continuity. Hovering a node dims unrelated nodes/links, highlights the hovered node's direct connections, and enlarges the hovered node via CSS-eased transitions (`r`/`opacity`/`stroke-opacity`/`stroke-width`); clicking a non-current node still navigates to `/notes/[slug]`. Nodes seed from a small radial spread (rather than all stacking at the exact center) so the force simulation has a visible, fluid unfold instead of a static snap. Under `prefers-reduced-motion: reduce`, the simulation converges synchronously and paints once with no animated ticks or hover transitions, so the graph stays fully usable without motion.

**Admin Note Editor (`/admin/notes/[slug]/edit`):**
- Two-column: left = title / takeaway / CodeMirror body / tags + categories; right sidebar = date, status, series, related notes.
- Top bar: breadcrumb + DRAFT/PUBLISHED status badge + PREVIEW / SAVE DRAFT / PUBLISH buttons.
- Quality warnings for stale embeddings, missing takeaway, no internal links, and weak title appear inside the editor page and never block save/publish controls.
