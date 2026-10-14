# 0003. Projects and columns

Status: accepted (2026-10-15). Builds on [0001](0001-electric-tanstack-db-sync.md) and [0002](0002-sync-invitations-and-workspaces.md): both new tables are synced shapes scoped by membership.

## Context

A Workspace had members, roles and activity but nothing to organise work in. Kaneo, which Morrow started from and now only references, has projects whose board columns are the workflow. Its model does not fit Morrow:

- A column has a `slug`, an `isFinal` flag and "virtual" statuses (planned, archived) that live outside any column, and a task stores both a status text and a column id for the same fact.
- Per-member project access (`all` or `selected`) contradicts "membership implies read" and would make every project shape filter per user.
- Order is an integer `position` that is renumbered under an advisory lock, so one drag writes every row.
- Archive exists in Kaneo's API but has no UI. Moving a project between workspaces, public projects, custom fields and workflow rules add a lot of code a personal instance does not need yet.

## Decision

**A Project belongs to a Workspace** and has a **key** (2–6 upper-case letters and digits, starting with a letter), name, description, a Lucide icon from a curated list, an optional background image, a task counter and an archive timestamp. The key is the URL segment (`/$slug/projects/$KEY`) and will be the prefix of ticket ids (`MOR-12`). It is unique per Workspace, archived Projects included, and may be renamed; old URLs then show "not found" and no redirect history is kept.

**Every Member sees every Project.** There is no per-member access. A Project that must be private belongs in its own Workspace. This keeps `projects` and `project-columns` plain membership-scoped shapes.

**A Column belongs to one Project and one fixed category**: `backlog`, `unstarted`, `started`, `done`, `canceled`. Projects name their Columns freely; the category says what a Column means, so views across Projects can group by it. It replaces `isFinal` and the virtual statuses. A Column has a name (unique per Project, case-insensitively), a named colour from a palette that maps to both themes, and a position. Its icon follows its category. A new Project starts with Backlog, To Do, In Progress, Done and Canceled.

**Every Project keeps at least one `unstarted` and one `done` Column.** The first `unstarted` Column is where new items start, so there is no "default column" setting. The check runs in the write transaction with the Project row locked. Deleting a Column names another Column of the same Project, and its items move there in the same transaction (there are no items yet, but the Procedure takes the target so tasks will not change the contract). A task will reference `column_id` only; there is no status text.

**Order is a fractional-index key** (`fractional-indexing`), stored as `text COLLATE "C"` so Postgres sorts it by bytes as the library requires; the web app compares with `<`, never `localeCompare`, and sorts in JavaScript rather than in the query. Projects are ordered per Workspace, Columns per Project and category. Moving an item writes one row. The browser computes the key from the neighbours it sees; the server checks the format and relies on a unique index. Two people landing on the same key collide, and the later move is rejected (`POSITION_TAKEN`) and rolled back. A silent tie-break by id was rejected: two rows with the same key make every later insert between them throw.

**Archive.** An archived Project stays in the shape, so the archive list is live, and is hidden from the sidebar. It is read-only: unarchive and delete are the only writes. Deleting is only possible from the archive and removes the Project, its Columns and its background image.

**Permissions.** A `project` resource with `create`, `update` and `delete`. Viewers have none, Members create and update, Admins and Owners all three. Column edits, archiving and key changes count as `update`. The migration adds the grants to the default Member and Admin roles of existing Workspaces.

**Sync.**
- Two shapes, `projects` and `project-columns`, scoped through membership subqueries; archived rows included.
- Both tables are one migration: `REPLICA IDENTITY FULL`, publication, `GRANT SELECT … TO electric`.
- Every write is a Procedure in `withTxid` that returns `txid`. Edits of an existing row (rename, icon, key, reorder, archive, colour, column moves and deletes) are optimistic collection updates whose handlers call the Procedure and wait with `awaitTxId`. Creating a Project or a Column is not an optimistic insert: the server picks its id, position and default Columns, so the call waits for both tables to deliver it.
- Settings fields save when they lose focus; there is no debounced form. Changing a key asks first.
- The two tables are also read by one oRPC Procedure, `projects.list`. This is a deliberate exception to "a table is a Shape or a query, never both": MCP tools and the account export run on the server and cannot read a browser collection. The web app never calls it.

**Also.** Project create, archive, unarchive, delete and key change are recorded in workspace activity; Column writes and reorders are not, to keep the feed readable. `list_projects` is a read-only MCP tool returning each Project with its Columns in board order. The account export includes the Projects and Columns of the user's Workspaces. Background images follow the logo pattern, under `project-backgrounds/<projectId>/`, and are removed with the Project, the Workspace or the account.

## Not now

Per-member project access, public projects, moving a Project to another Workspace, custom fields, workflow rules and automations, integrations, calendar feeds, task import and export, favourites, per-user project order, editing Columns from the board itself, MCP write tools, redirects from old keys. Tasks come next and bring ticket ids and the task views.

## Consequences

- Projects and Columns are live in every open tab and need no cache invalidation.
- Workspace-wide boards can group by category without a shared workflow.
- A rejected concurrent reorder is rare when working mostly alone and costs a retry; the alternative blocked inserts silently.
- Renaming a key breaks bookmarks. That is accepted instead of keeping a redirect table.
- Existing custom roles do not get `project` grants; an admin edits them in the roles page.
