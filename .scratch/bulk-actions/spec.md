# Bulk select and bulk actions

Status: shipped

Ticket: MOR-3. Follow-up: MOR-50 (batches across Projects, once views land).

## Problem Statement

Every change to a Task is made one Task at a time. Triaging a Backlog, closing out a sprint or handing a set of Tasks to a new Assignee means opening each card or row and repeating the same edit. With dozens of Tasks this is slow and easy to get wrong, and a partial result (half the Tasks moved) is hard to spot.

## Solution

On the board and the list of a Project, a Member selects several Tasks and applies one action to all of them: move to a Column, set Priority, set the Assignee, set or clear the due date, add or remove a Label, archive or unarchive, or delete.

Selection works the way Linear's does. While anything is selected, the task shortcuts and the right-click menu Morrow already has act on the whole selection and open the same shared pickers. A slim floating chip shows how many Tasks are selected and holds buttons for the same pickers, archive, delete and clear. Each action lands as one write. Either every selected Task changes or none does, and every Task's history records its own change.

## User Stories

1. As a Member, I want to tick a checkbox that appears when I hover a card or row, so that I can select a Task with the mouse.
2. As a Member, I want to press `X` on the focused Task to add it to or remove it from the selection, so that I can select without the mouse.
3. As a Member, I want Cmd/Ctrl-click on a Task to toggle it in the selection, so that I can pick Tasks that are not next to each other.
4. As a Member, I want Shift-click to select every Task between the last one I selected and the one I click, within one board Column, so that I can grab a run of cards quickly.
5. As a Member, I want Shift-click in the list to select the range across the list's order, including across groups, so that a range matches what I see.
6. As a Member, I want `Mod+A` to select every Task currently shown, so that I can act on everything a filter leaves visible.
7. As a Member, I want `Mod+A` to skip Tasks in collapsed or unloaded groups, so that I never act on Tasks I cannot see.
8. As a Member, I want `Esc` to clear the selection, so that I can back out quickly.
9. As a Member, I want a chip showing "N selected", so that I always know how many Tasks an action will touch.
10. As a Member, I want the chip to have buttons for Column, Priority, Assignee, Labels, due date, archive and delete, so that I can find bulk actions without knowing the shortcuts.
11. As a Member, I want `S`, `P`, `A`, `L` and `Shift+D` to open the usual picker and apply my choice to every selected Task, so that bulk edits feel like single edits.
12. As a Member, I want `I` to assign every selected Task to me, so that I can take a batch of work in one keystroke.
13. As a Member, I want `Mod+Backspace` to ask to delete every selected Task, so that I can clear out a batch.
14. As a Member, I want right-clicking a selected Task to give a menu that acts on the whole selection, so that the context menu matches what is highlighted.
15. As a Member, I want right-clicking a Task outside the selection to act on that Task only and keep my selection, so that a quick one-off edit does not lose my work.
16. As a Member, I want the selection to win over keyboard focus, so that a shortcut never edits a single focused Task when I have a selection.
17. As a Member, I want the Task open in the sheet to stay the target of the sheet's own shortcuts, so that editing in the sheet behaves as before.
18. As a Member, I want `Esc` to close the open sheet first and clear the selection only on a second press, so that closing a sheet does not drop my selection.
19. As a Member, I want the selection to shrink when a filter or search hides selected Tasks, so that the count and the action only cover what I see.
20. As a Member, I want a Task someone else deletes or moves out of the Project to leave my selection, so that the count stays true.
21. As a Member, I want the selection to clear when I switch Project or switch between board and list, so that an old selection never carries into a new view.
22. As a Member, I want selecting more than 200 Tasks to remain possible but the actions to be disabled with "Select up to 200 tasks", so that I understand why nothing happens instead of acting on an arbitrary part.
23. As a Member, I want moving a selection to a Column to put the Tasks at the end of that Column in the order I saw them, so that the result is predictable.
24. As a Member, I want selected Tasks already in the target Column to stay where they are, so that a move does not reshuffle them.
25. As a Member, I want moving a selection into a done or canceled Column to stamp each Task completed, so that bulk closing counts the same as closing one by one.
26. As a Member, I want the Label picker to show a Label as checked when every selected Task has it, indeterminate when some do, and empty when none do, so that I can see the current state of the batch.
27. As a Member, I want clicking an indeterminate or empty Label to add it to every selected Task, and clicking a checked Label to remove it from all of them, so that one click makes the batch consistent.
28. As a Member, I want adding a Label to fail for the whole batch, with the usual "too many labels" error, when any selected Task would go over 20 Labels, so that I never end up with a half-labelled batch.
29. As a Member, I want archive to apply only to the unarchived Tasks in a mixed selection, so that already archived Tasks are left alone.
30. As a Member, I want the action to read "Unarchive" when every selected Task is archived, so that I can bring a batch back from the Archived group.
31. As a Member, I want the other bulk actions to work on archived Tasks too, so that bulk edits match single edits, which allow editing archived Tasks.
32. As a Member, I want a confirm that says "Delete N tasks?" and names up to three ticket ids followed by "and N more", so that I know what I am about to destroy.
33. As a Member, I want the single-Task delete wording when only one Task is selected, so that the dialog stays familiar.
34. As a Member, I want a "Deleted N tasks" toast after a bulk delete, so that I get confirmation of an action I can no longer see.
35. As a Member, I want the sheet to close if it was showing a Task I just bulk-deleted, so that I am not left on a missing Task.
36. As a Member, I want every bulk change to show on screen at once and roll back entirely with an error toast if the server refuses it, so that the board never shows a state that did not happen.
37. As a Member, I want a selected Task that someone else deleted just before my action to be skipped while the rest still change, so that one concurrent delete does not fail my whole batch.
38. As a Member watching the same Project in another tab, I want a bulk change to arrive as one update, so that my board does not flicker through intermediate states.
39. As a Member, I want each Task's history to show the bulk change as an ordinary change to that Task, so that the story of a Task does not depend on how the edit was made.
40. As a Member, I want no history entry for a Task whose value did not actually change, so that bulk actions do not add noise.
41. As a Member reading the Workspace activity feed, I want one entry per Task completed, canceled or deleted in a batch, so that the feed reads the same as for single actions.
42. As a Member with only `task: update`, I want bulk-assigning to myself to work while bulk-assigning to someone else is refused, so that the Assignee rules hold for batches.
43. As a Member without `task: delete`, I want bulk delete to be unavailable, so that a batch cannot get around my role.
44. As a Viewer, I want no selection actions offered, so that I am not shown edits I cannot make.
45. As a Member of an archived Project, I want bulk edits blocked as single edits are, so that a frozen Project stays frozen.
46. As a keyboard user, I want `X` and `Mod+A` listed in the shortcut help, so that I can discover selection.

## Implementation Decisions

### Shared constant

- A new `MAX_BULK_TASKS = 200` lives in the sync-schemas package and is used by both the API and the web app.

### Procedures

- Two new Procedures in the tasks Vertical:
  - `tasks.bulkUpdate` takes `{ workspaceId, projectId, taskIds, change }`. `change` is a discriminated union:
    - `move { columnId }`
    - `priority { priority }`
    - `assignee { assigneeId | null }`
    - `dueDate { dueDate | null }`
    - `addLabel { labelId }`
    - `removeLabel { labelId }`
    - `archive { archived: boolean }`
  - `tasks.bulkRemove` takes `{ workspaceId, projectId, taskIds }`.
- `taskIds` holds 1 to `MAX_BULK_TASKS` ids. Duplicates are removed and the order is kept, because `move` uses it.
- Both return `{ txid, skipped }`. `skipped` counts ids that are no longer Tasks of the Project.
- A batch belongs to one Project. The handler locks the Project once, the same project lock every single-Task operation takes, and the lock also enforces the archived-Project rule.
- Permissions are checked per `change.type`:
  - `task: update` for every `bulkUpdate` change.
  - `assignee` to anyone but the caller also needs `task: assign`, the same rule as the single assign.
  - `bulkRemove` needs `task: delete`.
- The whole batch runs in one `withTxid` transaction, so the collection waits on one txid.
- Stale ids are skipped, not fatal. Real violations roll back the whole batch with the existing typed errors:
  - a Label that would take any Task over the per-Task limit (`LABEL_LIMIT_REACHED`)
  - an Assignee who cannot be assigned
  - a Column outside the Project
  - a Label outside the Workspace
- **Move:** the server computes positions. It appends the moving Tasks after the target Column's last position, counting archived Tasks so slots never collide, in the order `taskIds` gives. Tasks already in the target Column are left alone. `completedAt` follows the same rule as a single move: set on entering a done or canceled Column, cleared on leaving one.
- **Labels:** one idempotent update per batch, using the same append-if-absent and remove semantics as the single-Task Label write. The Label gets a share lock while it is applied, so a concurrent Label delete cannot slip in.
- **Task history:** every Task whose value really changed gets the same event a single edit would record (`column`, `priority`, `assignee`, `due_date`, `labels`, `archived`/`unarchived`), recorded inside the transaction. No-ops record nothing. The existing 10-minute folding applies per Task as usual.
- **Workspace activity:** one `task.completed` or `task.canceled` per Task a move closes, and one `task.deleted` per Task removed, recorded inside the transaction.
- The single-Task Procedures and the MCP `update_tasks` tool do not change.

### Web: selection model (new pure module)

- Pure functions over the ordered list of shown Task ids and the current selection:
  - Toggle one Task.
  - Extend a range from an anchor to a target. On the board the range stays inside the target's Column; in the list it follows the flat list order.
  - Select all shown Tasks.
  - Prune to the shown Tasks.
  - Whether the selection is over the cap.
  - Each Label's tri-state across the selected Tasks.
  - Whether the archive action means archive or unarchive.
- A store keyed by Project, built on `useSyncExternalStore` like the existing field-picker and date-picker stores, holds the selected ids and the range anchor. It is not persisted. Changing Project, switching board and list, or signing out clears it. Changes to filters, search, collapsed groups or synced data only prune it.

- Shift-click with no anchor, or an anchor outside the clicked Column (board) or the shown list, selects only the clicked Task and makes it the anchor.

### Web: write path

- Bulk writes use a TanStack DB optimistic action:
  - `onMutate` applies the change to the Task Synced collection: the field values, and for a move the Column with a provisional position at the end.
  - The mutation function calls `bulkUpdate` or `bulkRemove` once, then waits for the returned txid.
  - If it fails, the whole batch rolls back and an error toast shows.
- Bulk writes do not go through the collection's single-Task update handler, which sends one RPC per Task per field.
- Positions sync replaces the provisional ones with the server's.
- The action always sends ids taken from the pruned selection, so it acts only on Tasks already in the live query and never widens the on-demand read.

### Web: interaction

- `X` and `Mod+A` are added to the hotkey registry in the tasks group.
- While the selection is non-empty, the existing task shortcuts (Column, Priority, Assignee, assign to me, due date, Labels, delete) and the shared right-click menu target the selection. Custom Field and copy actions stay single-Task only.
- Precedence:
  - The selection beats focus.
  - Right-click on a selected Task targets the selection; right-click on an unselected Task targets that Task only.
  - The open sheet keeps its own Task as its shortcut target.
  - `Esc` closes the sheet before it clears the selection.
- The shared field picker gains a bulk mode that applies one choice to many Tasks. The Label picker in bulk mode renders the tri-state.
- A floating chip appears while anything is selected. It shows the count, the action buttons (disabled past the cap, with the hint) and a clear button.
- The delete dialog takes a list of Tasks instead of one Task, with the copy described in the user stories. A successful bulk delete shows the "Deleted N tasks" toast and closes a sheet showing a deleted Task.
- Feedback: writes are optimistic, so only failures and bulk delete show toasts.
- Actions respect the view's existing `can` and `frozen` flags; Viewers get no selection actions.

## Testing Decisions

A good test drives the feature through its public seam and checks behaviour a user or another tab would see: rows, history, activity, the selection a gesture produces. It does not check which helper ran or how many queries were made.

### Seam 1: API integration (main)

A new oRPC integration test for the bulk Procedures, run against a real database through the typed client. It reuses the existing task setup, label factory and history helpers. Cases:

- One txid per batch for each `change.type`.
- Ids that are missing or belong to another Project are skipped and counted; the rest apply.
- A Label that would take any Task over the limit rolls back the whole batch.
- An Assignee who cannot be assigned rolls back the whole batch.
- 201 ids are rejected; 200 are accepted.
- Exactly one history event per Task that really changed, and none for no-ops.
- Move: positions are appended in the order given, after archived positions; Tasks already in the Column don't move; `completedAt` is set and cleared; one `task.completed` or `task.canceled` activity per Task.
- `bulkRemove` deletes the Tasks and records one `task.deleted` per Task.
- Permissions per `change.type`: update, assign to others versus to self, and delete. An archived Project refuses the batch.

Prior art: the existing tasks, labels, task-history and activity oRPC integration tests.

### Seam 2: Web selection module (the only new seam)

Unit tests beside the pure selection module:

- A range within a board Column, and a range across the list order spanning groups.
- Toggling, and select-all of shown Tasks only.
- Pruning when shown Tasks change.
- The cap check.
- Label tri-state for all, some and none.
- Archive versus unarchive for all-archived, mixed and none-archived selections.

Prior art: the existing tests for filters, sort, view order and lane position.

### Seam 3: End to end

One or two Playwright tests added to the tasks spec:

- Shift-click a range of cards, press `P` and pick a Priority. Every selected card changes, and another Member's tab sees the change.
- `Mod+A` in the list, then `Mod+Backspace`. The confirm names the count, and after confirming the "Deleted N tasks" toast shows and the Tasks are gone for the other tab.
- Hotkey precedence (selection versus focus, right-click on a selected versus an unselected Task, `Esc` sheet first) is covered here, not by component tests.

Prior art: the existing two-tab tasks and labels specs.

## Out of Scope

- Batches that span more than one Project (MOR-50, after views land).
- Dragging several selected cards at once on the board.
- Undo for bulk actions.
- Success toasts other than bulk delete.
- Changing the MCP `update_tasks` tool. Its items carry different fields each, so it keeps calling the single-Task Procedures.
- Bulk setting of custom Field values and bulk copy actions.

## Further Notes

- Kaneo's implementation is worth reading for the UX, but not for the design. It takes untyped `operation`/`value` strings, allows batches across Projects with 409 retries, adds Labels in a loop outside a transaction, publishes events after commit, has no cap, gives no position on a Column change, and builds a separate bulk bar with its own popovers. Each of those is decided differently above.
- No existing optimistic-action pattern exists in the web app yet. Load the TanStack DB collection-setup and React DB skills before building the write path, as AGENTS.md requires for the sync layer.
