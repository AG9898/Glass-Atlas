---
name: project-plan
description: "Use this skill when the user has a new feature idea, product change, integration question, refactor proposal, or wants to understand how a proposed change should fit into this repo. This skill runs a planning-first workflow: infer the minimum relevant docs, gather targeted context, ask at least one clarification question, draft a terminal-only documentation proposal, and after direction is accepted, produce workboard-compatible implementation tasks with dependencies and subtasks when needed."
version: 1.0.0
---

# Project Plan

Use this skill for proposal shaping, documentation planning, and implementation breakdown in Glass Atlas. Do not jump into implementation unless the user explicitly switches from planning to execution.

## Workflow

1. Infer the minimum relevant docs from the proposal. Use [references/doc-routing.md](references/doc-routing.md).
2. Gather context surgically:
   - Prefer headings, targeted searches, and specific sections over opening full docs.
   - Do not read unrelated docs just because they exist.
   - Do not read the full `docs/workboard.json` unless the user explicitly asks for task planning or board edits.
3. Restate the proposal in repo terms and identify likely affected surfaces.
4. Ask at least one clarification question before presenting any proposal. Ask more questions when scope, rollout, or behavior is ambiguous.
5. Draft a terminal-only documentation proposal. This proposal is for doc changes only, not code changes.
6. Revise the proposal with the user until the documentation direction is accepted.
7. Once documentation direction is accepted:
   - update the relevant docs if the user has asked for execution
   - then produce workboard-compatible implementation tasks using [references/workboard-format.md](references/workboard-format.md)

## Proposal Output

When drafting the documentation proposal in the terminal, keep it compact and use this structure:

- Title
- Why this change exists
- Docs to update
- Proposed changes by doc
- Open questions or assumptions
- Acceptance conditions

The proposal should describe how docs should change, not how implementation should be coded line by line.

## Clarification Rules

- Ask at least one real question tied to scope, UX, data shape, rollout, or constraints.
- Prefer concise questions with concrete tradeoffs.
- Ask additional questions when auth boundaries, schema impact, or streaming behavior might change.

## Task Breakdown Rules

After the documentation direction is accepted and applied, produce tasks that another agent can execute without making product decisions.

- Match the existing workboard shape and naming style.
- Split tasks by subsystem or responsibility, not by arbitrary file count.
- Keep each task focused on one primary behavioral outcome.
- Create subtasks only when they reduce ambiguity or enable parallel work.
- Use `depends_on` and `blocked_by` explicitly for ordering and blockers.
- Keep acceptance criteria behavioral and testable.
- Prefer tasks that map cleanly to one primary surface such as schema, server API, admin UI, public UI, or docs.
- Do not mutate `docs/workboard.json` unless the user explicitly asks to write tasks there.
- When writing tasks to the board, use targeted edits only; never rewrite the full file.

## Context Discipline

The context window is a shared budget. Keep this skill lean:

- Load only docs implied by the proposal.
- Use targeted reads before full reads.
- Keep the first output to a documentation proposal only.
- Defer task generation until documentation direction is settled.

## Constraints

- Treat this as a planning-first skill. It approximates plan mode, but it does not itself change the system collaboration mode.
- Do not implement code during the initial proposal phase.
- Do not assume legacy task fields from other repos (`type`, `summary`, `estimate`, `notes`) exist in this workboard.
