# 0005. Task descriptions apart from tasks

Status: accepted (2026-10-15). Amends [0004](0004-tasks.md): the `tasks` shape no longer carries the description. Builds on [0001](0001-electric-tanstack-db-sync.md).

## Context

A Project with 10–30k tasks loads every unarchived task into the browser. Each task carried its full markdown description, which a card or row never shows: it only reads the checklist progress from it. The description was most of each row's bytes and was parsed, validated and indexed for every row, and search lowercased all of it on every keystroke. Linear's sync engine keeps content like this out of the initial load for the same reason and fetches it when the issue is opened.

## Decision

**The description is its own table, `task_description`,** keyed by the task id, with `project_id` repeated from the task so the shape can be scoped by membership without a join. Every task has exactly one row, written in the same transaction as the task (create, duplicate, import, update) and removed with it (`ON DELETE CASCADE`).

**Checklist progress is two columns on the task,** `checklist_done` and `checklist_total`. The Procedures that write a description count the items with `checklistCounts` from `@morrow/sync-schemas`, the same function the web app tests, and write the counts in the same transaction. The migration backfills them with an equivalent regular expression.

**Sync.** The `tasks` shape drops `description` and gains the two counts. A new `task-descriptions` shape is read in `syncMode: "on-demand"`: the sheet's live query narrows it to one task id, so opening a task loads that one description. Nothing else reads the collection. It has no write handlers: the sheet's autosave writes with its own paced transaction, as before, and waits for the `txid` of `tasks.updateDescription`.

**Search covers the title and the ticket id,** which is all the browser has for the whole Project. Searching descriptions would need a server-side full-text search over `task_description`; that is a follow-up, not part of this change.

**Create** sends the description as metadata of the optimistic task insert; the server writes both rows and the counts. The card shows no progress until the counts sync back, which is the same moment its ticket number arrives.

## Consequences

- The tasks payload and the per-row cost drop; the list and board never touch descriptions.
- A second shape (nine in all) and a second collection. Only one description is loaded per open task.
- Export, import, duplicate, the MCP tools and the demo seed read and write the second table; `listTasks` and the export join it.
- The migration is two steps (`0016` adds the table and columns, copies and counts, publishes it to Electric; `0017` drops the old column) so Drizzle's snapshots stay correct. Existing deployments run both in order.
