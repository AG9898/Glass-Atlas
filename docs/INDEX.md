# Docs Index — Glass Atlas

Navigation map for everything in `docs/`. Every doc is listed here with its purpose.
Keep this file current: add, remove, or rename a row in the same commit as the doc change.

---

## Core Docs

| File | Purpose |
|---|---|
| [PRD.md](PRD.md) | Product requirements, feature scope, target users, and success criteria |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System topology, runtime boundaries, component responsibilities, and data flow |
| [CONVENTIONS.md](CONVENTIONS.md) | Coding standards, naming rules, and idiomatic SvelteKit/Svelte 5 patterns |
| [DECISIONS.md](DECISIONS.md) | Architectural decision log — open questions and resolved decisions |
| [ENV_VARS.md](ENV_VARS.md) | Environment variable and secret matrix — names, required/optional, and where used |
| [TESTING.md](TESTING.md) | Test strategy, Vitest configuration, how to run tests, patterns for writing new tests |

## Workboard

| File | Purpose |
|---|---|
| [workboard.json](workboard.json) | Canonical task queue — the active board agents read and update |
| [workboard.schema.json](workboard.schema.json) | JSON Schema contract that validates `workboard.json` structure |
| [workboard.md](workboard.md) | Workboard semantics, field definitions, status lifecycle, and agent usage rules |

---

## Maintenance Rules

- **Adding a doc:** add its row to the correct section in this file in the same commit.
- **Removing a doc:** remove its row here and update every doc that linked to it in the same commit.
- **Renaming or moving a doc:** update its row here and fix all inbound links in the same commit.
- **`CLAUDE.md` (root)** and any section README files must be updated in the same commit when the docs they reference change.
- Never add a root-level stub doc that only redirects to a path inside `docs/`.

---

## Planned Docs (not yet created)

These docs are expected as the project grows. Add their rows above when the files are created.

| File | Anticipated purpose |
|---|---|
| `SCHEMA.md` | Database schema reference — tables, columns, indexes, and Drizzle model definitions |
| `API.md` | Internal API surface — SvelteKit route contracts, request/response shapes |
| `STYLE_GUIDE.md` | Visual design tokens, component conventions, and Tailwind usage patterns |
