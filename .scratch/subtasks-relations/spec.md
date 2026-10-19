# Subtasks and task relations

Status: ready-for-agent

Tickets: MOR-4 (umbrella), MOR-45 (subtasks), MOR-46 (relations), MOR-47 (blocked mark), MOR-48 (UI). Follow-ups: MOR-43 (marking a Task a duplicate cancels it), MOR-49 (export and import).

## Problem Statement

A Task stands alone. Large pieces of work cannot be broken into smaller Tasks, so people write checklists in the description, and those cannot be assigned, moved or tracked on the board. Nothing records that one Task is waiting on another, that two Tasks are about the same thing, or that one is a duplicate of another. A Member looking at the board cannot tell which work is held up, and an agent working through MCP cannot plan work as a tree or record what blocks what.

## Solution

**Subtasks.** A Task can have a parent Task in the same Project, and subtasks can have subtasks of their own, to any depth.
- The parent's card shows how many of its direct subtasks are closed, for example `2/5`. The number is stored on the parent's row, so the card shows it without loading the children.
- A subtask is an ordinary card in its own Column, with a chip showing its parent's Ticket id.

**Relations.** Any two Tasks in a Workspace, in the same Project or in different ones, can be linked as:
- **blocks**, which the other Task shows as "blocked by"
- **related**
- **duplicate of**, which the other Task shows as "duplicated by"

A Task whose blockers are not all closed shows a "blocked" mark on its card.

**Where it shows up.**
- The task sheet gets a Sub-tasks section and a Relations section, each with a picker.
- Both kinds of link are written to the Task history of every Task involved.
- MCP can set a parent and manage relations.

**What it never does.** Nothing is enforced and nothing happens automatically: a parent can close with open subtasks, a blocked Task can be started, and closing the last subtask leaves the parent where it is.

## User Stories

### Subtasks

1. As a Member, I want to set a parent on a Task, so that I can break large work into smaller Tasks.
2. As a Member, I want to add a subtask from the parent's sheet by typing a title, so that splitting work takes a few keystrokes.
3. As a Member, I want a new subtask to start in the Project's first `unstarted` Column, so that it does not look in progress before anyone works on it.
4. As a Member, I want to remove a Task's parent, so that it becomes a top-level Task again.
5. As a Member, I want to move a subtask under a different parent, so that I can reorganise work.
6. As a Member, I want subtasks to have subtasks of their own, so that I can plan to whatever depth the work needs.
7. As a Member, I want to be stopped from making a Task its own ancestor, so that the tree never loops.
8. As a Member, I want the parent picker to offer only Tasks in the same Project, and not the Task itself or anything under it, so that I can only choose a valid parent.
9. As a Member, I want the parent's card to show how many of its direct subtasks are closed out of how many there are, so that I can see progress without opening it.
10. As a Member, I want that count to be right while the done and canceled groups are collapsed, so that progress never looks lower than it is.
11. As a Member, I want canceled subtasks to count as done, so that dropped work does not hold the count below 100%.
12. As a Member, I want archived subtasks left out of the count, so that the count matches what is on the board.
13. As a Member, I want the count to update live when anyone closes, reopens, archives, deletes or moves a subtask to another parent, so that every tab agrees.
14. As a Member, I want no progress chip on a Task that has no subtasks, so that cards stay quiet.
15. As a Member, I want a subtask's card to show its parent's Ticket id, so that I can tell where it belongs.
16. As a Member, I want subtasks to be ordinary cards in their own Columns, so that the board still shows everything in flight.
17. As a Member, I want the parent's sheet to list its direct subtasks by number, with each one's Column and Assignee, so that I can review the breakdown in one place.
18. As a Member, I want to open a subtask from its parent's sheet, and the parent from the subtask's sheet, so that I can move around the tree.
19. As a Member, I want deleting a parent to keep its subtasks as top-level Tasks, so that deleting one Task never destroys other people's work.
20. As a Member, I want duplicating a subtask to make a sibling under the same parent, so that copies stay where the original was.
21. As a Member, I want duplicating a parent to copy neither its subtasks nor its relations, so that a duplicate is one Task and nothing more.
22. As a Member, I want to close a parent even when it still has open subtasks, so that the tool never gets in the way of how the team works.
23. As a Member, I want the parent to stay put when its last subtask closes, so that nothing moves without someone moving it.
24. As a Member, I want a subtask's Task history to record its parent being set, changed or cleared, so that I can see how the work was organised.
25. As a Member, I want the parent's Task history to record subtasks being added and removed, so that its own story is complete.
26. As a Member, I want history entries to keep showing the Ticket id they had at the time, so that history still reads correctly after a Task is deleted.
27. As a Viewer, I want to see subtasks and progress without being able to change them, so that I can follow the work.

### Relations

28. As a Member, I want to mark that a Task blocks another, so that the dependency is recorded.
29. As a Member, I want the blocked Task to show "blocked by" with the blocker, so that the dependency can be seen from both sides.
30. As a Member, I want to mark two Tasks as related, so that connected work is one click away.
31. As a Member, I want "related" to be one link whichever Task I add it from, so that the same pair never appears twice.
32. As a Member, I want to mark a Task as a duplicate of another, and the other to show "duplicated by", so that duplicates point to the Task that is kept.
33. As a Member, I want to link Tasks in different Projects of the Workspace, so that dependencies between teams are recorded.
34. As a Member, I want the relation picker to search every Task in the Workspace, so that I can find a Task in another Project.
35. As a Member, I want the relation picker to leave out the Task itself and Tasks already linked with the chosen type, so that I cannot create a link that would be refused.
36. As a Member, I want a clear error if I try to link a Task to itself or add a link that already exists, so that mistakes are explained.
37. As a Member, I want to be stopped from creating a loop of "blocks" links, including loops across Projects, so that work never waits on itself.
38. As a Member, I want to remove a relation, so that I can fix mistakes.
39. As a Member, I want the sheet to group relations as blocked by, blocks, related, duplicate of and duplicated by, so that the most important ones come first.
40. As a Member, I want each related Task in the sheet to show its Ticket id, title and Column, so that I can see its state without opening it.
41. As a Member, I want to open a related Task in another Project from the sheet, so that following a dependency is one click.
42. As a Member, I want a relation to disappear when either of its Tasks is deleted, so that no link points at nothing.
43. As a Member, I want adding or removing a relation to be written to the Task history of both Tasks, including across Projects, so that neither Task loses track of the other.
44. As a Member, I want relations I add or remove to show at once and settle when the server confirms, so that the UI responds immediately.
45. As a Member of one Workspace, I want to never see relations from Workspaces I don't belong to, so that nothing leaks between Workspaces.

### Blocked mark

46. As a Member, I want a card to show a "blocked" mark while any of its blockers is open, so that I can see held-up work on the board.
47. As a Member, I want the mark's tooltip to say how many open blockers there are, so that I know how much is in the way.
48. As a Member, I want the mark to go away when the last blocker is done or canceled, so that it reflects the current state.
49. As a Member, I want an archived blocker to stop counting, so that the mark never points at a Task nobody can see on the board.
50. As a Member, I want the mark to come back when a blocker is reopened or unarchived, so that it stays correct in both directions.
51. As a Member, I want closing a blocker in another Project to update the mark on my board, so that dependencies between Projects stay current.
52. As a Member, I want the mark to stay correct even when someone links a blocker at the same moment someone else closes it, so that the board never shows a Task as blocked by finished work.
53. As a Member, I want to start a blocked Task anyway, so that the mark informs without enforcing.

### Agents (MCP)

54. As an agent, I want to set `parentId` when I create Tasks, so that I can make a plan as a tree in one call.
55. As an agent, I want to set or clear `parentId` with `update_tasks`, so that I can reorganise a plan.
56. As an agent, I want `manage_relation` to add and remove relations by Ticket id, so that I can record dependencies.
57. As an agent, I want `get_task` to return the parent, the subtask counts, the open-blocker count and the relations with each other Task's Ticket id and title, so that I can reason about what to do next.
58. As an agent, I want `list_tasks` to return the parent and the counters, so that I can see the shape of a Project without reading every Task.
59. As an agent, I want refused writes (a cycle, another Project, a duplicate) to come back as typed errors, so that I can fix the request and try again.

## Implementation Decisions

### Subtasks (in the tasks Vertical)

- **Schema.** The task row gains:
  - a nullable parent reference to another Task, with `ON DELETE SET NULL` and an index
  - `subtask_done` and `subtask_total`, integers defaulting to 0
  
  They are added to the tasks Shape's column schema in the shared sync-schemas package, so they ride the existing Shape and the on-demand collection. Making the table synced needs no extra migration steps.
- **The parent must be in the same Project.** Tasks cannot move between Projects (ADR 0004), so this always holds. Kaneo's helpers for refreshing parent boards in other Projects have no counterpart here.
- **Cycle guard.** Setting a parent runs under `lockProject`. A recursive CTE walks the proposed parent's ancestors and refuses with a typed error if it reaches the Task. Making a Task its own parent is refused the same way.
- **Counters are recomputed from the actual rows, never adjusted by ±1:**
  - total = direct children that are not archived
  - done = those children with `completedAt` set (a `done` or `canceled` Column)
- **When the counters are recomputed:** every write that can change them recomputes the affected parent, and on a re-parent both the old and the new parent. The writes are:
  - create
  - a Column move that changes open/closed
  - archive and unarchive
  - delete
  - set or clear parent
  - duplicate
  - Column delete or category change, which moves tasks or changes their open/closed state in bulk
  
  All of these already hold the Project lock, so they serialize.
- **Duplicate** copies `parentId`, so the copy is a sibling, and recomputes the parent. It copies no children and no relations.
- **Setting a parent** is its own field-group Procedure, as ADR 0004 does for other field groups, returning `{ txid }`. Create accepts an optional parent.
- **Permission.** Setting a parent needs `task: update`. Creating a subtask needs `task: create`.

### Relations (in the tasks Vertical)

- **Schema.** A new table, `task_relation`:

  | Column | Notes |
  |---|---|
  | id | |
  | workspace_id | |
  | type | |
  | source task | cascades on delete |
  | target task | cascades on delete |
  | created by | `SET NULL` |
  | created at | |

  Constraints and indexes:
  - CHECK that the type is `blocks`, `related` or `duplicate`
  - CHECK that source ≠ target
  - unique index on (type, source, target)
  - indexes on source, target and workspace id
- **Direction:**
  - `blocks`: the source blocks the target.
  - `duplicate`: the source is a duplicate of the target.
  - `related`: stored with the two ids in sorted order, so one pair has one row.
  
  The Procedure normalises the order; the browser never decides storage order.
- **Sync.** One migration makes the table synced (replica identity, publication, grant), following the earlier synced-table migrations.
  - **Shape.** The relations Shape is declared once in sync-schemas as a name plus column schema. It is defined in the tasks Vertical's shapes and registered in the platform registry. It is scoped by `workspace_id` through a membership subquery. Membership implies read, so it needs no permission logic.
  - **Collection.** An on-demand synced collection lives in the tasks Vertical's collections and is registered for cleanup at sign-out. The sheet reads it with a live query on "source is this Task or target is this Task", and reads the other Tasks (possibly in other Projects) from the task collection with an `inArray` on their ids.
- **Writes.** "Add relation" and "remove relation" are Procedures in `withTxid` that return `{ txid }`. The collection handlers wait with `awaitTxId`.
  - **Checks:**
    - Both Tasks must be in the caller's Workspace.
    - Projects may differ, and archived Projects are refused as for any task write.
    - The permission is `task: update`.
  - **Errors:** a duplicate row is detected by the unique index and returned as a typed error (no SELECT before the INSERT). Self-relations and Tasks from other Workspaces get typed errors too.
- **"blocks" cycle guard.** Adding a `blocks` relation takes a Workspace-scoped `pg_advisory_xact_lock`. A recursive CTE then refuses the relation if the target already reaches the source through `blocks` edges.

### Blocked mark (in the tasks Vertical)

- **Schema.** The task row gains `open_blocker_count`, an integer defaulting to 0, added to the tasks Shape's column schema.
- **Counter.** A blocker is open when its `completedAt` and `archivedAt` are both null. The counter is recomputed from the actual rows: the number of `blocks` relations targeting the Task whose source is open. It is never adjusted by ±1.
- **Concurrency uses row locks, with no Workspace lock:**
  - **Adding or removing a relation:** take `FOR SHARE` on the blocker's task row, write the relation, then recompute the target.
  - **Move that changes open/closed, archive, unarchive, and bulk Column changes:** these already UPDATE the blocker's row and so hold its lock. After the update they recompute every Task it blocks, in a new statement, so a relation committed just before is seen.
  - **Delete a blocker:** collect its targets, delete it (relations cascade), recompute the targets.
  - Targets may be in other Projects. Updating their counter needs no lock on their Project.
  - Moves that don't change open/closed do no extra work.

### History

`taskEventSchema` gains these types. Each event is written in the same transaction, on the Task's own row with that Task's Project:
- `parent`, on the child: from and to Ticket ids, either of which may be empty
- `subtask_added` and `subtask_removed`, on the parent: the child's Ticket id
- `relation_added` and `relation_removed`, on both Tasks: the type, the direction as seen from that Task, and the other Task's Ticket id

Ticket ids are stored as snapshots, as `duplicated` already does. The system's own counter updates write no history.

### MCP

- `create_tasks` and `update_tasks` accept `parentId` as a Ticket id; `null` clears it on update.
- A new `manage_relation` tool (add and remove) takes Ticket ids and a type, shaped like `manage_link`.
- `get_task` returns the parent, the subtask counts, the open-blocker count and the relations, each with the other Task's Ticket id, title and direction.
- `list_tasks` returns the parent and the counters.

### Web (tasks Vertical)

- **Sheet sections:**
  - **Sub-tasks:** the list, inline create, set parent and remove parent.
  - **Relations:** grouped as above, with add and remove.
- **Pickers:**
  - The parent picker searches the same Project, minus the Task itself and its descendants.
  - The relation picker searches the Workspace through the existing search Procedures, as ticket references in the editor already do, minus the Task itself and Tasks already linked with the chosen type.
- **Card and list-row chips:**
  - subtask progress, shown when the total is above 0
  - the blocked mark with an open-blocker tooltip, shown when the count is above 0
  - the parent's Ticket id on a subtask
  
  All of them read only the task row. Check them against DESIGN.md and the coss components.
- **Not built:** nested subtasks in the list view, and a toggle to hide subtasks.

### Kaneo patterns not copied

- subtasks stored as a relation type, which lets a Task have several parents
- an untyped relation-type column
- duplicates guarded by a SELECT before the INSERT
- no cycle guard
- server-side GROUP BY counts plus cache invalidation for parent boards in other Projects
- a picker limited to the current Project while the API accepts any

### Docs

- A new ADR (0008, subtasks and relations) records the decisions above. ADR 0004 listed subtasks and relations as "not now"; the new ADR overrides that.
- The CONTEXT.md glossary gains Subtask, Parent, Relation (blocks, related, duplicate) and Blocker (open blocker).
- The Task history entry in the glossary lists the new event types.

## Testing Decisions

**What a good test is.** It checks behaviour a caller can see:
- what a Procedure returns or refuses
- the rows a Member can then read
- what a page shows

It never checks how a counter is computed internally. Recompute helpers, CTEs and lock order get no tests of their own; the Procedure tests cover them.

### API integration (main seam)

Tests call the oRPC router client against a real database, using the existing tasks, projects and history helpers. Prior art: the task-links, tasks, task-history and comments integration tests.

**Subtasks:**
- A parent from another Project is refused.
- A Task as its own parent, and cycles of depth 2 and 3, are refused.
- After each of these, the counters are right, including on the old parent after a re-parent:
  - create, close, reopen, cancel
  - archive, unarchive, delete, re-parent
  - a Column's category change and a Column delete
- Deleting a parent leaves its children as top-level Tasks.
- Duplicating a subtask makes a sibling and increases the parent's total. Duplicating a parent copies no children or relations.
- History events land on both the child and the parent.
- The `txid` equals the row's `xmin`.

**Relations:**
- All three types can be created.
- Adding a `related` link from either Task gives one row.
- Self-relations and duplicate rows are refused with typed errors.
- `blocks` cycles of length 2 and 3 are refused, including across Projects.
- A Task in another Workspace is refused.
- Deleting either Task removes the relation.
- History events land on both Tasks, including across Projects.
- Viewers are refused.

**Blocked mark:**
- `open_blocker_count` follows each of these:
  - relation add and remove
  - blocker close, reopen, cancel
  - blocker archive, unarchive, delete
  - a blocker in another Project
- **Race:** start "A blocks B" and "close A" at the same time, in both orders. B must end at 0.
- A move between two open Columns changes no other row.

### Shape scoping

- The relations Shape returns only relations from Workspaces the user belongs to.
- Prior art: the shape-proxy and workspace-read-boundaries integration tests.

### MCP endpoint

- `parentId` on `create_tasks` and `update_tasks`, both setting and clearing.
- `manage_relation` add and remove.
- `get_task` and `list_tasks` output.
- Typed errors come back as tool errors.
- Prior art: the MCP endpoint integration test.

### End-to-end (Playwright)

One new spec covering:
- adding a subtask inline
- the progress chip updating with the done group collapsed
- setting and clearing a parent
- adding a cross-Project `blocks` relation and seeing the blocked mark appear on the board, then disappear when the blocker is closed
- the pickers leaving out invalid choices

Prior art: the tasks, history and comments e2e specs.

### Unit tests

If the pickers' exclusion rule ends up as a pure helper (no self, no descendants, no existing links), it gets a small unit test next to it. No other unit tests.

## Out of Scope

- Marking a Task as a duplicate automatically moving it to a canceled Column (MOR-43).
- Export and import of parents and relations (MOR-49).
- Enforcement: refusing to start a blocked Task, or to close a parent with open subtasks.
- Automation: closing a parent when its last subtask closes.
- Subtasks in a different Project from their parent, and moving Tasks between Projects.
- Nesting subtasks in the list view, a toggle to hide subtasks, and filtering the board by parent or by blocked state.
- Copying a Task's tree or relations when it is duplicated.
- Relations between Workspaces.
- An all-tasks or my-tasks page.

## Further Notes

- MOR-45 and MOR-46 can be built in parallel. MOR-47 depends on MOR-46. MOR-48 depends on all three.
- MOR-4's original note said subtask counts would be computed in the browser. That was replaced: the board loads done and canceled groups only when expanded, so counting in the browser would come out too low. Stored counters follow the existing `checklistDone` and `commentCount` pattern.
- Every write that changes a counter writes a task row, so the change travels on the existing tasks change stream; there is no new long-poll for counters.
