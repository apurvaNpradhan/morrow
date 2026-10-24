# 0011. Moving Tasks between Projects

Status: accepted (2026-10-24). Spec: `.scratch/task-move/spec.md`, ticket MOR-15. When accepted it overrides the "moving a task between Projects" entry under "Not now" in [0004](0004-tasks.md), revises "Tasks never change Project" in [0008](0008-subtasks-and-relations.md) and the line in [0007](0007-custom-fields.md) saying a moved Task loses its values.

## Context

Work filed in the wrong Project can only be recreated and deleted, which loses its history, comments, links, attachments, Relations and Subtasks, and breaks every reference to its Ticket id. Kaneo, which Morrow references, has a move, but:

- It picks the destination column outside its transaction, so a column delete can race it, and it matches by status slug, which can change what the task means.
- Custom field values keep pointing at the source project's definitions.
- Subtasks are ignored, so a parent and its child end up in different projects.
- The old ticket id stops resolving, and moving back takes yet another number.
- Its event is published after commit and is not in the task's history. There is no bulk or MCP move.

## Decision

**One operation, `tasks.moveToProject`** (`tasks.move` was already the Column move), used by the sheet, context menu, hotkey, bulk bar and MCP `move_tasks`. It needs `task: update` and `task: create`, as duplicate does. All source Projects and the destination are locked in id order with `lockProject`, which also refuses archived Projects, and everything (Column resolution included) happens under those locks. More than 500 Tasks, counting subtrees, is refused with `MOVE_TOO_LARGE` before any write.

**Ticket ids keep resolving.** A moved Task takes the destination's next number. A new table `task_ticket_alias (project_id, number) → task_id` records the id it left; ticket lookup tries the live `(project, number)` first, then the alias, and the caller redirects. Moving a Task back to a Project where it has an alias takes that number back and deletes the alias. Numbers are never reused, so an alias never clashes, and keying on `project_id` survives key renames.

**Subtasks keep sharing their Parent's Project.** By default the whole subtree moves; with "Move subtasks too" off, the children stay behind as top-level Tasks. A Subtask moved without its Parent leaves it. Counters are recomputed on every Parent involved. Parents in other Projects were considered and rejected: they need cross-Project locks on every counter refresh, a Workspace-wide cycle check, and a fix for counters left wrong when a Project is deleted. They can still be added on top of this later.

**Columns map by state.** The selected Tasks go to the Column the caller picked, if any. Everything else maps through `matchColumn` on its own Column: same name, then same category, then first `unstarted`. Tasks append to the end of their target Column in current order; `nextCompletedAt` runs; `archivedAt` is kept.

**Field values are matched, not lost.** Fields match by name (ignoring case) and type, options by name. Matched values are rewritten to the destination's ids; the rest are dropped, shown in the confirm step beforehand and recorded in history.

**Everything Workspace-scoped stays.** Labels, Relations, attachments and the assignee are unchanged. `task_description`, `task_comment`, `task_link` and `task_event` repeat `project_id` for shape scoping and are rewritten in the same transaction.

**History and activity.** A `project_moved` event on every moved Task (both Projects, Ticket ids, Columns, dropped values), never folded. A detach writes `parent` on the child and `subtask_removed` on the Parent. A `task.moved` Workspace activity entry.

**Undo** is a move back and appears only when nothing was dropped.

## Sync spike

Checked against the real stack (Postgres, Electric, the built app, two browser tabs of one user):

- A move reaches the `tasks` stream as an **update** of the row, not a delete and insert, and its `txid` resolves `awaitTxId`.
- A board that held the row drops it when the update arrives (the live query's `where project_id = X` no longer matches), in every tab.
- A board that never held the row did **not** receive it. In `on-demand` mode the collection skips an update for a key it does not know unless the shape was requested with `replica=full`, which makes every update carry the whole row.

So the `tasks` shape is now served with `replica=full`: the shape definition says so (`replica: "full"` on `tasksShape`), the proxy sets it upstream and never reads it from the browser, and the browser's collection options name it so the collection knows updates are complete. Updates of a task row are larger by the unchanged columns. After it, the destination board shows the moved card live in a second tab, with no work by the tab that moved it. The web app does nothing special to remove rows.

A page that shows a Task by its Ticket id follows it when it moves, in this tab or another: it finds the Task by id while it is open, or asks the server (`tasks.resolveTicket`) what an old Ticket id now means when it was opened cold, and replaces its address.

## Consequences

- One new table and two new event types; no new shape.
- A move rewrites up to five tables per Task under two or more Project locks, which is why it is capped at 500 Tasks.
- Ticket ids in descriptions, comments and commit trailers are not rewritten; they resolve through the alias.
- Dropped Field values are gone; moving back does not restore them.
