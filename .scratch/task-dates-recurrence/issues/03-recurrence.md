# Recurrence

Status: ready-for-agent

Blocked by: 01

Spec: `../spec.md` (sections "Recurrence", "Recurrence UI"). ADR 0012.

## What to build

- `task.recurrence text` in the `tasks` shape; `rrule` in sync-schemas with `parseRecurrence`, `nextOccurrence`, `rebaseRecurrence` and `describeRecurrence`.
- `tasks.setRecurrence`; the due date rebases or clears the rule; subtasks and `setParent` refuse repeating Tasks.
- `spawnNextOccurrence` at every `nextCompletedAt` call site that completes into `done`; `recurrence` and `recurred` history events; duplicate drops the rule; import keeps it and never spawns.
- `RecurrenceMenu`, the repeat icon with the summary tooltip, and the next date in the sheet; MCP `update_tasks` `recurrence`.

## Required tests

- Every case under "Recurrence validation", "Spawning", "Next date", "Ending" and "Due date edits" in the spec's Testing Decisions.
- `parseRecurrence`, `nextOccurrence` and `rebaseRecurrence` table tests, including DST with `TZID`.
- E2E: make a Task repeat weekly, drag it to Done, see the next Task with the repeat icon and the linked history.
