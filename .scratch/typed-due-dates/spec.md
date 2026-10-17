# Typed due dates

Status: ready-for-agent

## Problem Statement

The due-date menu offers quick picks (today, tomorrow, weekend, next week; `due-date-picks.ts`) and a calendar, but you cannot type "fri" or "in 3 days".

## Solution

A pure English parser turns a typed query into a date. The due-date menu shows the parsed date as its first option, and Enter applies it.

## User Stories

1. As a Member, I want to type `fri` and press Enter to set the due date to the coming Friday.
2. As a Member, I want `in 3 days`, `in 2 weeks`, `in 1 month`.
3. As a Member, I want `today`, `tomorrow`, `yesterday`.
4. As a Member, I want `2026-11-03`, `nov 3` and `3 nov`.
5. As a Member, I want to see the date a query resolves to before applying it.
6. As a Member, I want an unparseable query to keep the quick picks and calendar, with no error.

## Implementation Decisions

- `apps/web/src/tasks/lib/parse-date-query.ts`, with its test beside it. Signature: `parseDateQuery(query, today) → Date | null`.
- English only, case-insensitive.
- **Weekdays:** full and three-letter names; `next <weekday>` adds a week.
  - A weekday resolves to its next occurrence. Today's weekday means a week from today; the bare weekday never means today.
- **Relative:** `in N day(s)/week(s)/month(s)`; month arithmetic clamps to the month's end.
- **Absolute:** `YYYY-MM-DD`, and `mon D` / `D mon` with three-letter or full month names. A month-day already past this year rolls to next year.
- Uses the existing `calendar-day.ts` helpers, local dates only.
- The menu shows the result with the same formatting as `due-date-chip-text.tsx`.

## Testing Decisions

- A table-driven unit test against a fixed `today`, including month-end clamping, rollover and rejects (`foo`, `in -1 days`, `feb 30`).
- A component test: type `fri`, press Enter, and the task gets the expected date.

## Out of Scope

- Other languages, times of day, start dates and ranges (Kaneo b5fb8da9 applies only once there are start dates).

## Further Notes

- Grilled 2026-10-17 (Q22). Kaneo reference: `common/date-picker/parse-date-query.ts` (8cceae17).
