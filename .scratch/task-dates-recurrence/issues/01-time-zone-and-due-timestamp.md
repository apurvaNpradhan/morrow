# Time zone setting and the due date as a day or a moment

Status: ready-for-agent

Spec: `../spec.md` (sections "Time zone", "Date model", "Date UI"; due date only). ADR 0012.

## What to build

- `user.time_zone` (Better Auth additional field beside `locale`), `useTimeZone()`, and a `TimeZoneRow` in preferences.
- The migration: `due_at` + `due_has_time`, existing due dates become days, `due_date` dropped, `due_date` history payloads rewritten, the `tasks` shape schema version bumped.
- `TaskDate` and its helpers and `parseTaskDateInput` in sync-schemas; `tasks.setDueDate` taking a `TaskDate`; create, duplicate, bulk update, import, export, account export and MCP on the new format, with old export files still importing.
- The due-date menu with an optional time; `parseDateQuery` reading times; card, list, filters, sort and overdue reading in the user's zone; the due-date filter gains `today`.

## Required tests

- Time zone saved, cleared and refused when invalid; absent from the `users` shape.
- Migration test: old due dates become days; old history payloads read in the new format.
- A day and a moment round-trip through `setDueDate`, create, duplicate, bulk update, import, export and MCP.
- `parseDateQuery` table test with times; `TaskDate` helpers in zones east and west of UTC; filters and sort in a fixed zone.
- E2E: pick a zone, set a due date with a time, see it read in that zone.
