# Moving Tasks between Projects

Status: ready-for-agent

Tickets: MOR-15.

## Problem Statement

A Task stays in the Project it was created in. When work turns out to belong to another Project (a bug filed under the wrong board, an epic handed to another team, a backlog being reorganised), the only option is to recreate it there and delete the original. That loses its history, comments, links, attachments, Relations and Subtasks. Its Ticket id also changes, so every link and reference to it breaks: URLs, mentions in other descriptions, `Refs:` trailers in commits. An agent working through MCP cannot move a Task at all.

## Solution

A Member can move one or more Tasks to another Project in the same Workspace, from the task sheet, the context menu, a hotkey, the bulk bar or MCP.

- The Task keeps everything that belongs to the Workspace: description, comments, links, attachments, labels, Relations, assignee, history and archive state.
- It gets a ticket number in the new Project. The old Ticket id keeps resolving: opening it redirects to the new one. Moving the Task back gives it its old number back.
- Its Column is picked by its state: same Column name, otherwise same Column category, otherwise the first `unstarted` Column. The user can pick a different Column instead.
- Field values carry over when the new Project has a Field with the same name and type (and options with the same names). Values with no match are dropped, and the confirm step lists them first.
- By default its Subtasks move with it, the whole tree. The user can untick "Move subtasks too", which leaves them behind in the source Project as top-level Tasks. A Subtask moved on its own leaves its Parent.
- The move is written to the history of every moved Task and to the Workspace activity feed.

## User Stories

1. As a Member, I want to move a Task to another Project from its sheet, so that work filed in the wrong place ends up where it belongs.
2. As a Member, I want to move a Task from the board's context menu, so that I do not have to open it first.
3. As a Member, I want a hotkey that opens the move picker for the focused or open Task, so that reorganising is fast.
4. As a Member, I want to select several Tasks and move them together from the bulk bar, so that reorganising a backlog takes one action.
5. As a Member, I want the picker to list every other Project in the Workspace and leave out the current one and archived ones, so that I only see places I can move to.
6. As a Member, I want a Task to land in the Column whose name and category match its current Column, so that the move needs no extra step when the workflows line up.
7. As a Member, I want a Task to land in a Column of the same category when no name matches, so that a started Task stays started.
8. As a Member, I want a Task to land in the first `unstarted` Column when the new Project has no Column of its category, so that the move always has somewhere to go.
9. As a Member, I want to pick the destination Column myself, so that I can put the Task exactly where I want it.
10. As a Member, I want a single move with an exact Column match and nothing to drop to happen in one step, so that the common case has no dialog.
11. As a Member, I want a confirm step when anything will be dropped, so that I never lose data without seeing it first.
12. As a Member, I want the confirm step to say how many Tasks will move ("Moves 37 tasks"), so that I know what a subtree or bulk move involves.
13. As a Member, I want the confirm step to list the Field values that will be dropped, so that I can decide whether that is acceptable.
14. As a Member, I want Field values to carry over when the new Project has a Field with the same name and type, so that shared properties survive the move.
15. As a Member, I want a choice value to carry over when the new Field has an option with the same name, so that "Size: L" stays "Size: L".
16. As a Member, I want a multi choice value to keep the options that match and lose only the rest, so that a partial match keeps what it can.
17. As a Member, I want a moved Task's Subtasks to move with it by default, so that moving an epic moves its pieces.
18. As a Member, I want to untick "Move subtasks too", so that I can move only the Task and leave its Subtasks behind as top-level Tasks.
19. As a Member, I want a Subtask I move on its own to leave its Parent, so that a Parent and its Subtasks stay in one Project.
20. As a Member, I want each moved Subtask to keep its own state, so that a done Subtask stays done in the new Project.
21. As a Member, I want moved Tasks to go to the end of their target Column in the order they had, so that the destination board's existing order is untouched and the moved group stays in sequence.
22. As a Member, I want the moved Tasks numbered parent first, then depth-first in their current order, so that the new Ticket ids read like the tree.
23. As a Member, I want a completed Task to stay completed when it lands in a closed Column and be reopened when it lands in an open one, so that its completion date matches its state.
24. As a Member, I want an archived Task to move and stay archived, so that I can reorganise without unarchiving.
25. As a Member, I want the moved Task to keep its description, comments, links and attachments, so that nothing about the work is lost.
26. As a Member, I want the moved Task to keep its labels, assignee and due date, so that ownership and planning carry over.
27. As a Member, I want the moved Task to keep its Relations, including those to Tasks in other Projects, so that "blocked by" stays true.
28. As a Member, I want the moved Task's history to carry over and gain a "moved from MOR to WEB" entry, so that I can see where it came from.
29. As a Member, I want the moved-from entry to show the old and new Ticket id, the Column and any dropped values, so that the history explains what changed.
30. As a Member, I want a Parent left behind by a detach to get a "subtask removed" entry, so that its history explains why its counter dropped.
31. As a Member, I want the Workspace activity feed to show "MOR-12 moved to WEB-3", so that the team sees reorganisation.
32. As a Member, I want the Parent's subtask counter to update on every Parent involved, so that `2/5` stays true after a move or detach.
33. As a Member, I want the old Ticket id to redirect to the new one, so that links in commits, chats and descriptions keep working.
34. As a Member, I want the old Ticket id to keep working after the destination Project's key is renamed, so that redirects survive renames.
35. As a Member, I want moving a Task back to a Project it used to be in to restore its old number, so that a mistaken move leaves no trace in the ids.
36. As a Member, I want the open sheet's URL to switch to the new Ticket id without a new Back entry, so that the address bar is right and Back does not land on the old id.
37. As a Member viewing a Task someone else moves, I want my view to follow it to its new Ticket id, so that I am not left on a stale page.
38. As a Member, I want the moved card to leave the source board and show up on the destination board live, in every tab, so that boards stay current without reload.
39. As a Member, I want a toast after the move with "Open in WEB", so that I can follow the Task.
40. As a Member, I want Undo in the toast when nothing was dropped, so that a mistaken move is one click to reverse.
41. As a Member, I want no Undo when values were dropped, so that I am not offered an undo that cannot fully restore the Task.
42. As a Member, I want a bulk move where a Parent and one of its Subtasks are both selected to move the Subtask once, through its Parent, so that nothing moves twice.
43. As a Member, I want a bulk move to map each Task by its own Column by default, so that their states survive.
44. As a Member, I want to pick one Column for every Task in a bulk move, so that I can drop a batch into, say, the backlog.
45. As a Member, I want "Move subtasks too" to apply to the whole batch, so that the dialog stays simple.
46. As a Member, I want a move of more than 500 Tasks refused before anything changes, with the count shown up front, so that a huge move never half-happens or locks a board for long.
47. As a Viewer, I want the move action hidden and refused, so that read-only roles stay read-only.
48. As a Member, I want a move into or out of an archived Project refused, so that archived Projects stay read-only.
49. As a Member, I want a move to a Project in another Workspace refused, so that work never leaks across Workspaces.
50. As a Member, I want a destination Column that is not in the destination Project refused, so that a stale picker cannot misplace a Task.
51. As a Member, I want two people moving the same Task at once to end with it in one place and one history entry per move, so that concurrent moves are safe.
52. As a Member, I want a move to land even if another Task already holds the target position, so that hidden archived Tasks never make a move fail.
53. As an agent using MCP, I want `move_tasks` with ticket ids, a destination Project key and an optional Column name, so that I can reorganise work.
54. As an agent using MCP, I want `withSubtasks` to default to true and be switchable off, so that I get the same choice as the UI.
55. As an agent using MCP, I want to move Tasks from several source Projects in one call, so that cross-board clean-ups are one call.
56. As an agent using MCP, I want each bad item (unknown ticket, archived Project, permission) refused on its own while the rest move, so that one typo does not block a batch.
57. As an agent using MCP, I want the result to give each Task's old and new Ticket id, the dropped values and any Parent it left, so that I can report what happened.
58. As an agent using MCP, I want `get_task` with an old Ticket id to return the moved Task, so that references in commit trailers still resolve.

## Implementation Decisions

**One operation.** `tasks.move({ workspaceId, taskIds, toProjectId, columnId?, withSubtasks })` in `withTxid`, returning `{ moved: [{ taskId, fromTicketId, toTicketId, droppedValues, detachedFrom }], txid }`. The UI single move, bulk move and MCP all call it.

**Permission.** `task: update` and `task: create`, as for duplicate. Viewers have neither.

**Locks.** All source Projects and the destination are locked in id order with `lockProject`, which also refuses archived Projects. Everything below is read and written under those locks, Column resolution included (Kaneo resolves Columns before its transaction and can race a Column delete).

**Selection.**
- The set is expanded to subtrees when `withSubtasks` is on (a recursive CTE over `parent_id`). Descendants that were also selected are counted once.
- If the expanded set is over 500, the move is refused with `MOVE_TOO_LARGE` before any write.
- A Task already in the destination is refused per item.

**Numbering and the alias.**
- New table `task_ticket_alias (project_id, number) → task_id`, primary key `(project_id, number)`. `project_id` and `task_id` cascade on delete.
- For each moved Task, in parent-first, depth-first, current-number order:
  - if an alias row `(destination, n) → this task` exists, the Task takes `n` back and the row is deleted;
  - otherwise it takes `last_task_number + 1` from the destination.
  - Then an alias row is written for the `(source, old number)` it leaves.
- Numbers are never reused, so an alias never clashes with a live Task.
- Ticket lookup (`tasks.get` by ticket id, the `/tasks/:ticketId` route, MCP) tries the live `(project, number)` first, then the alias, and returns the Task with its current Ticket id so the caller can redirect.
- A Project key rename keeps aliases working, because they key on `project_id`.

**Column.**
- The Tasks the caller selected go to `columnId` when given; the server checks it belongs to the destination (`COLUMN_NOT_IN_PROJECT`).
- Every other Task, and the selected ones when `columnId` is absent, maps through the existing `matchColumn` (written for import), called with the Task's own Column name and category: same name, then first Column of the same category, then first `unstarted`. It moves to `@morrow/sync-schemas` so the web app's picker computes the same default. The confirm step's "exact" means the name matched *and* the category is the same; `matchColumn`'s own `exact` only checks the name.
- Tasks are appended after the target Column's last position with `generateNKeysBetween`, in their current board order. `freePosition` handles a held slot.
- `nextCompletedAt` runs on the old and new category. `archivedAt` is kept.

**Field values.**
- Source Fields are matched to destination Fields by name, ignoring case, and type. Choice options are matched by name, ignoring case. The existing import field-matching helpers are reused.
- Matched values are rewritten to the destination's Field and option ids. Unmatched values (a missing Field, a different type, or an option with no match) are dropped and returned.
- A multi choice keeps its matched options and drops the key when none match.
- Number bounds and URL format of the destination Field are not enforced on carried values, the same rule as a bound set after a value exists.

**Subtasks.**
- A Task moved with `withSubtasks` off leaves its children in the source Project as top-level Tasks (their `parent_id` cleared).
- A selected Task whose Parent is not moving has its `parent_id` cleared.
- `refreshSubtaskCounts` runs on every Parent whose children changed, in either Project.
- The rule "a Parent and its Subtasks share a Project" stays.

**Rows that copy `project_id`.** `task_description`, `task_comment`, `task_link` and `task_event` are updated to the destination for every moved Task in the same transaction. Labels, Relations, assets, assignee and comment counts need no change; blocked counts are unchanged because Relations are Workspace-scoped.

**History and activity.**
- A new `project_moved` task event, written on every moved Task. Payload: `{ from: { projectId, key, name, ticketId, column }, to: { …same }, droppedValues: [{ field, value }] }`, names snapshotted. It never folds with other events.
- A detach writes the existing `parent` event on the child, and `subtask_removed` on the Parent left behind.
- A new `task.moved` Workspace activity type, with both Ticket ids and Project names, recorded in the transaction.
- The timeline shows live Ticket ids for related Tasks when they exist, so older parent and relation entries do not show stale ids.

**Errors.** New typed errors: `MOVE_TOO_LARGE`, `MOVE_SAME_PROJECT`. Existing ones are reused: `COLUMN_NOT_IN_PROJECT`, `PROJECT_ARCHIVED`, and not found for an unknown or out-of-Workspace Project or Task.

**Web app.**
- The move picker has two steps: Project, then a confirm step.
  - The confirm step shows the Column choice (defaulting to the `matchColumn` result, or "keep each task's state" in bulk), the "Move subtasks too" checkbox when relevant, the Task count, and the values that will be dropped.
  - The dropped values are computed in the browser from the synced `project-fields` shape and the Task rows. The server's result is the source of truth.
  - The confirm step is skipped for a single move with an exact name-and-category match, no Subtasks and nothing to drop.
- After the move:
  - an open sheet replaces its URL with the new Ticket id;
  - the `/tasks/:ticketId` route redirects when the Task's current Ticket id differs from the URL;
  - the toast offers "Open in <Project>", and Undo only when nothing was dropped. Undo calls the same operation back to the source Project and Column, which reclaims the old numbers.

**MCP.** `move_tasks({ ticketIds, project, column?, withSubtasks = true })`.
- Ticket ids may come from several source Projects. `project` is a key and `column` a Column name.
- Items that fail resolution or checks are refused per item, as `update_tasks` does. The rest move in one call to the operation.
- The result lists each moved Task's old and new Ticket id, dropped values (by name) and detached Parent.
- `get_task` resolves old Ticket ids through the alias.

**Sync.** The `tasks` shape, scoped by membership, carries the `project_id` change on its change stream. The board's on-demand `where project_id = X` live query re-evaluates in the browser, so the card leaves the source board and enters the destination board if it is loaded. Description, comment, link and event shapes are narrowed by task and are unaffected. See Further Notes for the spike.

## Testing Decisions

**What a good test is.** It checks behaviour a caller can see: what a Procedure returns or refuses, and the rows a Member can then read. It does not test lock order, CTEs or helper internals; the Procedure tests cover them.

### API integration (main seam)

A new oRPC integration suite against a real database, using the existing tasks, projects, fields and history helpers. Prior art: the subtasks, custom fields, custom field types and task history integration tests.

- **Numbering and aliases.** A moved Task gets the destination's next number. Its old Ticket id resolves through `tasks.get` and returns the new one. Moving it back restores the old number and removes the alias. An alias survives a key rename of the destination. Numbers are never reused after a move.
- **Columns.** Name and category match, category-only match, fallback to first `unstarted`, explicit `columnId`, `columnId` from another Project refused. Each Subtask maps by its own Column. Moved Tasks append in their current order.
- **Positions.** A collision with a hidden archived Task is resolved.
- **Completion and archive.** `completedAt` is set, cleared or kept across categories. An archived Task stays archived.
- **Field values.** Matched values are rewritten to the destination's ids. Unmatched Field, type mismatch and unmatched option are each dropped and returned. A partial multi choice keeps its matched options.
- **Subtasks.** Subtree moves with numbering parent first. With `withSubtasks` off, children stay as top-level Tasks in the source. A Subtask moved alone leaves its Parent. Counters are right on every Parent involved.
- **Copied `project_id`.** After a move, the description, comments, links and events read under the destination Project. Labels, Relations, assignee and attachments are unchanged.
- **History and activity.** `project_moved` lands on every moved Task with dropped values. `subtask_removed` lands on a Parent left behind. `task.moved` lands in the Workspace feed.
- **Bulk.** A Parent and its descendant selected together move once. A single `columnId` applies to every selected Task. Several source Projects move in one call.
- **Refusals.** Viewer, archived source, archived destination, another Workspace, same Project, more than 500 Tasks (nothing written).
- **Race.** Two concurrent moves of the same Task end with it in one Project, with a consistent alias and counters.
- **txid.** The returned `txid` matches the moved row's `xmin`.

### MCP endpoint

In the existing MCP endpoint integration test:
- `move_tasks` by key and Column name
- `withSubtasks` default and off
- several source Projects
- per-item refusals while the rest move
- the result shape
- `get_task` with an old Ticket id

### Unit tests

Only for new pure helpers, if they come out (subtree ordering and numbering, field value remapping), each with a small test beside it. `matchColumn` already has its test.

### Not tested here

No Playwright spec for this feature, so the browser behaviour (cards leaving and entering boards live, URL replacement, redirect, the Undo rule) is checked by hand and by the sync spike below.

## Out of Scope

- Moving between Workspaces.
- Parents in a different Project from their Subtasks (Linear-style cross-team sub-issues).
- Creating missing Fields or options in the destination during a move.
- Restoring dropped Field values on Undo or on moving back.
- Rewriting Ticket ids written in descriptions or comments; the alias makes them resolve instead.
- Moving whole Columns or Projects' worth of Tasks beyond the 500 cap.
- Choosing a Column per Task in the bulk dialog (it is per-task mapping or one Column for all).
- Playwright coverage.

## Further Notes

- **Sync spike first.** Before building, check against the real stack that a task row whose `project_id` changes leaves the source board's on-demand subset and enters the destination's as an update, not a delete and insert, in a second tab too. ADR 0004's spike did not cover a row moving between subsets. If it does not work, the web app removes the moved rows from the collection itself when the move returns. Record the result in the ADR.
- **Docs** (confirmed by the owner). ADR 0011 is written as `proposed`; when this lands, mark it accepted with the spike result and update:
  - ADR 0008's "Tasks never change Project";
  - ADR 0007's line that a moved Task loses its values;
  - `CONTEXT.md` for Ticket id (an old id keeps resolving after a move) and Subtask (moves with its Parent).
- **Compared with Kaneo.** Kaneo resolves the Column outside its transaction, matches by status slug rather than category, leaves custom field values pointing at the source Project's definitions, ignores subtasks, breaks the old Ticket id, gives a new number on moving back, publishes its event after commit, and has no bulk or MCP move.
