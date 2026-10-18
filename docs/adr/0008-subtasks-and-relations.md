# 0008. Subtasks and task relations

Status: accepted (2026-10-19). Overrides the "Not now" entry of [0004](0004-tasks.md) for subtasks and relations. Builds on [0004](0004-tasks.md) (Project lock, `withTxid`, history) and [0006](0006-labels-comments-history.md).

## Context

Large work could not be broken into Tasks, and nothing recorded that one Task waits on another. Kaneo stores subtasks as a relation type (a Task may have several parents), has no cycle guard, guards duplicates with a SELECT before the INSERT, and counts with server-side `GROUP BY` plus cache invalidation. None of that fits a synced, on-demand board that loads done groups only when expanded.

## Decision: subtasks

**One parent, same Project.** The task row has a nullable `parent_id` (`ON DELETE SET NULL`, indexed). Tasks never change Project, so the parent is always in the same Project. Deleting a parent keeps its subtasks as top-level Tasks.

**Cycle guard.** Setting a parent runs under `lockProject`; a recursive CTE walks the proposed parent's ancestors and refuses (`PARENT_CYCLE`) if it reaches the Task. A Task as its own parent is the same refusal. A parent outside the Project is `PARENT_NOT_IN_PROJECT`.

**Counters on the parent's row.** `subtask_total` is the direct children that are not archived; `subtask_done` those with `completedAt` set (canceled counts as done). They are stored because the board loads done and canceled groups only when expanded, so counting in the browser comes out too low. They are recomputed from the rows, never adjusted by one (`refreshSubtaskCounts`), by every write that can change them: create, a Column move that changes open or closed, archive and unarchive (single and "archive completed"), delete, set or clear parent (old and new parent), duplicate, and Column delete or category change. All hold the Project lock. Each write touches a task row, so the change reaches the existing tasks stream.

**Duplicate** copies `parentId` (a sibling) and copies no children.

**Writes.** `tasks.updateParent` is its own field-group Procedure (`task: update`), returning `{ txid }`. `tasks.create` accepts an optional `parentId` (`task: create`).

**History.** `parent` on the child (from and to ticket ids), `subtask_added` and `subtask_removed` on the parents. Ticket ids are snapshots; deleting a subtask writes `subtask_removed` on its parent only, since its own history goes with it.

**MCP.** `create_tasks` and `update_tasks` take `parentId` as a ticket id (`null` clears); `get_task` returns the parent and counts; `list_tasks` returns the parent and counts.

## Not enforced

A parent can close with open subtasks and nothing moves when the last subtask closes.
