# Projects and columns

Status: ready-for-agent

## Problem Statement

A Workspace in Morrow has members, roles and activity, but nothing to organise work in. Kaneo, which Morrow started from, has projects with board columns, and those were removed during the trim. Kaneo is only a reference now, and its model does not fit Morrow's direction as-is:

- Columns have a `slug`, an `isFinal` flag and "virtual" statuses (planned, archived) outside any column, and tasks store both a status text and a column id for the same fact.
- Per-member project access (`all` / `selected`) contradicts the rule that membership implies read, and would make every project shape filter per user.
- Ordering is an integer `position` renumbered under an advisory lock, which turns one drag into a write to every row.
- Archive exists in Kaneo's API but has no UI; moving projects between workspaces, public projects, custom fields and workflow rules add a lot of code for features a personal instance does not need yet.

The owner wants projects and their columns (the workflow) in Morrow now, designed for synced collections, before tasks exist.

## Solution

A Workspace has Projects. A Project has a short uppercase key (`MOR`), a name, description, Lucide icon, optional background image, a task counter for future ticket ids, and can be archived. Each Project has its own Columns; every Column belongs to one of five fixed categories (`backlog`, `unstarted`, `started`, `done`, `canceled`), so projects can name their workflow freely while cross-project views can still group by category.

Both tables are synced Shapes scoped by membership. Every Member sees every Project of their Workspace. Order is a fractional-index key, so a reorder changes one row. Writes go through Procedures that return a txid, and the browser applies them optimistically.

The user gets: a projects list (Active / Archived, drag to reorder), a project page showing the board's columns (empty lanes until tasks exist), a sidebar list of active projects, a create-project dialog, a project switcher in the breadcrumb, and two settings pages per project (General, Workflow) inside the existing settings shell.

## User Stories

1. As a Member, I want to create a Project with a name, so that I have a place to organise work in my Workspace.
2. As a Member, I want the key suggested from the name when I create a Project, so that I do not have to invent one.
3. As a Member, I want to override the suggested key, so that ticket ids read the way I like.
4. As a Member, I want a clear error when the key is already used in this Workspace (including by an archived Project), so that ticket ids never become ambiguous.
5. As a Member, I want keys limited to 2–6 uppercase letters and digits starting with a letter, so that they stay short and readable in URLs and ticket ids.
6. As a Member, I want to pick an icon for a Project from a curated set, so that I can tell Projects apart at a glance.
7. As a Member, I want a Project without an icon to show the first letter of its key, so that it is still recognisable.
8. As a Member, I want to add a description to a Project, so that others know what it is for.
9. As a Member, I want to upload a background image for a Project, so that its board feels like its own space.
10. As a Member, I want to remove a Project's background image, so that I can go back to the plain board.
11. As a Member, I want a replaced or removed background image deleted from storage, so that unused files do not pile up.
12. As a user, I want to turn project backgrounds off on this device, so that boards stay plain where I prefer them plain.
13. As a Member, I want a new Project to start with the columns Backlog, To Do, In Progress, Done and Canceled, so that I can use it straight away.
14. As a Member, I want to see all Projects of my Workspace on a projects page, so that I can find any of them.
15. As a Member, I want Active and Archived tabs on the projects page, so that finished Projects stay out of the way but remain reachable.
16. As a Member, I want to drag Projects into an order on the projects page, so that the important ones come first.
17. As a Member, I want the sidebar to list active Projects in the shared order, so that I can jump to one from anywhere in the Workspace.
18. As a Member, I want a Project another Member creates, renames or reorders to appear in my sidebar and projects page without a reload, so that what I see is current.
19. As a Member, I want a project switcher in the breadcrumb, so that I can move between Projects without going back to the list.
20. As a Member, I want each Project at `/<workspace>/projects/<KEY>`, so that I can bookmark and share it.
21. As a Member, I want the project page to show its columns in workflow order with their colours, so that I can see the shape of its workflow.
22. As a Member, I want an empty state on the projects page when the Workspace has no Projects, so that I know how to start.
23. As a Member, I want a new Workspace to start with no Projects, so that I name the first one myself.
24. As a Member, I want project settings (General, Workflow) inside the Workspace settings, so that all configuration lives in one place.
25. As a Member, I want each settings field to save when I leave it, so that I never press a save button or lose an edit.
26. As a Member, I want my edits to show immediately and roll back if the server refuses them, so that the page is fast but never lies.
27. As a Member, I want to confirm before changing a Project's key, so that I do not break links and ticket ids by accident.
28. As a Member, I want an old Project URL to show "not found" after a key change, so that the behaviour is predictable (no redirect history is kept).
29. As a Member, I want to add a Column with a name and a category, so that the workflow matches how I work.
30. As a Member, I want Column names to be unique within a Project, so that columns are not confused.
31. As a Member, I want Columns grouped by category in the fixed order backlog → unstarted → started → done → canceled, so that every board reads left to right as a workflow.
32. As a Member, I want to drag Columns within their category, so that I can order steps such as "In Progress" and "In Review".
33. As a Member, I want changing a Column's category to move it into that category's group, so that grouping never breaks.
34. As a Member, I want to rename a Column and change its colour, so that the board reads the way I want.
35. As a Member, I want colours chosen from a named palette that works in light and dark themes, so that boards look right in both.
36. As a Member, I want a new Column to get its category's default colour, so that I do not have to pick one each time.
37. As a Member, I want a Column's icon to follow its category, so that the meaning of a column is visible without configuration.
38. As a Member, I want to delete a Column by choosing which Column its items move to, so that nothing is lost and I do not have to move items by hand first.
39. As a Member, I want to be stopped from removing the last `unstarted` or the last `done` Column, so that new items always have a starting column and work can always be completed.
40. As a Member, I want the first `unstarted` Column to be where new items go, so that there is no separate "default column" setting to manage.
41. As a Member, I want Column changes made by another Member to appear live in the Workflow settings and on the board, so that we work from the same workflow.
42. As a Member, I want to archive a Project, so that it leaves the sidebar without losing anything.
43. As a Member, I want an archived Project to be read-only, so that nothing changes in it by accident.
44. As a Member, I want to unarchive a Project, so that I can resume work on it.
45. As a Workspace admin, I want to delete a Project only after it is archived, so that deletion is always a deliberate second step.
46. As a Workspace admin, I want deleting a Project to remove its Columns (and later its tasks) and its background image, so that nothing is left behind.
47. As a viewer, I want to see every Project and its Columns but not change them, so that I can follow work without editing it.
48. As a Member, I want creating, archiving, unarchiving, deleting and re-keying a Project to show in the Workspace activity feed, so that others know what changed.
49. As a Member, I want Column edits and reorders kept out of the activity feed, so that the feed stays readable.
50. As a Workspace owner, I want deleting the Workspace to delete its Projects, Columns and background images, so that nothing is left behind.
51. As a user, I want my account data export to include the Projects and Columns of my Workspaces, so that the export is complete.
52. As a user, I want Projects removed from my browser when I sign out or lose membership, so that no data stays behind.
53. As an MCP agent, I want a `list_projects` tool that returns each Project with its Columns, so that I can understand a Workspace's structure.
54. As the owner, I want two people reordering at the same moment to never block future reorders, so that ordering can never get stuck.

## Implementation Decisions

**Vertical.** A new `projects` Vertical in API and web, with Columns as a `columns` sub-domain inside it. Other verticals import only its `index.ts`.

**Domain language.** Add **Project**, **Project key**, **Column**, **Column category** and **Archived project** to `CONTEXT.md`. Record the decisions and the Kaneo comparison as ADR 0003.

**Project table.** `id, workspaceId, key, name, description, icon, backgroundUrl, archivedAt, lastTaskNumber, position, createdAt, updatedAt`.
- `key`: matches `^[A-Z][A-Z0-9]{1,5}$`, normalised to upper case on input, unique on `(workspace_id, key)` as a plain unique index. Archived Projects keep their key. Renaming is allowed; old URLs stop resolving and no redirect history is kept.
- `icon`: nullable Lucide icon name, validated on the server against one curated list shared by API and web.
- `backgroundUrl`: follows the existing public-image pattern (same upload limits and validation as workspace logos), under a new `project-backgrounds/<projectId>/` image folder. Replacing or clearing it queues cleanup of the old object.
- `lastTaskNumber`: integer, default 0. Not used until tasks exist.
- `position`: see Ordering.
- Foreign key to the Workspace with cascade delete.

**Column table.** `id, projectId, name, category, color, position, createdAt, updatedAt`.
- `category`: one of `backlog | unstarted | started | done | canceled`, enforced in the database. It replaces Kaneo's `isFinal` and virtual statuses, and decides the column's icon.
- `color`: a named palette token from a fixed list shared by API and web, each mapped to design-system colours for both themes. Each category has a default (backlog gray, unstarted slate, started blue, done green, canceled red).
- `name`: unique per Project.
- No `slug`, no `icon`, no `isFinal`. Tasks will reference `column_id` only.
- Foreign key to the Project with cascade delete.
- Default set on creation, in the same transaction as the Project: Backlog, To Do, In Progress, Done, Canceled.
- Invariant, checked in the write transaction with the Project row locked: every Project keeps at least one `unstarted` and one `done` Column. The first `unstarted` Column in order is the default for new items.
- Delete takes a target Column of the same Project and moves the deleted Column's items there in the same transaction. Until tasks exist this move is empty, but the Procedure contract includes it.

**Ordering.**
- `fractional-indexing` (v4) is a direct dependency of both API and web.
- `position` is `text COLLATE "C" NOT NULL`, so Postgres orders it by bytes as the library requires. In the browser it is compared with `<`, never `localeCompare`.
- Unique indexes: `(workspace_id, position)` for Projects and `(project_id, category, position)` for Columns.
- The client generates the key from its neighbours (`generateKeyBetween`) and sends it. The server validates it by calling `generateKeyBetween(key, null)` (which throws on a malformed key) and lets the unique index reject duplicates. A rejected move rolls back the optimistic change; the user retries.
- Server-side inserts (new Project at the end, seeded Columns) compute keys with `generateKeyBetween` / `generateNKeysBetween`.
- Columns sort by category rank, then `position`. Changing a Column's category requires a new position inside the target category's group.

**Permissions.**
- New resource `project: ["create", "update", "delete"]` in the permissions package.
- Viewer: none (read comes from membership). Member: create, update. Admin and owner: create, update, delete.
- `update` covers Project fields, background, archive, unarchive, key change and every Column write.
- Archived Projects reject every write except unarchive and delete. Delete is allowed only for an archived Project.

**Sync.**
- Two Shapes declared in the Vertical and added to the registry: `projects` (all columns of the Project table, including archived rows) and `project-columns`. Both are scoped through Workspace membership subqueries; Columns go through their Project's Workspace. Names and column schemas live once in `@morrow/sync-schemas`.
- One Drizzle migration creates both tables and makes them synced (`REPLICA IDENTITY FULL`, publication, `GRANT SELECT … TO electric`).
- Both collections live in the web Vertical's `collections/`, built with `shapeOptions`, wrapped in `registerSyncedCollection`, preloaded in the route loaders, and read with `useLiveSuspenseQuery`.
- Every Project and Column write is a Procedure run in `withTxid` that returns `{ …, txid }`. Collection `onInsert`, `onUpdate` and `onDelete` handlers call it and wait with `awaitTxId`.

**Procedures** (workspace-context oRPC, permission-checked):
- Projects: create (name, key, icon?, description?), update (name, description, icon), change key, reorder (position), archive, unarchive, delete, set background, clear background.
- Columns: create (projectId, name, category, color?), update (name, color, category with new position), reorder (position), delete (targetColumnId).
- Errors are typed: key taken, invalid key, invalid icon, invalid colour, invalid position, duplicate position, column name taken, last required column, project archived, project not archived.

**Activity.** Project create, archive, unarchive, delete and key change are recorded through the existing workspace activity recording. Column writes and reorders are not.

**Lifecycle.**
- Workspace deletion queues cleanup of Project background images, the same way it does for the Workspace logo. Rows go by cascade.
- Account data export includes the Projects and Columns of the user's Workspaces.

**MCP.** A read-only `list_projects` tool for a Workspace returns each Project (id, key, name, description, icon, archivedAt) with its Columns in order (id, name, category, color).

**Web routes and screens.**
- `/$slug/projects`: Active and Archived tabs. Rows show icon, name, key and description. Drag to reorder on Active, for users who have `project: update`. Empty state with a create action.
- `/$slug/projects/$key`: the board. The key is upper case in the URL. Columns are shown in order with colour and category icon as empty lanes, with the background image behind them when set and the device preference allows it. An unknown key shows "not found".
- `/$slug/settings/projects/$key/general`: name, key (confirm dialog on change, with a hint showing ticket ids like `KEY-12`), description, icon picker and background in one card. Below it: Archive / Unarchive. A Danger zone with delete appears only for archived Projects and only for users who have `project: delete`.
- `/$slug/settings/projects/$key/workflow`: Columns grouped under category headings, each with an inline name, a colour picker, a category select, a drag handle (within its group) and delete (which opens a target-column picker). An add-column row per category.
- The settings shell navigation lists the Workspace's Projects.
- Fields save when they lose focus through an optimistic collection update; there is no debounced form or save button. Controls are disabled when the user lacks `project: update` or the Project is archived.
- Sidebar: active Projects in shared order, plus a create action.
- Create-project dialog: name, key (suggested from the name as the user types until they edit it), icon. After creation it navigates to the board.
- Breadcrumb: a project switcher on project pages.
- Device preference "Show project backgrounds", on by default, kept in the existing device-preference local collection and shown on the account Preferences page. It is not registered for sign-out cleanup.
- All strings go through the i18n package.

## Testing Decisions

A good test exercises behaviour at the highest available seam and asserts what a caller sees: Procedure results and typed errors, rows in the database, what the shape proxy serves, and what another browser tab shows. It does not test how collections, hooks or registries are built.

**Seam 1: the API in-process with real Postgres** (prior art: `workspace-orpc`, `workspace-logo`, `shape-proxy`, `with-txid`, `workspace-read-boundaries`, `account-export`, `activity-orpc` in the API integration suite).
- Create seeds the five default Columns in category order with valid, ordered positions, and returns a txid that matches the inserted rows.
- Key rules: format, upper-case normalisation, uniqueness per Workspace (including archived Projects), and that the same key is allowed in another Workspace. A key change is recorded in activity.
- Icon and colour are validated against the shared lists.
- Ordering: a valid client key is stored, a malformed key is rejected, and a duplicate key is rejected by the unique index. A list sorted by `position` matches the library's order, including mixed-case keys (`COLLATE "C"`).
- Column invariants: removing or recategorising the last `unstarted` or `done` Column fails. Delete requires a target in the same Project. Names are unique per Project. A category change places the Column in the new group.
- Archive: writes to an archived Project fail except unarchive and delete. Delete fails on an active Project. Delete cascades to Columns and queues background cleanup.
- Permissions: a viewer gets forbidden on every write. A Member can create and update but not delete. An admin can delete. A non-member gets "not found".
- Shape proxy: `projects` and `project-columns` serve only rows of the user's Workspaces, with server-chosen table, columns and filter, and ignore client-supplied ones.
- Lifecycle: Workspace deletion removes Projects and queues their background images. Account export includes Projects and Columns.
- MCP: `list_projects` returns Projects with ordered Columns for a member, and "not found" otherwise.
- Background: upload and clear follow the workspace-logo behaviour (validation, old object queued for cleanup).

**Seam 2: Playwright e2e against the compose stack with real Electric** (prior art: the smoke and sync specs).
1. A Project created in one tab appears in another Member's sidebar and projects page without a reload.
2. Reordering Projects in one tab reorders them in another.
3. Adding, renaming and reordering a Column in Workflow settings shows on the board in another tab.
4. Archiving moves the Project from the sidebar and Active tab to the Archived tab, live, and its settings become read-only.
5. Changing a key navigates to the new URL, and the old URL shows "not found".

Pure helpers (key suggestion from a name, column grouping and sorting by category rank then position) get small unit tests next to them.

`pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm typecheck`, `pnpm lint` and `pnpm knip` (no new findings) must pass.

## Out of Scope

- Tasks, ticket ids, the task counter's use, task views (list, backlog, calendar, gantt), progress, due dates and project status on the list page.
- Per-member project access, public read-only projects, moving a Project to another Workspace.
- Custom fields, labels, workflow rules and automations, integrations, calendar feeds, task import and export.
- Per-user project order or favourites.
- Editing Columns from the board itself.
- A keyboard shortcut for creating a Project, and a project step in onboarding.
- MCP write tools for Projects or Columns.
- Redirects from old Project keys.

## Further Notes

- Kaneo reference points, for whoever implements this: project schema and default columns in Kaneo's database schema and project insert controller; project settings pages under its `settings/projects/$projectId` routes; the column editor under its project columns components. Use them for behaviour and copy only. The data model above replaces theirs.
- `fractional-indexing` 3.4.0 is already in the lockfile through `@tanstack/db-ivm`. Adding v4 as a direct dependency is intentional: the API is the same, plus an optional integer-digit alphabet.
- The "move items to the target Column" step in Column delete has nothing to move until tasks exist. Keep it in the Procedure contract so tasks do not change the API.
- When tasks arrive, they reference `column_id`, and a task's state is its Column's category. There is no status text column.
