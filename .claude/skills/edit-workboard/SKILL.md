---
name: edit-workboard
description: Create new workboard tasks and edit existing task fields (description, criteria, deps, priority, blocked state). Use append-to/remove-from for array fields, split-task to break heavy tasks apart. Never use for task selection or execution — those belong to /query-workboard and /start-task.
version: 1.0.0
---

# Edit Workboard

Use this skill to author, modify, and restructure tasks in `docs/workboard.json`.

**Not for:** selecting the next task, executing tasks, or transitioning `todo → in_progress → done` (those belong to `/query-workboard` and `/start-task`).

---

## Command Index

| Command | Operates on |
|---|---|
| `show <ID>` | Print full task JSON |
| `add-task` | Insert a new task |
| `edit-task <ID> <field> <value>` | Set a scalar field (`title`, `description`, `group_id`) |
| `reprioritize <ID> <level>` | Change `priority` |
| `append-to <ID> <field> <value>` | Add one item to an array field |
| `remove-from <ID> <field> <value>` | Remove one item from an array field by exact match |
| `set-array <ID> <field> <json-array>` | Replace an entire array field wholesale |
| `add-dep <ID> <dep-ID>` | Append to `depends_on` (validates dep-ID exists first) |
| `remove-dep <ID> <dep-ID>` | Remove from `depends_on` |
| `set-blocked <ID> <reason>` | Set `blocked_by` + `status = "blocked"` atomically |
| `unblock <ID>` | Clear `blocked_by`, set `status = "todo"` |
| `delete-task <ID>` | Remove a task (refused if `in_progress` or depended upon by another task) |
| `split-task <ID>` | Replace one task with two or more scoped subtasks |

**`status` is write-protected in this skill.** The only legal status writes are the atomic `set-blocked` and `unblock` operations below. Execution transitions belong to `/start-task`.

**`id` is immutable.** Renaming an ID silently breaks every `depends_on` reference to it — refuse if asked.

---

## Shared Write Protocol

Run after every command that writes to the board:

1. Apply the targeted patch using the template for that command — never rewrite the full file.
2. Update `last_updated` in the **same jq expression** as the patch. Never update it separately.
3. Validate shape:
   ```bash
   jq -e '.tasks and (.tasks | type == "array")' docs/workboard.json >/dev/null
   ```
4. Validate schema:
   ```bash
   npx --yes ajv-cli validate -s docs/workboard.schema.json -d docs/workboard.json
   ```
   > **Note on pre-existing violations:** If the board already contains a task with an invalid ID (e.g. a lowercase character like `ADMIN-01a`), step 4 will report failure even when your edit is clean. To isolate responsibility, re-run the shape check (step 3) against `/tmp/wb.json` — if it passes, your change is valid and the failure is pre-existing noise. Report both findings separately; do not revert a clean edit because of a pre-existing violation.
5. If either validation fails due to **your change**: the `/tmp/wb.json` backup (left by the `mv` pattern) is the last good state. Report the error and stop — do not attempt a second write to fix it.
6. Print a compact one-line summary of the changed task.

---

## Commands

### `show <ID>`

Read-only. Run this before any edit to verify the current state.

```bash
jq '.tasks[] | select(.id == "TASK-ID")' docs/workboard.json
```

---

### `add-task`

All 12 required fields must be present. New tasks always start as `todo`. Replace `YYYY-MM-DD` with today's date.

**Before writing:**
- Confirm the ID is not already taken:
  ```bash
  jq -e --arg id "NEW-ID" '.tasks[] | select(.id == $id)' docs/workboard.json >/dev/null && echo "ID taken"
  ```
- To find the next unused sequence number for a group:
  ```bash
  jq --arg g "GROUP_ID" '[.tasks[] | select(.group_id == $g) | .id] | sort | last' docs/workboard.json
  ```
- Confirm every `depends_on` ID exists in the board (use the existence check above for each one).

```bash
jq --argjson task '{
  "id": "GROUP_NNN",
  "title": "...",
  "description": "...",
  "status": "todo",
  "priority": "medium",
  "group_id": "GROUP",
  "depends_on": [],
  "blocked_by": [],
  "acceptance_criteria": ["..."],
  "docs": [],
  "files": [],
  "commands": []
}' \
'.tasks += [$task] | .last_updated = "YYYY-MM-DD"' \
docs/workboard.json > /tmp/wb.json && mv /tmp/wb.json docs/workboard.json
```

---

### `edit-task <ID> <field> <value>`

Scalar fields only: `title`, `description`, `group_id`.

```bash
jq --arg val "new value" \
'(.tasks[] | select(.id == "TASK-ID")).FIELD_NAME = $val | .last_updated = "YYYY-MM-DD"' \
docs/workboard.json > /tmp/wb.json && mv /tmp/wb.json docs/workboard.json
```

Replace `FIELD_NAME` literally with `title`, `description`, or `group_id`.

---

### `reprioritize <ID> <level>`

Level must be one of: `critical`, `high`, `medium`, `low`.

```bash
jq --arg level "high" \
'(.tasks[] | select(.id == "TASK-ID")).priority = $level | .last_updated = "YYYY-MM-DD"' \
docs/workboard.json > /tmp/wb.json && mv /tmp/wb.json docs/workboard.json
```

---

## Array Field Commands

Array fields are: `acceptance_criteria`, `docs`, `files`, `commands`.
(`depends_on` and `blocked_by` have dedicated commands below.)

Use `append-to` / `remove-from` for incremental changes. Use `set-array` only when replacing the whole array is intentional — always run `show <ID>` first so the current value is visible in context.

### `append-to <ID> <field> <value>`

```bash
jq --arg val "new item" \
'(.tasks[] | select(.id == "TASK-ID")).FIELD_NAME += [$val] | .last_updated = "YYYY-MM-DD"' \
docs/workboard.json > /tmp/wb.json && mv /tmp/wb.json docs/workboard.json
```

---

### `remove-from <ID> <field> <value>`

Removes by exact string match. If the string is not present, the board is unchanged (no error).

```bash
jq --arg val "item to remove" \
'(.tasks[] | select(.id == "TASK-ID")).FIELD_NAME -= [$val] | .last_updated = "YYYY-MM-DD"' \
docs/workboard.json > /tmp/wb.json && mv /tmp/wb.json docs/workboard.json
```

---

### `set-array <ID> <field> <json-array>`

Replaces the entire array. Run `show <ID>` first — the current array must be visible in context before this write executes.

```bash
jq --argjson arr '["item 1", "item 2"]' \
'(.tasks[] | select(.id == "TASK-ID")).FIELD_NAME = $arr | .last_updated = "YYYY-MM-DD"' \
docs/workboard.json > /tmp/wb.json && mv /tmp/wb.json docs/workboard.json
```

---

## Dependency Commands

### `add-dep <ID> <dep-ID>`

Verify the dependency exists before appending:

```bash
jq -e --arg id "DEP-ID" '.tasks[] | select(.id == $id)' docs/workboard.json >/dev/null
```

Then append:

```bash
jq --arg dep "DEP-ID" \
'(.tasks[] | select(.id == "TASK-ID")).depends_on += [$dep] | .last_updated = "YYYY-MM-DD"' \
docs/workboard.json > /tmp/wb.json && mv /tmp/wb.json docs/workboard.json
```

---

### `remove-dep <ID> <dep-ID>`

```bash
jq --arg dep "DEP-ID" \
'(.tasks[] | select(.id == "TASK-ID")).depends_on -= [$dep] | .last_updated = "YYYY-MM-DD"' \
docs/workboard.json > /tmp/wb.json && mv /tmp/wb.json docs/workboard.json
```

---

## Status Commands

### `set-blocked <ID> <reason>`

Reason must be a non-empty string. Sets both `status` and `blocked_by` atomically.

```bash
jq --arg reason "reason text" \
'(.tasks[] | select(.id == "TASK-ID")) |= . + {"status": "blocked", "blocked_by": [$reason]} | .last_updated = "YYYY-MM-DD"' \
docs/workboard.json > /tmp/wb.json && mv /tmp/wb.json docs/workboard.json
```

To append a second reason to an already-blocked task without clearing the first:

```bash
jq --arg reason "additional reason" \
'(.tasks[] | select(.id == "TASK-ID")).blocked_by += [$reason] | .last_updated = "YYYY-MM-DD"' \
docs/workboard.json > /tmp/wb.json && mv /tmp/wb.json docs/workboard.json
```

---

### `unblock <ID>`

```bash
jq '(.tasks[] | select(.id == "TASK-ID")) |= . + {"status": "todo", "blocked_by": []} | .last_updated = "YYYY-MM-DD"' \
docs/workboard.json > /tmp/wb.json && mv /tmp/wb.json docs/workboard.json
```

---

### `delete-task <ID>`

Removes a task from the board permanently. Only valid when `status` is `todo`, `blocked`, or `done`.

**Before writing:**

Check the task is not `in_progress`:
```bash
jq -e --arg id "TASK-ID" '.tasks[] | select(.id == $id and .status == "in_progress")' docs/workboard.json >/dev/null && echo "REFUSED: task is in_progress"
```

Check no other task depends on it (print any dependents — if the list is non-empty, resolve those `depends_on` entries first):
```bash
jq --arg id "TASK-ID" '[.tasks[] | select(.depends_on | contains([$id])) | .id]' docs/workboard.json
```

Then delete:
```bash
jq --arg id "TASK-ID" \
'.tasks |= map(select(.id != $id)) | .last_updated = "YYYY-MM-DD"' \
docs/workboard.json > /tmp/wb.json && mv /tmp/wb.json docs/workboard.json
```

---

## `split-task <ID>`

Replaces one task with two or more scoped subtasks. Only valid when source task is `todo` or `blocked`.

This is a multi-step, destructive operation. **Stop after Step 3 and wait for explicit user confirmation before writing anything.**

---

**Step 1 — Read the original task in full:**

```bash
jq '.tasks[] | select(.id == "ORIG-ID")' docs/workboard.json
```

---

**Step 2 — Find downstream dependents (tasks that will need their `depends_on` patched):**

```bash
jq --arg orig "ORIG-ID" '[.tasks[] | select(.depends_on | contains([$orig])) | .id]' docs/workboard.json
```

---

**Step 3 — Present the proposed split and wait for confirmation.**

Show the user:
- The new task objects: IDs, titles, descriptions, acceptance criteria for each piece
- Which split task is the "terminal" task (the last deliverable — downstream dependents will point here)
- The list of downstream task IDs that will have their `depends_on` updated

**Do not write until the user confirms.** If running autonomously without an interactive user, state your self-confirmation explicitly in output before proceeding — do not silently skip this step.

---

**Step 4 — Execute (after confirmation).**

**ID naming rule:** Split task IDs MUST use an underscore + digit suffix: `ORIG-ID_1`, `ORIG-ID_2`, etc. Never use letter suffixes (`ORIG-ID_A`, `ORIG-ID_a`, `ORIG-ID-a`) — lowercase letters violate the schema pattern `^[A-Z][A-Z0-9_-]*$` and uppercase letters are ambiguous. The `_N` form is the only valid convention.

First split inherits the original's `depends_on`. Each subsequent split depends on the one before it. All splits inherit `group_id` and `priority` from the original unless the user overrides.

Run as a single atomic jq expression:

```bash
jq \
  --arg orig "ORIG-ID" \
  --arg last "ORIG-ID_2" \
  --argjson splits '[
    {
      "id": "ORIG-ID_1",
      "title": "...",
      "description": "...",
      "status": "todo",
      "priority": "...",
      "group_id": "...",
      "depends_on": [...original depends_on here...],
      "blocked_by": [],
      "acceptance_criteria": ["..."],
      "docs": [],
      "files": [],
      "commands": []
    },
    {
      "id": "ORIG-ID_2",
      "title": "...",
      "description": "...",
      "status": "todo",
      "priority": "...",
      "group_id": "...",
      "depends_on": ["ORIG-ID_1"],
      "blocked_by": [],
      "acceptance_criteria": ["..."],
      "docs": [],
      "files": [],
      "commands": []
    }
  ]' \
'.last_updated = "YYYY-MM-DD" |
 .tasks = (
   [ .tasks[] |
     select(.id != $orig) |
     if (.depends_on | contains([$orig]))
     then .depends_on = (.depends_on | map(if . == $orig then $last else . end))
     else . end
   ] + $splits
 )' \
docs/workboard.json > /tmp/wb.json && mv /tmp/wb.json docs/workboard.json
```

---

**Step 5 — Validate** using the shared write protocol (steps 3–4).

**Step 6 — Report:** new task IDs created, downstream `depends_on` updates applied, original task ID removed.

---

## Guardrails

- Never rewrite the full file. Every patch targets only the affected task or a specific structural change.
- Never edit `status` via `edit-task`. Use `set-blocked`, `unblock`, or `/start-task`.
- Never rename an `id`. Breaking `depends_on` chains is silent and hard to recover.
- Warn before writing to an `in_progress` task — it may be mid-execution.
- `add-task` refuses `status != "todo"`. New tasks always enter as `todo`.
- `split-task` refuses source tasks with `status == "in_progress"` or `status == "done"`.
- `split-task` requires at least 2 output tasks. Splitting into 1 is just an edit.
- `split-task` IDs MUST use `_N` suffix (`ORIG-ID_1`, `ORIG-ID_2`). Letter suffixes are never valid.
- `delete-task` refuses `status == "in_progress"` and refuses if any other task lists it in `depends_on`.
- `set-blocked` refuses an empty reason string.
