# Start dates

Status: ready-for-agent

Blocked by: 01

Spec: `../spec.md` (sections "Date model", "Date UI"). ADR 0012.

## What to build

- `start_at` + `start_has_time`, the `start_at <= due_at` check, `tasks.setStartDate`, `START_AFTER_DUE`.
- Start date on create, duplicate, bulk update, import, export, MCP and history (`start_date` event).
- `TaskDateMenu` shared by both dates (start greys out days after the due; an earlier due clears the start with a toast), `TaskDatesChip`, the `startDate` filter subject and sort, the `showTaskStartDate` card toggle, and the start date in every place the due date is set.

## Required tests

- Start after due refused on set, create, duplicate and bulk update; clearing either date works.
- History records `start_date` and folds within 10 minutes.
- Filters (`past`, `today`, `thisWeek`, `nextWeek`, `started`, `none`) and sort, nulls last.
- E2E: set a start and a due with a time from the sheet; the card shows the range.
