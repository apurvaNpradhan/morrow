# Tasks

Status: ready-for-agent

## Problem Statement

A Workspace in Morrow has Projects and Columns, but nothing goes in the Columns. The board shows empty lanes, the Project's task counter is never used, and Column delete already takes a "move items to" target for items that don't exist yet. The owner wants tasks now, as the everyday unit of work.

Kaneo, which Morrow started from, has tasks, but it is only a reference, and its task model does not fit Morrow's sync design:

- Several things are stored twice or computed in more than one way:
  - A task stores its state twice: a status slug and a column id.
  - "Done" is computed three different ways.
  - "Planned" and "archived" are fake statuses that throw away the task's column.
- Ordering and loading are expensive:
  - Order is a dense integer, so one drag rewrites whole columns and needs a full-board snapshot to detect conflicts.
  - The whole board, descriptions included, is loaded page by page into the browser.
- Writes and side effects lose data:
  - Small edits go through a full-replace PUT that can revert other people's changes.
  - Side effects run after commit and are lost on a crash.
- Import and export do not round-trip:
  - Import drops labels.
  - It expects internal user ids, while its own dialog shows an email.
  - It runs one transaction per task with no limits, and never shows its warnings.
- Deleting a Project in Morrow is hidden behind archiving, which made sense before Projects held real work.

## Solution

A Project has Tasks.

**What a task is**
- Each task has a ticket id built from the Project key and a per-Project number (`MOR-12`), a title, a markdown description, a priority, one optional assignee and an optional due date.
- A task sits in one Column. Its state is that Column's category; there is no separate status.
- Entering a `done` or `canceled` Column stamps the task as completed, and leaving clears it.
- Tasks can be archived. They leave the board but keep their Column, so unarchiving puts them back where they were.

**How it syncs**
- Tasks reach the browser through one synced collection that loads on demand. Each view loads only the tasks it shows, and every change made in any tab appears live.
- Creating, moving and editing are optimistic. Each edit sends only the fields that changed.

**Project page**
- Board and List layouts, with a toolbar holding a task count, search, filters (with is / is not), sort, and a Display menu.
- The Display menu chooses what cards and rows show. The same choices, plus a default view, appear on the account Preferences page and are remembered per device.

**Creating and editing**
- A create dialog opens from `C`, from a "+" in each column header, or from the command palette. It has a "Create more" option.
- A task opens in a sheet at `/<workspace>/tasks/MOR-12`, over the board or list.
- Cards carry inline chips and a right-click menu.
- Done Columns offer "Archive all completed tasks".

**Import, export and deletion**
- Project settings gain JSON export and import of tasks, done properly: one transaction, limits, matching by name and email, and warnings shown to the user.
- A Project can be deleted directly by typing its key; it no longer has to be archived first.

## User Stories

### Creating tasks

1. As a Member, I want to create a task with a title, so that I can capture work in a Project.
2. As a Member, I want to press `C` anywhere in a Project to open the create dialog, so that capturing work never needs the mouse.
3. As a Member, I want a "+" in every column header (board) and group header (list), so that I can create a task directly in that Column.
4. As a Member, I want a task created with `C` to start in the Project's first `unstarted` Column, so that new work lands where work starts.
5. As a Member, I want to change the target Column in the dialog, so that I can file a task straight into "In Progress" or "Done".
6. As a Member, I want to pick the Project in the dialog when I open it outside a Project, so that I can create tasks from anywhere in the Workspace.
7. As a Member, I want the dialog to show `KEY / New task`, so that I know which Project the task goes to.
8. As a Member, I want to type a title in a large auto-growing field and press Enter to create, so that quick capture is fast.
9. As a Member, I want to write a description in a rich editor inside the dialog, so that I can capture detail up front.
10. As a Member, I want to set priority, assignee and due date from chips in the dialog, so that the task is complete when it is created.
11. As a Member, I want quick due-date picks (Today, Tomorrow, This weekend, Next week, Pick a date, Clear), so that setting a date takes one click.
12. As a Member, I want a "Create more" checkbox that keeps the dialog open and clears the fields except Project and Column, so that I can enter a list of tasks in a row.
13. As a Member, I want Mod+Enter to submit the dialog from any field, so that I don't have to reach for the button.
14. As a Member, I want to be asked before a dialog with unsaved input is discarded, so that I don't lose what I typed.
15. As a Member, I want a toast "MOR-12 created" with an Open action, so that I can jump to the task I just created.
16. As a Member, I want a new task to appear on the board immediately, without waiting for the server, so that creating feels instant.
17. As a Member, I want a new task placed at the bottom of its Column, so that existing order is not disturbed.
18. As a Member, I want each task to get the next ticket number of its Project, never reused, so that ticket ids are stable references.
19. As a Member, I want to create tasks from the command palette, so that every action is reachable from one place.
20. As a viewer, I want create controls hidden, so that I am not offered actions I can't take.

### Ticket ids and the task sheet

21. As a Member, I want every task to have an id like `MOR-12`, so that I can refer to it in conversation and in links.
22. As a Member, I want a task to open in a sheet over the board or list, so that I keep my place.
23. As a Member, I want the address bar to show `/<workspace>/tasks/MOR-12` while the sheet is open, so that I can copy and share the link.
24. As a Member, I want a pasted task link to open the sheet over the board, so that shared links work cold.
25. As a Member, I want an unknown or deleted ticket id to show "not found", so that broken links are clear.
26. As a Member, I want a task's ids to follow its Project key when the key changes, so that ids always match the Project (old ids stop resolving, as ADR 0003 accepts).
27. As a Member, I want to click the ticket id in the sheet to copy it, so that pasting it elsewhere is quick.
28. As a Member, I want "Copy link", "Copy ID", "Copy title" and "Copy as Markdown" actions, so that I can share a task in the form I need.
29. As a Member, I want to edit the title inline in the sheet and have it save when I leave the field, so that renaming is direct.
30. As a Member, I want to edit the description with headings, bold, italic, strike, inline code, code blocks, bullet, numbered and task lists, quotes, links and dividers, so that I can structure notes.
31. As a Member, I want the description to save while I type after a short pause, so that a closed tab or crash does not lose a long edit.
32. As a Member, I want a properties rail (Column, Priority, Assignee, Due date, Created by and when) on wide screens, and chips on small screens, so that the sheet works on any device.
33. As a Member, I want `J`/`K` to move the sheet to the next or previous task in the current view, so that I can triage without closing it.
34. As a Member, I want Esc to close the sheet and return focus to the card or row, so that keyboard flow is not lost.
35. As a Member, I want to archive or delete a task from the sheet's ⋯ menu, so that I can act on the task I'm reading.
36. As a viewer, I want to read every task in the sheet without edit controls, so that I can follow the work.
37. As a Member, I want a task in an archived Project to be read-only, so that archived Projects stay frozen.

### Board

38. As a Member, I want the board to show each Column as a lane with its tasks in order, so that I can see the workflow at a glance.
39. As a Member, I want each lane header to show the Column name, its colour and icon, and its task count, so that I know how much is in each step.
40. As a Member, I want to drag a card within a lane to reorder it, so that priority within a step is visible.
41. As a Member, I want to drag a card to another lane to move it, so that moving work forward is one gesture.
42. As a Member, I want a moved card to stay where I dropped it while the server confirms, and to roll back if the server refuses, so that the board is fast but never lies.
43. As a Member, I want two people reordering at once to never block later moves, so that ordering never gets stuck.
44. As a Member, I want to move cards with the keyboard as well as the pointer, so that the board is accessible.
45. As a Member, I want each card to show the ticket id with the assignee's avatar, the title (up to three lines), and chips for priority, due date and checklist progress, so that the card holds what I need to scan.
46. As a Member, I want the due-date chip to read "3d overdue", "2w overdue", "Today", "Tomorrow", "In 4 days" or a date, and to turn red when overdue by my local date, so that urgency is obvious.
47. As a Member, I want checklist progress ("2/5") on a card when the description has task-list items, so that I can see partial progress.
48. As a Member, I want to click a chip on a card to change that field in place, so that small edits don't need the sheet.
49. As a Member, I want done and canceled cards to look muted and hide their chips, so that finished work recedes.
50. As a Member, I want a right-click menu on a card with Copy link, Priority, Column, Due date, Assignee, Duplicate, Archive and Delete, so that every common action is one menu away, also without dragging.
51. As a Member, I want "Duplicate" to create a copy titled "<title> (copy)" in the same Column, so that I can reuse a task as a template.
52. As a Member, I want an archive button in the header of `done` and `canceled` Columns that archives every task in that Column after a confirmation, so that I can clear finished work in one step.
53. As a Member, I want the project background behind the board when set and enabled on my device, as today, so that the board keeps its look.

### List

54. As a Member, I want a list layout that groups tasks by Column in board order, so that I can scan many tasks densely.
55. As a Member, I want each row to show priority, ticket id, title with checklist progress, due date and assignee, so that rows carry the same information as cards.
56. As a Member, I want to collapse and expand groups, so that I can focus on some Columns.
57. As a Member, I want `done` and `canceled` groups to start collapsed and load only when I expand them, so that opening the list is as fast as the board.
58. As a Member, I want an "Archived" group at the bottom of the list, loaded only when expanded, so that archived tasks are reachable but out of the way.
59. As a Member, I want to unarchive a task from its context menu, so that it returns to the Column it was in.
60. As a Member, I want to drag rows to reorder or move them in the list, so that the list is as capable as the board.
61. As a Member, I want the same row context menu and inline chips as on cards, so that both layouts behave the same.

### Toolbar: count, search, filter, sort, display

62. As a Member, I want the toolbar to show "N tasks", or "N of M tasks" when search or filters hide some, so that I know when I'm not seeing everything.
63. As a Member, I want to search tasks in the Project by title, ticket number (`MOR-12`, `#12`, `12`) or description, so that I can find a task quickly.
64. As a Member, I want Mod+F to open the search and Esc to clear it, so that search is one keystroke away.
65. As a Member, I want to filter by Assignee (including Unassigned and me), Priority, Due date (overdue, this week, next week, no due date) and, in the list, Column, so that I can see the slice I care about.
66. As a Member, I want each filter to be "is", "is not", "is any of" or "is none of", so that I can exclude as well as include.
67. As a Member, I want active filters shown as chips I can edit or remove, plus "Clear all", so that a hidden filter is never forgotten.
68. As a Member, I want my filters remembered per Project on this device, so that my view of a board persists.
69. As a Member, I want `F` to open the filter menu, so that filtering is keyboard-friendly.
70. As a Member, I want to sort by Manual, Created, Priority, Due date, Title or Task number, ascending or descending, so that I can order the view for the question I'm asking.
71. As a Member, I want tasks without a due date to sort last when sorting by due date, so that dated work comes first.
72. As a Member, I want my sort remembered per Project on this device, so that I don't set it again.
73. As a Member, I want dragging to only change the Column while a non-manual sort is on, so that I can still move work without fighting the sort.
74. As a Member, I want a Display menu (`Shift+V`) with Board / List, Sort, "Show on cards/rows" toggles (Task numbers, Assignees, Due dates, Priority, Checklist progress), Project background and Reset, so that I control how dense the view is.
75. As a Member, I want `/<workspace>/projects/<KEY>` to open the layout I last used on this device, so that the Project opens the way I work.
76. As a Member, I want board and list to have their own URLs, so that I can bookmark either.

### Preferences

77. As a user, I want a "Task details" section on my Preferences page with the same "show on cards and rows" toggles and a Reset button, so that I can set them once for all Projects.
78. As a user, I want a "Default view: Board | List" preference that reflects and sets the layout I last used, so that I can see and change it in one place.
79. As a user, I want these preferences kept on this device and not cleared at sign-out, like my other device preferences, so that a shared browser keeps its look.

### Assigning, priority and dates

80. As a Member, I want to assign a task to myself or unassign myself without any special permission, so that I can pick up work.
81. As an Admin, I want only roles with `task: assign` to assign other people, so that work is handed out deliberately.
82. As a Member, I want `I` to assign the focused task to me, so that taking work is one key.
83. As a Member, I want the assignee picker to list current Members only, so that tasks can't be assigned to outsiders.
84. As a Member, I want tasks assigned to someone who leaves the Workspace to become unassigned, so that nothing points to a former member.
85. As a Member, I want priorities None, Low, Medium, High and Urgent with distinct icons, so that importance is visible.
86. As a Member, I want due dates to be calendar days, not times, so that "due tomorrow" means the same day for everyone.

### Completion and archive

87. As a Member, I want a task moved into a `done` or `canceled` Column to record when it was completed, and moving it back out to clear that, so that completion is always accurate.
88. As a Member, I want changing a Column's category to update the completion of every task in it, so that recategorising a Column is consistent.
89. As a Member, I want deleting a Column to move its tasks to the end of the target Column in their existing order, with completion updated for the target's category, so that nothing is lost.
90. As a Member, I want archived tasks to keep their Column, so that unarchiving puts them back exactly where they were.
91. As a Member, I want archived tasks to stay editable, so that I can fix something without restoring it first.
92. As a Member, I want archiving and unarchiving kept out of the activity feed, so that clean-ups don't flood it.

### Deleting

93. As an Admin, I want to delete a task after a confirmation, so that mistakes can be removed.
94. As a Member, I want delete hidden when my role lacks `task: delete`, so that I see only what I can do (I can move a mistaken task to a `canceled` Column instead).
95. As a Member, I want Mod+Backspace to delete the focused task after confirmation, so that cleanup is fast.

### Keyboard

96. As a Member, I want `J`/`K` and the arrow keys to move focus between tasks, Enter to open and Esc to close, so that I can work the board from the keyboard.
97. As a Member, I want `S`, `P`, `A` and `Shift+D` to open the Column, priority, assignee and due-date pickers for the focused task, so that triage is fast.
98. As a Member, I want task shortcuts listed in the shortcuts help, so that I can learn them.
99. As a Member, I want `P C` to create a Project now that `C` creates a task, so that both stay on the keyboard.
100. As a Member, I want to type `MOR-12` in the command palette to jump to that task, so that ticket ids are navigable.

### Live sync

101. As a Member, I want tasks another Member creates, edits, moves, archives or deletes to appear in my board, list and sheet without a reload, so that we work from the same picture.
102. As a Member, I want opening a Project to load only that Project's visible tasks, so that large Workspaces stay fast.
103. As a user, I want tasks removed from my browser when I sign out or lose membership, so that no data stays behind.

### Activity

104. As a Member, I want task creation, completion, cancellation and deletion in the Workspace activity feed, so that others see what moved.
105. As a Member, I want field edits and reorders kept out of the feed, so that it stays readable.

### Import and export

106. As a Member, I want to export a Project's tasks to a JSON file from Project settings, so that I have a portable copy.
107. As a Member, I want the export to include Columns by name and category, and each task's number, title, description, Column, priority, due date, assignee email, completion, archive and creation times, so that the file is complete and readable.
108. As a Member, I want to import tasks from a JSON file in the same format, so that I can move work between Projects or instances.
109. As a Member, I want imported tasks matched to Columns by name, then by category, then to the first `unstarted` Column, so that imports land sensibly.
110. As a Member, I want imported assignees matched to Members by email, so that assignments survive the move.
111. As a Member without `task: assign`, I want assignees dropped from an import with a warning rather than the import failing, so that I can still import.
112. As a Member, I want an import to succeed completely or not at all, so that a failed import leaves no half state.
113. As a Member, I want the import to reject files over 5 MB or 5,000 tasks with a clear message, so that the server stays healthy.
114. As a Member, I want the import dialog to list every warning (unmatched Column, unknown assignee, dropped assignee), so that I know what changed.
115. As a Member, I want imported tasks to get new ticket numbers, so that numbers stay unique in the Project.
116. As a viewer, I want to export but not import, so that read access is enough to take a copy.

### Projects (revisions)

117. As an Admin, I want to delete an active Project without archiving it first, by typing its key to confirm, so that deletion is deliberate but not hidden.
118. As a Member, I want a ⋯ menu on each sidebar Project with View, Copy link, Settings, Archive and (with permission) Delete, so that Project actions are close at hand.
119. As an Admin, I want deleting a Project to delete its tasks, so that nothing is left behind.
120. As a Workspace owner, I want deleting the Workspace to delete all Projects and tasks, so that nothing is left behind.

### Data, MCP and lifecycle

121. As a user, I want my account data export to include the tasks of my Workspaces, so that the export is complete.
122. As an MCP agent, I want a read-only `list_tasks` tool for a Project that returns each task with its ticket id, Column, category, priority, assignee, due date, completion and archive state, so that I can understand the work in a Project.
123. As the owner, I want existing Workspaces' default Member and Admin roles to receive the new task grants, so that tasks work in Workspaces created before this change.

## Implementation Decisions

### Step zero: on-demand sync spike (gating)

Before building, a throwaway prototype has to show five things with the real stack (Electric through the shape proxy, the installed TanStack DB):

1. A `tasks` collection with `syncMode: "on-demand"` loads one Project's tasks through `useLiveSuspenseQuery` with a `where` on `projectId`.
2. The proxy forwards Electric's `subset__*` parameters (it already allows them), and a subset is always narrowed by the shape's membership filter. A subset for another Workspace's Project returns nothing.
3. `awaitTxId` resolves for a Procedure write while the stream runs with `log=changes_only`.
4. Inserts into another Project, which arrive through the change stream, do not break or wrongly show up in the open Project's queries.
5. Sign-out cleanup clears the collection.

Delete the prototype afterwards. If any point fails, fall back to one eager shape per Project: `defineShape` gains declared, validated parameters (`projectId`), and the proxy passes them to `where`; collections are created per Project and garbage-collected. The rest of this spec does not change, and the decision is recorded in ADR 0004.

### Vertical and domain language

- Add a new `tasks` Vertical in the API and the web app. Other Verticals import only its `index.ts`.
- Add **Task**, **Ticket id**, **Assignee**, **Priority**, **Completed task** and **Archived task** to `CONTEXT.md`.
- Write ADR 0004 "Tasks". It records the model, `completedAt`/`archivedAt`, ordering, permissions, on-demand sync, the comparison with Kaneo and the spike's result.
- Amend ADR 0001: the browser may narrow a shape with subset queries but never widen it; an on-demand collection is allowed. AGENTS.md's Sync section gets the same note.
- Amend ADR 0003: an active Project can be deleted directly, with a type-the-key confirmation.

### Task table

Columns: `id, projectId, columnId, number, title, description, priority, assigneeId, dueDate, position, completedAt, archivedAt, createdBy, createdAt, updatedAt`.

- **`id`:** text, cuid2 format. The browser picks it on create. The server validates the format, and a primary-key collision is a typed error.
- **`projectId`:** foreign key to the Project, cascade delete. **`columnId`:** foreign key to a Column of the same Project, NOT NULL. Column delete moves tasks first, so the foreign key is restrict, not set null. There is no `workspaceId` column; the Workspace comes through the Project.
- **`number`:** integer, NOT NULL, unique on `(project_id, number)`. Create allocates it in the write transaction with `UPDATE project SET last_task_number = last_task_number + 1 … RETURNING`, which also serialises creates within a Project. Numbers are never reused.
- **`title`:** 1–500 characters after trim. **`description`:** markdown text, NOT NULL default empty, at most 100,000 characters.
- **`priority`:** text with a CHECK for `none | low | medium | high | urgent`, default `none`. The list is shared by API and web in `@morrow/sync-schemas`.
- **`assigneeId`:** nullable foreign key to the user. It must be a current Member when set. Removing a Member sets their tasks' assignee to null in the same transaction as the removal.
- **`dueDate`:** Postgres `date`, nullable, carried as a `YYYY-MM-DD` string in the shape and parsed as a calendar date, never a timestamp.
- **`position`:** `text COLLATE "C" NOT NULL`, unique on `(column_id, position)`, using the same fractional-index rules as Projects and Columns:
  - the client generates the key;
  - the server validates the format;
  - the unique index rejects duplicates as `POSITION_TAKEN`;
  - the web app compares with `<` and sorts in JavaScript.
- **`completedAt`:** timestamptz, nullable. Every write that changes `columnId` sets it to now when the new Column's category is `done` or `canceled` and the old one's was not. It clears it when the task leaves those categories, and leaves it unchanged between two closed Columns. The same rule runs for a Column's category change (all its tasks) and for Column delete (tasks moved to the target).
- **`archivedAt`:** timestamptz, nullable. Archive keeps `columnId` and `position`.
- **`createdBy`:** nullable foreign key to the user, set null on user delete.
- Indexes: `(project_id)`, `(column_id)`, `(assignee_id)`, plus the two unique indexes above.
- One Drizzle migration creates the table and makes it synced: `REPLICA IDENTITY FULL`, `ALTER PUBLICATION electric_publication_default ADD TABLE`, `GRANT SELECT … TO electric`. The same migration back-fills the task grants into existing roles (next section).

### Permissions

- New resource `task: ["create", "update", "delete", "assign"]` in the permissions package, with matching capabilities for the web app (`createTasks`, `editTasks`, `deleteTasks`, `assignTasks`).
- Viewer: none; read comes from membership. Member: create, update. Admin and Owner: all four.
- `update` covers title, description, priority, due date, Column and position moves, archive and unarchive, and duplicate (which also needs `create`).
- Assignment:
  - Setting `assigneeId` to yourself, or clearing it when it is yourself, needs `update` (or `create` on create).
  - Any other change needs `assign`, and so does setting someone else on create.
- Every task write locks the Project row with the existing Project lock, which rejects writes to an archived Project.
- The migration adds `task` grants to the default Member and Admin roles of existing Workspaces, the same way the project migration did. Custom roles are not touched.

### Sync

- **Shape:** `tasks`, declared in the Vertical's shapes and added to the registry. Its name and column schema are one object in `@morrow/sync-schemas`, and it includes every task column. The filter is `project_id IN (SELECT id FROM project WHERE workspace_id IN (<the user's member Workspaces>))`. Archived tasks are included in the shape.
- **Collection:** one `tasks` collection in the web Vertical's `collections/`, built with `shapeOptions`, `syncMode: "on-demand"` and `registerSyncedCollection`.
  - Every read is a live query with a `where`.
  - The board and `J`/`K` navigation query `projectId = X AND archivedAt IS NULL`.
  - The list's done/canceled groups query by `columnId` only when expanded.
  - The Archived group queries `projectId = X AND archivedAt IS NOT NULL` only when expanded.
  - The sheet queries by `projectId` and `number`.
  - Sorting is always done in JavaScript.
- **Loaders:** route loaders preload the board's query, so `useLiveSuspenseQuery` does not suspend twice.
- **Writes:** each is a Procedure in `withTxid` that returns `{ …, txid }`.
  - Collection `onUpdate` splits a change into field groups and calls one Procedure per group: title; description; priority; due date; assignee; move (Column and position); archive or unarchive. It then waits with `awaitTxId`.
  - `onInsert` calls create with the client-chosen id, Column and position.
  - `onDelete` calls delete.
- **Description autosave:** TanStack DB paced mutations with a debounce of about one second. It is last-write-wins; there is no collaborative editing.
- **Task numbers:** the number exists only after the server replies. While a new card is pending, its id shows as `KEY-…`.
- **Server-side reads:** `tasks.list` is one oRPC Procedure that reads the table. It is a deliberate exception to "a Shape or a query, never both", the same as `projects.list`: MCP and the account export run on the server. The web app never calls it.

### Procedures

All are workspace-context oRPC Procedures with permission checks, in `withTxid`.

- `create`: id, projectId, columnId, position, title, description?, priority?, assigneeId?, dueDate?. It allocates the number and sets `completedAt` if the Column is closed.
- `update`: one Procedure per field group, as listed under Sync.
- `move`: columnId, position. It applies the `completedAt` rule.
- `archive`, `unarchive`.
- `archiveColumn`: columnId. It archives every unarchived task in a `done` or `canceled` Column in one transaction and returns the count.
- `duplicate`: id, new id, position. It copies title + " (copy)", description, priority, assignee (subject to the assign rule) and due date into the same Column.
- `delete`.
- `export`: projectId. Returns the export document.
- `import`: projectId plus the document. Returns `{ created, warnings[], txid }`.
- `list`: server-side reads only.
- **Typed errors:** task not found, invalid id, id taken, invalid title, description too long, invalid priority, invalid due date, invalid position, position taken, column not in project, assignee not a member, forbidden assign, project archived, column not closed (for `archiveColumn`), import too large, import invalid.
- **Column delete:** the existing Procedure now moves the deleted Column's tasks to the target in the same transaction:
  - they are appended after the target's last position;
  - their relative order is kept;
  - keys come from `generateNKeysBetween`;
  - `completedAt` is reconciled.
- **Column category change:** the existing move Procedure reconciles `completedAt` for all tasks of the Column.
- **Project delete:** no longer requires the Project to be archived. The web app asks for the key to be typed. Cascade removes tasks.

### Activity

- New events: `task.created`, `task.completed` (entered a `done` Column), `task.canceled` (entered a `canceled` Column) and `task.deleted`. They carry the ticket id and title.
- They are recorded in the same transaction through the existing workspace activity recording.
- `resourceType` gains `"task"`.
- Moving back out of a closed Column, field edits, reorders, archive and unarchive are not recorded.

### Import and export

- **Document format:** `{ project: { key, name }, columns: [{ name, category }], tasks: [{ number, title, description, column, category, priority, dueDate, assigneeEmail, completedAt, archivedAt, createdAt }] }`. It is downloaded as `KEY-tasks.json`.
- **Permissions:** export needs read (membership); import needs `task: create`.
- **Validation:** with Zod, at most 5,000 tasks and 5 MB, and everything in one transaction.
- **Column matching:** by exact name, else by category (first Column of that category), else the first `unstarted` Column, with a warning for anything not matched by name.
- **Assignees:**
  - matched by email to a current Member; unknown emails are dropped with a warning;
  - without `assign`, every assignee except the importer is dropped with one warning.
- **Numbers and positions:** numbers are newly allocated. Positions are appended per Column in the file's order. `completedAt` follows the Column rule; `archivedAt` is kept from the file.
- **UI:** a "Tasks" section in Project settings → General with Export and Import rows. The import dialog takes a file by drop or picker and shows the result with every warning.

### Web: routes and screens

- **Project routes:**
  - `/$slug/projects/$key` redirects to `/board` or `/list` according to the device preference `taskView`.
  - `/$slug/projects/$key/board` and `/$slug/projects/$key/list`. Switching layout updates the preference.
- **Task route:** `/$slug/tasks/$ticketId`, where the ticket id is `KEY-N`.
  - It is reached through route masking: opening a task from a view navigates within that view, and the URL shows the task route.
  - A cold load renders the sheet over the Project's board.
- **Header:** the project header keeps its breadcrumb row. A toolbar row below it holds the task count, search (Mod+F), Filter (`F`) and Display (`Shift+V`), and an active-filter chip row appears when filters exist.
- **Search:** client-side over loaded tasks, matching title, description and ticket number forms. It is not persisted.
- **Filters:**
  - Subjects: Assignee (Unassigned and a "me" shortcut), Priority, Due date (overdue, this week, next week, no due date), and Column (list only).
  - Operators: is, is not, is any of, is none of. Values within a subject are OR'd; subjects are AND'd.
  - Stored per Project in device storage.
  - "This week" uses the browser's locale week.
- **Sort:**
  - Options: Manual, Created, Priority, Due date, Title, Task number.
  - Direction applies to every option except Manual. Choosing Priority defaults to descending; the others default to ascending.
  - Tasks with no due date always sort last.
  - Stored per Project in device storage.
  - While a non-manual sort is on, drag can only change the Column (the position goes to the end of the target Column), and reordering within a lane is off.
- **Display menu:** Board | List, Sort, "Show on cards" (board) or "Show on rows" (list) toggles for Task numbers, Assignees, Due dates, Priority and Checklist progress, Project background, and Reset (toggles back to on, sort back to Manual).
- **Device preferences:** `taskView`, the five display toggles and the per-Project filters and sorts join the existing device-preference local collection. They are not registered for sign-out cleanup.
- **Preferences page:** gains a "Task details" section ("What shows on cards and rows in your boards and lists.") with the toggles and Reset, and a "Default view" Board | List row.
- **Column and group headers:**
  - Each shows the colour and category icon, name, count (of the tasks shown) and a "+" (with `task: create`) that opens the create dialog preset to that Column.
  - `done` and `canceled` Columns with tasks also get an archive button (with `task: update`). It confirms "Archive {{count}} completed tasks?" and calls `archiveColumn`.
- **Cards:**
  - An ID row with the ticket id and the assignee avatar.
  - The title, clamped to three lines.
  - A chip row with priority, due date and checklist progress. Each chip opens its picker inline.
  - Closed cards are muted and have no chip row.
  - Due-date text is relative and turns red when overdue against the local date.
  - Checklist progress counts markdown task-list items in the description.
- **Rows:** priority icon, ticket id, title and checklist progress, due date and avatar.
- **Context menu**, on both cards and rows:
  - Copy link · Priority ▸ · Column ▸ · Due date ▸ (Today, Tomorrow, This weekend, Next week, Pick a date, Clear) · Assignee ▸ · Duplicate · Archive / Unarchive · Delete….
  - Items are gated by capabilities.
- **Drag and drop:** `@dnd-kit/react`, sortable across lanes, with pointer and keyboard sensors. Positions come from the existing `positionForMove` helper, which skips hidden siblings.
- **Board loading:** lanes render every unarchived task; there is no virtualisation.
- **List:**
  - Groups by Column with collapsible headers.
  - `done` and `canceled` groups start collapsed and query on expand.
  - An Archived group comes last, collapsed, and queries on expand.
  - Rows are draggable under the same rules as the board.
- **Create dialog:**
  - Breadcrumb `KEY / New task`.
  - Auto-growing title, where Enter submits and newlines are stripped.
  - Tiptap description.
  - Chips: Project (only outside a Project) · Column · Priority · Assignee (offered for others only with `assign`) · Due date.
  - Footer: "Create more", Cancel, Create task. Mod+Enter submits.
  - "Create more" keeps the dialog open and resets everything except Project and Column.
  - Closing with unsaved input confirms "Discard task?".
  - On success it closes (unless Create more is on) and shows the "KEY-N created" toast with Open once the number has synced.
- **Task sheet:**
  - Header: `Project › KEY-N` (click to copy the id) · Copy link · ⋯ (Copy ID, Copy title, Copy as Markdown, Archive/Unarchive, Delete) · Close.
  - Body: the title (saves on blur), then the description editor.
  - Properties: a right rail on large screens (Column, Priority, Assignee, Due date, Created by/at), chips on small screens.
  - `J`/`K` move through the current view's visible order.
  - Read-only for viewers and in archived Projects. A banner shows for archived tasks.
- **Editor:** Tiptap 3 with `@tiptap/markdown`. Extensions: headings, bold, italic, strike, inline code, code block (no highlighting), bullet, ordered and task lists, blockquote, link, horizontal rule.
- **Keyboard shortcuts**, all through the command registry with labels in the help panel:
  - `C` creates a task (needs `task: create`); `createProject` moves to `P C`.
  - `F` filter, `Shift+V` display, `Mod+F` search.
  - `J`/`K`/arrows move focus, Enter opens, Esc closes.
  - On the focused task or in the sheet: `S` Column, `P` priority, `A` assignee, `I` assign to me, `Shift+D` due date, Mod+Backspace delete (confirm).
- **Command palette:** "Create task", plus ticket-id jump: typing a `KEY-N` that resolves to a task in the current Workspace offers "Open KEY-N".
- **Sidebar:** each Project gets a ⋯ menu with View, Copy link, Settings, Archive or Unarchive, and Delete (with `project: delete`; type-the-key confirmation).
- **Project Danger zone:** delete is available for active and archived Projects with `project: delete`, behind a type-the-key confirmation.
- **Board placeholder:** the old empty-lane message is replaced with an empty state that leaves the header "+" to create.
- **i18n:** all strings go through the i18n package.

### Lifecycle, MCP and export

- Project delete and Workspace delete remove tasks by cascade.
- Member removal clears assignments, as above.
- The account data export includes the tasks of the user's Workspaces, through `tasks.list`.
- MCP: a read-only `list_tasks` takes `{ projectId }` and returns each task's ticket id, title, Column name and category, priority, assignee (id and name), due date, `completedAt` and `archivedAt`, in board order. It reuses `tasks.list` through the in-process client.

## Testing Decisions

A good test exercises behaviour at the highest available seam and asserts what a caller sees: Procedure results and typed errors, rows in the database, what the shape proxy serves, and what another browser tab shows. It does not test how collections, hooks or components are put together.

### Seam 1: the API in-process with real Postgres

Prior art: `projects-orpc`, `project-columns-orpc`, `projects-role-migration`, `shape-proxy`, `with-txid`, `workspace-read-boundaries`, `account-export`, `activity-orpc`, `mcp-endpoint` in the API integration suite.

- **Create:**
  - It allocates consecutive numbers per Project and never reuses a deleted number.
  - It accepts a client id and position, and returns a txid matching the inserted row.
  - It rejects a malformed id, a taken id, a taken position and a Column of another Project.
- **Field rules:**
  - Title length and trim.
  - Description cap.
  - Priority list.
  - Due date as a calendar date (no timezone shift).
  - Assignee must be a current Member.
- **Assign rule:**
  - A Member can set or clear themselves but not others.
  - An Admin can set anyone.
  - Create with another assignee needs `assign`.
- **Completion:**
  - Moving into `done` or `canceled` sets `completedAt`.
  - Moving between closed Columns keeps it.
  - Moving out clears it.
  - A Column category change reconciles all its tasks.
  - Column delete moves tasks to the end of the target in order and reconciles.
- **Archive:**
  - Archive and unarchive keep the Column and position.
  - `archiveColumn` archives only unarchived tasks of a closed Column and rejects an open Column.
  - Archived tasks remain editable.
- **Archived Project:** every task write fails.
- **Duplicate:** copies the fields into the same Column with a new number and the "(copy)" title.
- **Permissions:**
  - A viewer is forbidden on every write.
  - A Member can create and update but not delete or assign others.
  - An Admin can do everything.
  - A non-member gets "not found".
  - The role migration adds task grants to existing default roles.
- **Member removal:** clears that Member's assignments.
- **Activity:**
  - created, completed, canceled and deleted are recorded with ticket id and title.
  - Edits, reorders and archive are not.
- **Shape proxy:**
  - `tasks` serves only tasks of the user's Workspaces.
  - A subset request for a foreign Project returns nothing.
  - Client-supplied table, columns or filter are ignored.
- **Import and export:**
  - Export → import round-trips fields, Columns and assignees.
  - Name / category / fallback Column matching emits warnings.
  - Unknown emails warn.
  - Assignees are dropped without `assign`.
  - Over-limit files are rejected.
  - A failing row rolls back the whole import.
- **Project delete:** works on an active Project and cascades tasks.
- **Lifecycle:** Workspace deletion removes tasks. The account export includes tasks.
- **MCP:** `list_tasks` returns tasks in board order for a member, and "not found" otherwise.

### Seam 2: Playwright e2e against the compose stack with real Electric and HTTP/2

Prior art: `projects.spec.ts`, `sync.spec.ts`, `sync-workspaces.spec.ts`.

1. A task created in one tab with the dialog ("Create more" on, two tasks) appears in another Member's board without a reload, with ticket ids.
2. Dragging a card to another lane in one tab moves it in the other, and moving it to Done stamps it as completed (muted card).
3. "Archive all completed" removes done cards in both tabs. The task appears under the list's Archived group when expanded, and unarchive returns it to its Column.
4. Opening `/<workspace>/tasks/KEY-N` cold shows the sheet over the board. Editing the title and description there shows live in another tab.
5. A filter (Assignee is me) and a sort (Priority) survive a reload. The chip row shows the filter, and "N of M tasks" is correct.
6. A display toggle (hide due dates) changed on the Preferences page applies to the board.
7. Export then import into another Project creates the same tasks and shows warnings for unmatched Columns.
8. Deleting an active Project with the typed key removes it and its tasks from another tab.

### Unit tests beside pure helpers

- Filter matching (operators, OR within a subject, AND across subjects).
- Sort comparators (priority order, due-date-last, direction).
- Relative due-date text and the overdue check against a local date.
- Checklist progress counted from markdown.
- Search matching (title, description, `KEY-N`, `#N`, `N`).
- Ticket-id parsing.
- Import Column and assignee matching.
- The `completedAt` transition rule.

### Commands

`pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm typecheck`, `pnpm lint` and `pnpm knip` must pass with no new findings.

## Out of Scope

- Bulk selection and the bulk action bar.
- Labels, comments, per-task activity history, mentions, reactions.
- Attachments and images in descriptions (the existing draft-asset upload path stays unused).
- Subtasks and task relations.
- Start dates, time tracking, recurring tasks, due-date reminders and notifications.
- Multiple assignees.
- Moving tasks between Projects.
- A Backlog or "Planned" view (backlog is a Column category).
- An all-tasks / my-tasks page, cross-project views, project progress %, and global task search by title.
- Calendar and Gantt layouts.
- Virtualised lanes.
- Importers from other tools (Linear, Jira, Trello, Plane…), CSV.
- MCP write tools for tasks.
- Public project links, copy-branch-name, Git integrations and workflow automations.
- Onboarding sample tasks.
- Task templates, custom fields.
- Collaborative (multi-cursor) description editing.
- `Mod+B` board/list toggle (it is the sidebar toggle).

## Further Notes

- Kaneo reference points for behaviour and copy only (the data model above replaces theirs):
  - its task card content and chips;
  - its column header (count, "+", archive-all);
  - the Display menu with card-field toggles and sort control;
  - the filter menu, active-filter chips and operator labels;
  - the create-task modal ("Create more", discard confirmation);
  - the task details sheet header and more menu;
  - the project-tasks section with its export/import rows;
  - the preferences page's task-details section.

  Kaneo's i18n file has the strings to adapt.
- Fixed in Morrow compared with Kaneo:
  - One state source (Column category) and a real `completedAt`.
  - Fractional positions (one row per move).
  - Per-field Procedures instead of a full-replace PUT.
  - Activity written in the same transaction.
  - Archive that keeps the Column.
  - Import that is atomic, limited, matches by email and shows warnings.
  - One Procedure for "archive all completed" instead of N calls.
- On-demand sync loads by query, but the change stream carries every task change in the user's Workspaces, so bandwidth scales with how often tasks change, not with how many there are. At personal-instance scale that is small.
- The `tasks` shape is the eighth long-poll on a Workspace page. That is fine behind HTTP/2 (dev Caddy, prod Traefik, the e2e Caddyfile) and would stall on plain HTTP/1.1.
- `dnd-kit` replaces the hand-rolled sortable hook only for tasks in this spec. Moving Projects and Columns onto it is a later clean-up, and the stale `data-morrow-sortable` CSS comment can go then.
- The shortcuts in this spec follow the existing command registry. Task-scoped shortcuts (`S`, `P`, `A`, `I`, `Shift+D`) are active only while a task is focused or the sheet is open.
