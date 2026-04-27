# Bits UI Guide — Glass Atlas

This guide defines how Glass Atlas uses `bits-ui` as the default component primitive system. It is implementation policy, not optional guidance.

Related docs:

- [styleguide.md](styleguide.md)
- [CONVENTIONS.md](CONVENTIONS.md)
- [GSAP.md](GSAP.md)

---

## 1) Decision

`bits-ui` is the default interactive UI library for Glass Atlas.

- Use Bits primitives/components first for interactive controls and overlays.
- Do not build custom interaction widgets when a Bits component exists and can meet requirements.
- Apply Glass Atlas styling via tokens and utility classes; do not depend on pre-styled kits.

This preserves accessibility quality, implementation speed, and system consistency.

---

## 2) Installation and Baseline

Required packages:

- `bits-ui`
- `@internationalized/date` (Bits peer dependency)

Installed via:

```bash
npm install bits-ui @internationalized/date
```

Svelte requirement:

- Bits usage in this project assumes Svelte 5 runes and current SvelteKit conventions.

---

## 3) Usage Policy

### 3.1 Default-First Rule

For any new interactive UI, first evaluate Bits components before writing custom logic:

- Dialogs, popovers, tooltips, dropdown/context menus.
- Selects, comboboxes, tabs, switches, sliders, toggles.
- Date/time fields and related input primitives.
- Navigation and keyboard-driven menus where relevant.

### 3.2 Allowed Exceptions

Custom components are allowed only when at least one is true:

- No suitable Bits primitive exists.
- The required interaction model is incompatible with Bits architecture.
- Performance constraints require a tailored solution.
- The surface is purely presentational (non-interactive layout shell).

When using an exception, document the reason in the PR/commit notes and keep semantics/accessibility parity.

### 3.3 Composition Rule

Prefer a local wrapper pattern over raw route-level Bits usage:

- Build local primitives in `src/lib/components/ui/`.
- Keep behavior from Bits; add only style and app-specific API shape.
- Centralize shared classes/token mappings in wrapper components or helper utilities.

---

## 4) Styling Contract With Style Guide

Bits components must follow [styleguide.md](styleguide.md) without deviation.

Hard constraints:

- `0px` radius only.
- Border hierarchy: `1px / 2px / 4px`.
- Matcha/sage single-accent discipline.
- Row-first feed patterns for note browsing.
- No shadow-based depth; use line and tonal stacking.

State styling requirements:

- Use `data-*` attributes emitted by Bits for open/closed/active/disabled states.
- Apply focus-visible styles explicitly for keyboard users.
- Preserve AA contrast baseline and selective AAA for long-form reading surfaces.

---

## 5) Product Mapping (Bits by Surface)

### Landing (`/`)

- Use Bits where interaction exists (menus, toggles, disclosure, tooltips).
- Preserve high-expression layout from style guide; Bits handles interaction, not layout identity.

### Notes Index / Detail

- Filters and sort controls: `Select`, `Combobox`, `Toggle Group`, `Tabs` as needed.
- Context actions: `Dropdown Menu` or `Popover`.
- Keep listing structure row-based and divider-led.

### Chat

- Use Bits primitives for menu/actions/assistive overlays.
- Keep message stream rendering custom and calm; avoid unnecessary abstraction for core text flow.

### Admin

- Default to Bits form controls for all major input types.
- Use `Dialog`/`AlertDialog` for destructive confirmations and metadata actions.
- Favor predictable keyboard and focus behavior over custom animated interactions.

---

## 6) Accessibility Requirements

Because Bits provides strong a11y primitives, do not regress semantics:

- Keep default ARIA wiring intact.
- Do not remove keyboard affordances (Esc close, tab loops, arrow navigation where applicable).
- Do not hide focus rings without equivalent visible focus treatment.
- Validate interactive states in both light and dark themes.

---

## 7) Do / Don’t

Do:

- Use Bits first.
- Wrap Bits into reusable local primitives for consistency.
- Bind component state into Svelte 5 runes cleanly.
- Style via tokens and class composition.

Don’t:

- Introduce a second component primitive library for overlapping components.
- Re-implement standard primitives (dialog/select/menu) without explicit justification.
- Break styleguide constraints (radius, borders, accent discipline).
- Add ad-hoc one-off control logic in route files when a reusable wrapper is appropriate.

---

## 8) Initial Adoption Checklist

- Install and keep `bits-ui` and `@internationalized/date` pinned in project dependencies.
- Create local wrapper primitives incrementally as features land.
- Validate each new Bits-based component against:
  - styleguide visual rules,
  - keyboard behavior,
  - light/dark token parity.

