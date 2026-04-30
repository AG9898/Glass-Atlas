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

### Notes Index (`/notes`)

- Default pattern is **rule-separated rows**.
- Use horizontal and vertical dividers to structure content density.
- Avoid decorative cards for standard note previews.

### Note View / Main Blog (`/notes/[slug]`)

- Prioritize reading comfort and scanability.
- Use the same type and spacing scales as the index, with fewer layout disruptions.
- Emphasize section dividers, pull quotes, diagrams, and code/technical callouts.

### Chat (`/` and shared chat UI)

- Structural but calm.
- Keep strong typography and divider language.
- Limit visual disruption so conversation scanning remains primary.

### Admin (`/admin/**`)

- Shared token system with public surfaces.
- Lower asymmetry and lower visual drama.
- Optimize for speed of editing and form clarity.

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

### 5.4 Chat Surface

- Message groups separated by thin lines and spacing rhythm.
- User/assistant differentiation via subtle surface tone shifts, not rounded bubbles.
- Citations and source links use label/meta type with clear line-bound containers.

### 5.5 Admin Forms

- Same tokens as public UI.
- Use direct, linear form sections with consistent row dividers.
- Accent usage in admin is sparse; reserve for focus, primary action, and success state.
- Markdown body editing uses `MarkdownEditor.svelte` with the blueprint technical panel recipe: `2px` border, uppercase header strip, `surface-2` in light mode, and `surface-1` in dark mode.
- The note create/edit form uses a two-column editor: main column for title, takeaway, category, tags, and Markdown body; right sidebar for status, published date, series, and cover media URL.
- The edit form top bar must keep the breadcrumb, visible `DRAFT`/`PUBLISHED` status badge, `PREVIEW`, `SAVE DRAFT`, and `PUBLISH` controls on the same structural row on desktop; mobile may stack the controls but must preserve the order.

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

---

## 7) Accessibility and Quality Gates

- Baseline contrast target: WCAG AA across UI.
- Selective AAA target: long-form article text and key reading surfaces.
- Focus states must be keyboard-visible on every interactive element.
- Minimum body text for long-form reading: 18px equivalent.
- Do not encode meaning by color alone; pair semantic color with text/icon/label.

---

## 8) Anti-Patterns (Do Not Ship)

- Rounded corners on structural UI.
- Shadow-heavy elevation systems.
- Additional accent families beyond the defined `accent` + `accent2` token sets.
- Dense card mosaics as the default notes browsing pattern.
- Decorative gradients or texture overlays that reduce legibility.
- Unconstrained asymmetry that breaks reading flow on mobile.

---

## 9) Implementation Alignment

- Use [bits-ui.md](bits-ui.md) as the default interactive component implementation policy.
- Use [GSAP.md](GSAP.md) as the animation planning reference; do not treat it as a finalized motion standard yet.

---

## 10) Design Reference

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

**Note View / Main Blog (`/notes/[slug]`):**
- Three-column layout: left sidebar (notes catalog — all published notes listed by date, NEW CONVERSATION CTA at top), main column (note Markdown body), right sidebar (related notes + cite section).
- Structural pattern aligns with the chat surface conventions (line-led rails, citations, and grounded response framing), but this route remains the canonical note-view/main-blog page.

**Admin Note Editor (`/admin/notes/[slug]/edit`):**
- Two-column: left = title / takeaway / CodeMirror body / tags + categories; right sidebar = date, status, series, related notes.
- Top bar: breadcrumb + DRAFT/PUBLISHED status badge + PREVIEW / SAVE DRAFT / PUBLISH buttons.
