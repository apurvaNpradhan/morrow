# 0012. Task dates and recurrence

Status: accepted (2026-10-24). Revises [0004](0004-tasks.md): the due date is no longer a `date`, and start dates and recurrence leave its "Not now" list. Spec: `.scratch/task-dates-recurrence/spec.md`.

## Context

ADR 0004 made the due date a calendar day so it never passed through `Date`. A calendar or timeline needs times, a start, and a Task that repeats. Reminders, planned for later, need to turn "due Friday" into a moment for a given person, so the app needs each user's time zone.

Kaneo has `start_date` and `due_date` as `timestamp` with no zone and refuses a start after the due date. Its reminders are a croner job every 5 minutes that looks for tasks whose `due_date + 24h − lead time` falls in a 10-minute window, a `task_reminder_sent(task_id, reminder_type)` row to claim each send, and a delete of that row after a due-date edit, run after the commit, so a crash loses it. A day is approximated as 24 hours, which its own comment says breaks on DST days. Only the assignee is reminded, with one lead time per user. Kaneo has no recurrence.

## Decision

**Each date is a day or a moment.** `start_at` and `due_at` are `timestamp` (UTC), each with a `has_time` flag. A day is 00:00 UTC of that day and is read as a floating calendar day, the same for every reader; a moment is an instant shown in the reader's zone. One column per date keeps sort, filter and later timeline reads to one value; the flag keeps a real 00:00 UTC moment (05:30 in Kolkata) from reading as a whole day. A check refuses a start after the due date, comparing a day by its 00:00 UTC.

**Time zone per user.** `user.time_zone` is an IANA name, null meaning "follow the browser", a Better Auth additional field read from the session and kept out of the `users` shape. It decides "today", overdue, quick picks, how times read, and the zone of a new rule.

**Recurrence makes a new Task per occurrence, on completion.** A rule is an RFC 5545 string (`DTSTART` plus one `RRULE`) in `task.recurrence`, parsed with `rrule` in `@morrow/sync-schemas` and limited to `FREQ`, `INTERVAL`, `BYDAY`, `BYMONTHDAY`, `BYMONTH`, `UNTIL` and `COUNT`. A timed rule carries `TZID` from the setter's zone, so its wall-clock time survives DST; a day rule uses `VALUE=DATE`. `DTSTART` is the due date; moving the due date rebases the rule. When a Task enters a `done` Column, the same transaction creates the next Task at the rule's next occurrence after the old due date (skipping to today if already past), copies its fields and recreates its subtasks as open, and moves the rule to it. The rule lives only on the newest open occurrence, so canceling, archiving, deleting or clearing it ends the series without a series table. Subtasks cannot repeat.

The alternatives were one Task that rolls its dates forward (one ticket id, but one history mixing every occurrence and a `completedAt` that means nothing) and occurrences created on a schedule (needs a job, and missed ones pile up). A typed rule object was considered; the RFC string won because it exports to iCal as it is and `rrule` already does the date arithmetic.

**Reminders, when they come.** Not built here. The intended shape: a `task_reminder` row per recipient and kind holding a computed `fire_at`, written or deleted in the same transaction as any date, assignee, column or preference change, so no reset is lost; a one-minute pg-boss cron (`platform/jobs/crons.ts`) sends rows whose `fire_at` has passed and marks them sent; `fire_at` for a day due date is the end of that day in the recipient's time zone, so DST is handled. A repeating Task's next occurrence gets its own rows when it is created.

## Consequences

- Every due-date reader changes from a `YYYY-MM-DD` string to a `{ at, hasTime }` value; custom date Fields keep their strings.
- The migration rewrites `due_date` history payloads, so history has one reader.
- Completing a repeating Task writes two Tasks and their subtasks in one transaction, under the Project lock that every task write already holds.
- The rule summary is English (`rrule`'s `toText()`) until a second locale exists.
