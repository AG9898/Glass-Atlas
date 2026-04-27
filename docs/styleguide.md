# Style Guide — Glass Atlas

This document is the canonical visual system for Glass Atlas. It defines enforceable design rules for implementation across public and admin surfaces.

---

## 1) Brand Direction

Glass Atlas uses **Soft Editorial Brutalism**:

- Architectural structure with visible rules and sharp geometry.
- Editorial reading comfort with restrained color and typography hierarchy.
- Controlled asymmetry as a brand signature.
- Flat surfaces with no shadow-based depth.

### Non-Negotiable Traits

- `Light + Dark` parity is required.
- One brand accent family only: drained tonal matcha/sage.
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

### Note Detail (`/notes/[slug]`)

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

Token names below are normative implementation targets.

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
| `--color-bg` | `#10100E` | App/page background |
| `--color-surface-1` | `#171714` | Primary panels |
| `--color-surface-2` | `#20201C` | Alternate panels |
| `--color-line-1` | `#2E2D28` | Subtle separators |
| `--color-line-2` | `#4D4B44` | Standard borders |
| `--color-line-3` | `#D8D4C9` | High-emphasis rules |
| `--color-text-strong` | `#E8E3D7` | Headings, key labels |
| `--color-text` | `#D3CEC3` | Body text |
| `--color-text-muted` | `#A9A396` | Secondary metadata |

#### Accent Scale (Single Family: Matcha/Sage)

| Token | Value | Usage |
|---|---|---|
| `--color-accent-100` | `#E8EFE3` | Light fills, subtle highlights |
| `--color-accent-300` | `#C5D3BC` | Soft emphasis surfaces |
| `--color-accent-500` | `#8EA481` | Primary accent |
| `--color-accent-700` | `#607556` | Active emphasis |
| `--color-accent-900` | `#3D4D37` | High-contrast accent text/icons |

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

### 5.6 Blueprint Technical Panels (Code/Diagrams/Demos)

- `2px` border + muted tonal surface (`surface-2` in light, `surface-1` in dark).
- Header strip with uppercase meta label and optional status marker.
- Internal regions separated by `1px` rules.
- No shadows, no glassmorphism, no rounded corners.

### 5.7 Buttons, Inputs, Tags

- Buttons: rectangular, `2px` border, fill transitions only.
- Inputs: line-led styling, strong focus contrast, explicit error/success borders.
- Tags/chips: uppercase label tokens; compact sharp rectangles.

---

## 6) Imagery and Media Rules

- Default editorial visuals are technical diagrams, interface captures, and demonstration media.
- Most media should be monochrome or muted to keep accent ownership in UI structure.
- Color photos are allowed primarily in landing hero/editorial feature contexts.
- Never rely on image effects to create hierarchy that should come from layout/type/rules.

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
- Multiple accent hue families.
- Dense card mosaics as the default notes browsing pattern.
- Decorative gradients or texture overlays that reduce legibility.
- Unconstrained asymmetry that breaks reading flow on mobile.
