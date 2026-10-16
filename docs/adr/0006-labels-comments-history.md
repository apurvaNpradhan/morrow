# 0006. Labels, comments and task history

Status: accepted (2026-10-16). Builds on [0001](0001-electric-tanstack-db-sync.md) and [0004](0004-tasks.md), and follows [0005](0005-task-descriptions-apart.md) in keeping bulky content out of the `tasks` shape.

## Context

A Task had no shared vocabulary to tag it, no place to talk about it and no record of what happened to it. Kaneo, which Morrow references, has all three, but each is built in a way Morrow does not want to copy:

- Its `label` table holds two kinds of row. A Workspace "template" has no task; applying one copies its name and colour into a new row tied to the task. Renaming a label leaves stale copies on every task, and deleting one needs a cascade over the copies behind an advisory-lock throttle.
- A comment is stored twice: in a comment table and as an activity row that carries the content.
- The sheet's timeline mixes comments with field-change events read from a general activity table.

## Decision

**Labels belong to the Workspace** (`label`: name, colour from the Project palette, fractional-index `position`; name unique per Workspace on `lower(name)`). A Task carries the ids of its labels in **`task.label_ids text[]`**, not null, default empty, with **no foreign key**. This is the only array-of-ids column in the schema and a deliberate exception to relational integrity: one row per task, no extra shape, and a card or filter reads its labels straight off the task row. **Label delete is the single path that must keep the column consistent**: in one transaction it takes the label row, runs `array_remove` over every Task of the Workspace's Projects, then deletes the label. Applying a label takes a share lock on the label row first, so an apply in flight either lands before the strip or finds the label gone.

**Applying and removing are separate Procedures** (`tasks.addLabel`, `tasks.removeLabel`), each an `array_append` (only when absent) or `array_remove` under the Project lock, so two people labelling one Task at once both land. A Task holds at most 20 labels. The label shape (`labels`) is eager and scoped by membership; it is small and every card needs it.

**Permissions.** A `label` resource: Members `create`; Admins and Owners `create`, `update`, `delete`; Viewers none. Applying a label is `task: update`. A `comment` resource gives `create` to every role, Viewers included, and `delete` (anyone's) to Admins and Owners; editing is always the author's and needs no grant.

**Comments** are their own table (`task_comment`) with the Project id repeated for shape scoping, as in 0005. `task.comment_count` is kept by the same transactions that create and delete comments, so a card shows a badge without the comments. The `task-comments` shape is on-demand and the sheet narrows it to one task. Comment writes hold the Project lock, so an archived Project refuses them; an archived Task does not. A comment's author is `SET NULL` on user delete and reads "Deleted user". The Workspace activity feed gets `comment.created` (no excerpt); edits and deletes are not recorded.

**Task history** is its own table (`task_event`: type, a `jsonb` payload, actor), not the Workspace `activity` table, which serves a different reader and stays small. Event types and payloads are one zod discriminated union in `@morrow/sync-schemas`, used by the API to write and the web app to render. `recordTaskEvent` is called from each user-initiated Procedure inside its transaction, while the Project lock is held. A pure function decides whether a new change is inserted, merged into the actor's latest event of the same field within 10 minutes (keeping the first `from`), or, when the merge returns the field to where it started, deletes that event. Label events merge their added and removed sets. System cascades (Column delete, category change, member removal, Project key rename, label delete) and reorders within a Column write nothing: one admin action must not write thousands of rows. Payloads carry a snapshot of names, so history stays readable after a Column, label or Member is gone; the timeline prefers the live name when the entity still exists. The `task-events` shape is on-demand and read-only.

**Timeline.** The sheet merges the comments and events live queries by `created_at`, oldest first, folds three or more consecutive events into "N more changes", and puts the composer last. No pagination; if history volume ever demands it, paginating the `task-events` subset is the follow-up, not a change of storage.

**Import, export, MCP.** Export carries label names and colours and, per Task, label names and comments with author emails; history is not exported. Import matches labels by name ignoring case, creates missing ones when the importer has `label: create` (otherwise drops them with a warning), keeps comment times and maps authors by email (unknown ones become "Deleted user" with a warning), and writes one `imported` event per Task. MCP gets `list_labels`, and `get_task` returns labels and comments.

## Consequences

- Three new shapes (`labels`, `task-comments`, `task-events`) bring a Workspace page to twelve long-polls. That is fine behind HTTP/2, which dev Caddy, prod Traefik and the e2e Caddy all use.
- The `tasks` shape gains `label_ids` and `comment_count`; both are small.
- Renaming or recolouring a label is one row write and every card updates.
- Anything that deletes labels outside `deleteLabel` would leave dangling ids. The web app tolerates them (an unknown id is not shown), and a test pins the cascade.
- Existing Tasks start with an empty history; there is no backfill.
