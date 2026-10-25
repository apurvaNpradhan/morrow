# Task dates, time zones and recurrence

Status: ready-for-agent

Tickets: not filed yet; the Morrow MCP failed (`list_tasks` returns nothing with a `projectId` and `Internal error` without). Implementation issues are in `issues/`. Decision record: `docs/adr/0012-task-dates-and-recurrence.md`.

## Problem Statement

A Task has only a due date, and it is a calendar day with no time. You cannot say when work starts, so a later calendar or timeline has nothing to draw a bar from. You cannot say "due Friday at 15:00". Work that comes back every week has to be recreated by hand. The app has no idea of the user's time zone: "today" is whatever the browser thinks, which breaks once anything runs on the server, for example the reminders planned for later.

## Solution

- **Both dates are moments or days.** A Task gets an optional start date, and the due date becomes the same kind of value. Each date is either a calendar day ("Friday") or a moment ("Friday 15:00").
- **A time zone per user.** By default it follows the browser. In preferences the user can pin a zone. That zone decides "today", overdue, quick picks, how times read, and the zone a new repeat rule is written in.
- **Recurrence.** A Task with a due date can repeat by an RFC 5545 rule. When it enters a `done` Column, the next occurrence is created as a new Task in the same transaction, with its dates moved forward, and the rule moves to it.
- **Reminders are not part of this.** The data model is ready for them (see the ADR).

## User Stories

### Time zone

1. As a user, I want Morrow to use my browser's time zone until I choose one, so that nothing needs setting up.
2. As a user, I want to pick a time zone in preferences, so that dates read correctly on a machine set to another zone.
3. As a user, I want to go back to "follow this browser", so that travelling updates my zone on its own.
4. As a user, I want my time zone kept private from other Members.

### Due and start dates

5. As a Member, I want to give a due date a time, so that "Friday 15:00" means 15:00.
6. As a Member, I want a due date without a time to stay a whole day, read as the same day by everyone, wherever they are.
7. As a Member, I want to set and clear a start date, with or without a time, from the sheet, the properties rail, the create dialog, the context menu, the field picker hotkey menu and the bulk selection bar, the same places as the due date.
8. As a Member, I want a start date after the due date refused, so that a Task's span is never backwards; the picker greys out days that are not allowed.
9. As a Member, I want moving the due date before the start to clear the start, with a toast that says so, so that I am never stuck.
10. As a Member, I want a card to show one chip `Oct 20 → Oct 24` (times when set), or just the due date when there is no start.
11. As a Member, I want to filter by start date (past, today, this week, next week, no value, started) and sort by it.
12. As a Member, I want the quick picks and typed dates (`fri`, `in 3 days`) in the start-date menu too, and to type times: `fri 3pm`, `tomorrow 09:00`, `15:30`.
13. As a Member, I want start-date and due-date changes in the Task history, with the time when there is one.
14. As an agent, I want MCP to read and set both dates as `YYYY-MM-DD` (a day) or ISO 8601 with an offset (a moment).

### Recurrence

15. As a Member, I want to make a Task with a due date repeat: daily, weekdays, weekly on chosen days, every N days, weeks, months or years, monthly on day N or on "the 2nd Tuesday", yearly.
16. As a Member, I want a series to end never, on a date, or after N occurrences.
17. As a Member, I want closing a repeating Task in a `done` Column to create the next one straight away, in the first `unstarted` Column at the top, with its due date on the next occurrence and the start date kept the same distance before it.
18. As a Member, I want a Task I finish late to skip occurrences already past, so that a backlog of copies never piles up.
19. As a Member, I want the next Task to keep the title, description, priority, assignee, labels and field values, and every subtask recreated as open, so that a checklist starts fresh.
20. As a Member, I want comments, attachments and relations left on the old Task, because they belong to that occurrence.
21. As a Member, I want both Tasks' history to link to each other, so that I can walk the series.
22. As a Member, I want canceling, archiving or deleting the open occurrence, or removing its rule, to end the series.
23. As a Member, I want moving the due date of a repeating Task to move the series, so that the rule and the date never disagree.
24. As a Member, I want clearing the due date of a repeating Task to ask first and then stop the series.
25. As a Member, I want a repeat icon on the card and a plain summary ("every week on Monday") in the sheet.
26. As a Member, I want "every Monday at 09:00" to stay 09:00 across daylight-saving changes, in the zone the rule was set in.
27. As an agent, I want MCP to set and clear a rule as an RFC 5545 string, with the same checks as the web app.

## Implementation Decisions

### Time zone (account Vertical)

- `user.time_zone`, a nullable IANA name, is a Better Auth `additionalFields` entry beside `locale`: `input: true`, read from the session, set through update-user. It is not added to the `users` shape.
- Validation: a value `Intl.DateTimeFormat` accepts as a `timeZone`; anything else is refused. Null means "follow the browser".
- Web: `useTimeZone()` returns the setting or `Intl.DateTimeFormat().resolvedOptions().timeZone`. Every place that computes "today", overdue, quick picks, filter weeks or displays a time reads it. The `today` the date helpers already take is computed in this zone.
- Preferences page: a `TimeZoneRow` beside `LanguageRow`, a searchable select of `Intl.supportedValuesOf("timeZone")` with "Follow this browser (Asia/Kolkata)" first.
- The account export includes it.

### Date model (tasks Vertical, sync-schemas)

- Columns: `due_at timestamp` + `due_has_time boolean not null default false`, and `start_at timestamp` + `start_has_time boolean not null default false`. `timestamp` without time zone, UTC, like every Morrow table.
- **A day** (`has_time` false) is stored as 00:00 UTC of that day and read as a floating calendar day, never converted to a zone. **A moment** (`has_time` true) is a UTC instant shown in the reader's zone.
- `CHECK (has_time = false OR at IS NOT NULL)` for both, and `CHECK (start_at IS NULL OR due_at IS NULL OR start_at <= due_at)`. Comparing a day with a moment uses the day's 00:00 UTC. That is good enough for "start not after due" and keeps the check in SQL. The Procedure refuses first with a typed error, `START_AFTER_DUE`.
- One shared module in `@morrow/sync-schemas` (`task-dates.ts`): `TaskDate = { at: Date; hasTime: boolean }`, `parseTaskDate(text)`, `formatTaskDate(at, hasTime)` (the text form), `taskDateDay(at, hasTime, zone)`, `momentInZone(day, time, zone)` and `timeInZone(at, zone)`. `DUE_DATE_PATTERN` and `isCalendarDate` stay for day input. Custom date Fields stay `YYYY-MM-DD` strings and are unchanged.
- The migration (against the existing database, nothing dropped by hand): add the new columns, `due_at = due_date::timestamp` with `due_has_time = false`, drop `due_date`, and add the new columns to the `tasks` shape's column schema (bump the shape schema version so persisted browser databases rebuild). `task_event` payloads of type `due_date` already hold `YYYY-MM-DD`, which is how a day is written now, so they stay as they are.
- Writes are field-group Procedures as in ADR 0004: `tasks.updateDueDate({ taskId, dueDate: string | null })` keeps its name and takes the text form; `tasks.updateStartDate` is its twin. Both run in `withTxid` under `lockProject`. Create, duplicate and bulk update accept both dates.
- Inputs accept `YYYY-MM-DD` (a day) or ISO 8601 with an offset (a moment) and normalise to `TaskDate`, so API, MCP and import share one parser, `parseTaskDate`.
- History: `due_date` and new `start_date` events are `{ from: string | null, to: string | null }` in the text form (`YYYY-MM-DD` or ISO UTC), folded within 10 minutes like other fields.
- Import and export: dates are written as `YYYY-MM-DD` for a day and ISO with `Z` for a moment. Import also accepts the old export files, whose `dueDate` is a bare day.
- MCP: `create_tasks`, `update_tasks` and `list_tasks` take and return `dueDate` and `startDate` in the input format; `null` clears.

### Date UI (tasks Vertical, web)

- One `TaskDateMenu` serves both dates: quick picks, the typed query, a calendar and an optional time input. The start menu greys out days after the due date. The due menu does not grey out days before the start; choosing one clears the start with a toast.
- `parseDateQuery(query, today)` becomes `parseDateQuery(query, today) → { day, time? } | null`, learning `3pm`, `3:30pm`, `15:30`, `noon` alone (today, or tomorrow if already past) or after any date it already reads. Its table test grows; the existing cases stay.
- Card and list row: `TaskDatesChip` shows `start → due`, or due alone, or start alone with a leading "Starts". Overdue colouring compares in the user's zone: a day is overdue after the day ends, a moment after the moment.
- Filters: a `startDate` subject with `past`, `today`, `thisWeek`, `nextWeek`, `started` and `none`. The due-date subject gains `today`. Sort gains `startDate`, nulls last. A device toggle `showTaskStartDate` sits beside the existing card toggles.

### Recurrence (tasks Vertical, sync-schemas)

- `task.recurrence text`, nullable, synced in the `tasks` shape. The value is a full RFC 5545 string: `DTSTART;TZID=<zone>:YYYYMMDDTHHMMSS\nRRULE:…` when the due date has a time, `DTSTART;VALUE=DATE:YYYYMMDD\nRRULE:…` when it is a day.
- Parsed with `rrule` (jkbrzt/rrule) in `@morrow/sync-schemas`, so the API and the web app share one module:
  - `parseRecurrence(text)` returns the rule or a reason. It accepts only `FREQ` (DAILY, WEEKLY, MONTHLY, YEARLY), `INTERVAL` (1–99), `BYDAY` (with an ordinal only under MONTHLY), `BYMONTHDAY`, `BYMONTH`, `UNTIL` and `COUNT` (1–999), never `UNTIL` and `COUNT` together, and a `DTSTART` equal to the Task's due date.
  - `nextOccurrence(rule, after, today)` returns the first occurrence strictly after `after`; if that is before `today`, the first on or after `today`; null when the series has ended.
  - `rebaseRecurrence(rule, newDue)` rewrites `DTSTART` and lowers `COUNT` by the occurrences before `newDue`.
  - `describeRecurrence(rule)` wraps `toText()`. English only; the one place to switch to i18n keys when a second locale exists.
- Rules: a rule needs a due date (`RECURRENCE_NEEDS_DUE_DATE`) and is refused on a subtask (`SUBTASK_CANNOT_REPEAT`) and on a Task with a parent being set (`setParent` refuses a repeating Task the same way). The zone in `TZID` is the setter's time-zone setting, or the browser's when none is set, sent by the client and validated like `user.time_zone`; it never changes when someone else edits the Task.
- Procedure `tasks.updateRecurrence({ taskId, recurrence: string | null })` in `withTxid` under `lockProject`, needing `task: update`. MCP `update_tasks` takes `recurrence` with the same validation.
- **The due date drives the rule.** `setDueDate` on a repeating Task calls `rebaseRecurrence` in the same write; switching between a day and a moment switches `DTSTART` between `VALUE=DATE` and `TZID`. Clearing the due date clears the rule in the same write and records both events; the web app confirms first.
- **Spawning.** `spawnNextOccurrence(tx, task, now)` runs wherever `completedAt` goes from null to set and the new Column is `done`, inside the same transaction: single moves, bulk updates, Column delete, Column category change and moves to another Project (the `nextCompletedAt` call sites). It:
  1. computes the next due date with `nextOccurrence`; if null, the series ends and nothing is created;
  2. creates the next Task (new number, new id) in the Project's first `unstarted` Column at the top, with the title, description, priority, assignee (if still a Member), labels, field values, rule (rebased onto the new due date) and the start date moved by the same distance;
  3. recreates every direct subtask, and their subtasks, as open Tasks in the first `unstarted` Column, with the same copied fields and no dates;
  4. clears the rule on the completed Task;
  5. records `recurred` on both Tasks (`{ direction: "from" | "to", ticketId }`) and `task.created` activity for the new Task.
- **Ending a series.** Entering a `canceled` Column, archiving, deleting or `updateRecurrence(null)` leaves no Task with the rule, so the series ends; there is no series table. Reopening an old Task does nothing. Duplicating a Task drops the rule. Import keeps the rule from the file and never spawns.
- History: a `recurrence` event `{ from: string | null, to: string | null }` with the rule text, rendered with `describeRecurrence`; `recurred` as above.

### Recurrence UI (tasks Vertical, web)

- A `RecurrenceMenu` in the sheet, the properties rail and the context menu, disabled with a hint when there is no due date or the Task is a subtask. Presets as in User Stories 15–16, built with `rrule`'s options, never by hand-writing strings.
- A repeat icon on cards and list rows, next to the date chip, with the summary as its tooltip. The sheet shows the summary and the next date.

### Docs

- `docs/adr/0012-task-dates-and-recurrence.md`, revising ADR 0004 on the due-date type and its "Not now" list.
- `CONTEXT.md` gains **Start date**, **Recurrence**, **Occurrence** and **Time zone** terms.

## Testing Decisions

A good test checks what a caller can see: what a Procedure returns or refuses, the rows a Member can read afterwards, what a page shows. Prior art: the tasks, task-history, bulk-actions and move-tasks integration tests, `parse-date-query.test.ts`, `filters.test.ts`, `sort.test.ts`.

### API integration

- Time zone: a valid zone is saved and returned on the session; an invalid one is refused; `null` clears it; another Member never sees it in the `users` shape.
- Dates: a day and a moment round-trip through `updateDueDate` and `updateStartDate`; start after due is refused with `START_AFTER_DUE`, also on create, duplicate and bulk update; the migration turns existing due dates into days and old `due_date` history payloads still read (a migration test seeded with the old shape).
- Recurrence validation: every allowed part is accepted; `BYHOUR`, `BYSETPOS`, `UNTIL` with `COUNT`, a `DTSTART` that is not the due date, a rule without a due date and a rule on a subtask are refused with typed errors.
- Spawning, for each `nextCompletedAt` path (move, bulk update, Column delete, Column category change, move to another Project): exactly one next Task, in the first `unstarted` Column at the top, with the copied fields, recreated open subtasks, the rule only on the new Task, the start gap kept, and `recurred` on both.
- Next date: weekly, monthly on day 31 (short months), "2nd Tuesday", yearly on Feb 29, a late completion that skips past occurrences, `COUNT` exhausted and `UNTIL` passed (no new Task), and a `TZID` rule across a DST change keeping its wall-clock time.
- Ending: cancel, archive, delete and clearing the rule create nothing; reopening the old Task creates nothing; duplicating drops the rule; import never spawns.
- Due date edits: moving the due date rebases `DTSTART` and `COUNT`; clearing it clears the rule with both events.
- The `txid` equals the row's `xmin` for every new Procedure.

### Unit tests

- `parseRecurrence`, `nextOccurrence`, `rebaseRecurrence` in sync-schemas, table-driven.
- `parseTaskDate` and the `TaskDate` helpers, including a day read in zones on both sides of UTC.
- `parseDateQuery` with times.
- Filters and sort on start dates and day/moment due dates in a fixed zone.

### End-to-end (Playwright)

- Pick a time zone in preferences; a moment due date reads in it.
- Set a start and a due date with a time from the sheet; the card shows the range.
- Make a Task repeat weekly, drag it to Done; the next Task appears with the next date and the repeat icon, and its history links back.

## Out of Scope

Reminders and notifications (planned; see the ADR), a My tasks page and the Project calendar (issues 04 and 05, backlog), timeline/Gantt, time tracking, an iCal feed, "repeat after completion" rules, arbitrary RRULE parts, recurring subtasks, i18n of the rule summary, workspace-level default time zones.

## Further Notes

- Grilled 2026-10-24.
- Kaneo reference: `repos/kaneo/apps/api/src/scheduler/due-date-reminders.ts`, `reminder-timing.ts`, `utils/validate-dates.ts`. Kaneo has no recurrence.

## As built

Where the build differs from the text above:

- **Names.** The Procedures are `tasks.updateDueDate`, `updateStartDate` and `updateRecurrence` (the existing `updateX` naming); each takes the text form (`YYYY-MM-DD`, ISO 8601, or the RFC 5545 string).
- **Due before start.** The server does it: `updateDueDate` and the bulk due-date change clear a start that would come after the new due date and record a `start_date` entry; the web app only tells the user (a toast). `START_AFTER_DUE` is for setting a start after the due date (set, create, bulk, import). A duplicate copies a valid span, so it cannot fail.
- **Ending a series** also happens when a Task enters a `canceled` Column by any path (move, bulk move, Column delete or category change, move to another Project, "duplicate" relation) and when it is archived, singly or in bulk. The rule is cleared and a `recurrence` entry written.
- **Spawning** skips archived subtasks. "Today" for the skip is in the rule's `TZID`, else the completing user's chosen zone, else UTC. A rule on days that gets a time is written in the editor's chosen zone, else UTC.
- **Monthly on day 31** follows RFC 5545: months without a 31st are skipped. "Last day" is `BYMONTHDAY=-1`.
- **Import** drops a repeat rule that does not fit the task's due date and says so (`recurrence_dropped`).
- **History** stores dates as text, so old `due_date` payloads needed no rewrite (see the ADR).
