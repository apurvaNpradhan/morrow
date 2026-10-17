# Labels, comments and task history

Status: ready-for-agent

## Problem Statement

A Task in Morrow has a title, a description, a Priority, an Assignee and a due date. There is no way to:

- Tag tasks across Projects with a shared vocabulary such as `bug` or `design`, or filter the board by those tags.
- Talk about a task where it lives. Discussion happens elsewhere and is lost.
- See what happened to a task: who moved it, when its priority changed, who reassigned it. The Workspace activity feed records only creation, completion, cancellation and deletion.

Kaneo, which Morrow references, has all three, but they do not fit Morrow's model:

- **Labels.** One table holds two kinds of row. A Workspace "template" has no task. Applying a label copies its name and colour into a new row tied to the task. Renaming a label leaves stale copies on every task, and deleting one needs a cascade across copies behind an advisory-lock throttle.
- **Comments.** They are stored twice: in a comment table, and as activity rows that carry the content.
- **History.** The sheet's timeline mixes comments with field-change events read from a general activity table.

## Solution

**Labels**
- Labels belong to the Workspace. Each has a name, a colour and an order.
- A task carries the ids of its labels. Renaming or recolouring a label changes it everywhere at once.
- Labels show as chips on cards and list rows.
- They are applied from a picker in the task sheet or with the `L` command.
- The board can be filtered by them.
- Labels are managed on a Workspace settings page.

**Comments**
- Comments are markdown messages on a task.
- Every Member can post them, Viewers included.
- They appear live in every open tab, and cards show a comment count.

**Task history**
- Each task keeps a record of user-made changes: created, title, Column move, Priority, Assignee, due date, labels, archive and description edits.
- Rapid repeated edits by the same person fold into one entry.

**Timeline**
- The task sheet shows comments and history as one chronological timeline below the description, with the composer at the bottom.

Labels, comments and history are all synced. Labels load once per Workspace. Comments and history load only for the open task.

## User Stories

### Labels

1. As a Member, I want to apply a Workspace label to a task, so that I can tag it with a shared category.
2. As a Member, I want to remove a label from a task, so that I can correct a mis-tag.
3. As a Member, I want to open a label picker from the task sheet, so that I can see and toggle the Workspace's labels in one place.
4. As a Member, I want to press `L` on a focused or open task to open the label picker, so that I can label without the mouse.
5. As a Member, I want to type in the label picker to narrow the list, so that I can find a label among many.
6. As a Member, I want to create a new label from the picker when my search has no match, so that I don't have to leave the task to add one.
7. As a Viewer, I want to see labels on tasks without being able to change them, so that I can read the categorisation.
8. As a Member, I want label chips on board cards, so that I can scan categories at a glance.
9. As a Member, I want label chips on list rows, so that the list view carries the same information.
10. As a Member, I want cards with many labels to show a few chips and a "+N" overflow, so that cards stay compact.
11. As a Member, I want to filter the board and list by "label is any of", so that I see only tasks with those labels.
12. As a Member, I want to filter by "label is none of", so that I can exclude a category.
13. As a Member, I want the label filter to combine with other filters, so that I can ask "bugs assigned to me".
14. As a Member, I want my label filter to survive a reload like other filters, so that my view stays put.
15. As a Member, I want a label applied in one tab to appear in other Members' tabs without a reload, so that everyone sees the same board.
16. As an Admin, I want a Labels settings page for the Workspace, so that I can manage the vocabulary.
17. As an Admin, I want to rename a label, so that every task shows the new name immediately.
18. As an Admin, I want to recolour a label from the Project colour palette, so that labels match the rest of the UI.
19. As an Admin, I want to reorder labels, so that the picker and settings list show them in a deliberate order.
20. As an Admin, I want to delete a label after seeing how many tasks use it, so that I don't remove something important by accident.
21. As an Admin, I want deleting a label to remove it from every task in the same step, so that no task points at a missing label.
22. As a Member, I want to create labels but not rename or delete them, so that I can extend the vocabulary without disrupting others.
23. As a Member, I want a clear error when a label name already exists in any letter case, so that the vocabulary doesn't get near-duplicates.
24. As a Member, I want a clear error when a task already has the maximum of 20 labels, so that I understand why one more fails.
25. As a Member, I want two people labelling the same task at once to both succeed, so that neither change is lost.

### Comments

26. As a Member, I want to write a comment on a task in markdown, so that I can discuss it next to the work.
27. As a Viewer, I want to comment on tasks, so that I can give feedback without edit rights.
28. As a commenter, I want the same rich editor as the description, without image upload, so that formatting feels familiar.
29. As a commenter, I want my comment to appear immediately when I post it, so that posting feels instant.
30. As a Member, I want comments from others to appear live in an open sheet, so that a conversation can happen in real time.
31. As an author, I want to edit my comment, so that I can fix mistakes.
32. As a reader, I want edited comments to show "edited", so that I know the text changed after posting.
33. As an author, I want to delete my comment, so that I can retract it.
34. As an Admin, I want to delete anyone's comment, so that I can moderate.
35. As a Member, I want to be unable to edit someone else's comment, so that words are never put in another person's mouth.
36. As a Member, I want comments from a user whose account is gone to stay and read "Deleted user", so that the discussion keeps its context.
37. As a Member, I want a comment count badge on cards, so that I can see which tasks have discussion.
38. As a Member, I want to comment on archived tasks, so that discussion can continue after a task is taken off the board.
39. As a Member, I want comment writes on an archived Project refused, so that an archived Project stays read-only.
40. As a Member, I want a clear error when a comment exceeds 10,000 characters or is empty, so that I know what to fix.
41. As a Workspace Member, I want "commented on MOR-12" in the Workspace activity feed, so that I can see where conversation is happening.

### Task history

42. As a Member, I want to see when and by whom a task was created, so that I know its origin.
43. As a Member, I want imported tasks to say "imported" and duplicated tasks to say "duplicated from MOR-4", so that their origin is clear.
44. As a Member, I want title changes recorded with the old and new title, so that I can follow renames.
45. As a Member, I want Column moves recorded with from and to, so that I can see a task's progress through the workflow.
46. As a Member, I want Priority changes recorded, so that I know who escalated a task.
47. As a Member, I want Assignee changes recorded, so that I know who handed a task to whom.
48. As a Member, I want due-date changes recorded, so that slipping deadlines are visible.
49. As a Member, I want label additions and removals recorded, so that I know who re-categorised a task.
50. As a Member, I want archive and unarchive recorded, so that I know why a task left the board.
51. As a Member, I want description edits recorded as "edited the description", without a diff, so that I know the spec changed.
52. As a Member, I want rapid repeated edits by the same person within 10 minutes merged into one entry, so that autosave and tweaking don't flood the timeline.
53. As a Member, I want a change that is undone within that window to disappear from history, so that the timeline shows only real changes.
54. As a Member, I want history to show the current name of a Column, label or Member when it still exists, so that renames don't make history confusing.
55. As a Member, I want history to show the name at the time when the Column, label or Member is gone, so that history never reads "unknown".
56. As a Member, I want reorders within a Column kept out of history, so that it stays meaningful.
57. As a Member, I want system cascades (Column deleted, category changed, member removed, key renamed, label deleted) kept out of per-task history, so that one admin action doesn't write thousands of entries.
58. As a Member, I want new history entries to appear live in an open sheet, so that I see changes others make while I read.

### Timeline

59. As a Member, I want comments and history in one chronological feed below the description, oldest first, so that I can read the task's story top to bottom.
60. As a Member, I want history entries as compact one-liners (avatar, sentence, relative time), so that comments stand out.
61. As a Member, I want three or more consecutive history entries folded into "N more changes", so that long runs of edits don't bury comments.
62. As a Member, I want to expand a folded run, so that I can see every change when I need to.
63. As a Member, I want the comment composer at the bottom of the timeline, so that replying follows reading.
64. As a Member, I want opening a task to load only that task's comments and history, so that the board stays fast.

### Import, export, MCP, account

65. As a Member, I want exported tasks to include their label names and comments with author emails, so that an export is a complete record of the discussion.
66. As a Member, I want importing to match labels by name ignoring case, so that existing labels are reused.
67. As a Member with `label: create`, I want missing labels created on import, so that nothing is lost.
68. As an importer without `label: create`, I want missing labels dropped with a warning, so that the import still succeeds and I know what was skipped.
69. As an importer, I want comments to keep their original times and match authors by email, so that discussion history survives the move.
70. As an importer, I want comments by unknown emails imported as "Deleted user" with a warning, so that their content is kept.
71. As an agent using MCP, I want a `list_labels` tool, so that I can see a Workspace's vocabulary.
72. As an agent using MCP, I want `get_task` to return labels and comments, so that I can understand a task fully.
73. As a user exporting my account data, I want my comments included, so that the export is complete.

## Implementation Decisions

### Labels

- **New table `label`.** Columns:
  - id
  - Workspace id (cascades)
  - name: 1–50 characters, trimmed, unique per Workspace on its lower-cased form
  - colour from the existing Project colour palette, validated by the same schema
  - fractional-index `position` (`text COLLATE "C"`, unique per Workspace, generated by the client, validated by the server, sorted in JavaScript, like Columns)
  - created and updated timestamps (UTC `timestamp`, like every other table)
- **Tasks hold labels as `label_ids text[]` on `task`**, not null, defaulting to empty, with no foreign key. This is a deliberate exception to relational integrity: one row per task, no extra shape, and the card and filter read labels straight off the task row. Integrity is kept by the only path that deletes labels.
- **Adding and removing are separate Procedures** (`tasks.addLabel`, `tasks.removeLabel`). Each runs under the existing Project lock with `array_append` (only when absent) and `array_remove`, so concurrent edits by two people never overwrite each other.
  - The label must belong to the task's Workspace.
  - Adding a 21st label is a typed error.
  - Both run in `withTxid` and return `{ …, txid }`.
  - Both need `task: update`.
- **Label Procedures:**
  - `labels.create` (client-chosen cuid2 id and position, as task create does)
  - `labels.update` (name, colour)
  - `labels.move` (position)
  - `labels.delete`
  - All run in `withTxid`.
- **Label delete is one transaction.** It runs `array_remove` on every task of the Workspace's Projects that holds the id, then deletes the label. No per-task history is written (a system cascade). The settings page shows "used on N tasks" before confirming. N is counted in the browser from the label usage it can see, or returned by a small `labels.usage` query, whichever is simpler; the tasks collection is on-demand and does not hold every task.
- **Permissions.** A new `label` resource with `create`, `update`, `delete`:
  - Member: `create`.
  - Admin and Owner: all three.
  - Viewer: none.
  - Applying labels to a task is `task: update`.
- **Shape `labels`.** Eager, scoped to the user's Workspaces through the membership subquery. Declared in the vertical's shapes file, with name and columns in `@morrow/sync-schemas`, and added to the shape registry. The web collection is preloaded in the Workspace route loader and registered for sign-out cleanup.
- **`tasks` shape** gains `label_ids`.
- **Web:**
  - Label chips on cards and list rows, with an overflow "+N" after a small number.
  - A label picker field in the task sheet: multi-select, searchable, inline "Create label" when the user has `label: create` and the search has no exact match.
  - An `L` command in the command registry that opens the picker for the focused or open task.
  - A `label` filter subject in the filter bar using the existing operators. `is` and `is any of` mean "has any of". `is not` and `is none of` mean "has none of".
  - A Labels page in Workspace settings: list in order, drag to reorder, inline rename, colour picker, delete with confirmation. Controls are hidden or disabled per permission.
- **Migration:** creates the table, adds `label_ids`, publishes `label` to Electric (`REPLICA IDENTITY FULL`, publication, `GRANT SELECT`) and adds the `label` grants to the default roles of existing Workspaces. Custom roles are not touched.

### Comments

- **New table `task_comment`.** Columns:
  - id (client-chosen cuid2)
  - task id (cascades)
  - Project id, repeated from the task for shape scoping as in ADR 0005 (cascades)
  - author user id (`SET NULL`, shown as "Deleted user")
  - markdown `body` (1–10,000 characters)
  - `created_at`
  - nullable `edited_at`
  - `updated_at`
  - An index on `(task_id, created_at)`.
- **`comment_count` integer on `task`** is incremented and decremented in the same transaction as comment create and delete, and backfilled as 0. The `tasks` shape gains it.
- **Procedures** `comments.create`, `comments.update` and `comments.delete` hold the Project lock (so an archived Project refuses them), run in `withTxid`, and return `{ …, txid }`.
  - Update sets `edited_at` and is allowed only for the author.
  - Delete removes the row. It is allowed for the author, or for anyone holding `comment: delete`.
  - Comments on archived tasks are allowed.
- **Permissions.** A new `comment` resource:
  - `create`: every role, Viewer included.
  - `delete` (anyone's): Admin and Owner.
  - Editing is always author-only and needs no grant.
- **Shape `task-comments`.** On-demand, scoped by membership through `project_id`. The sheet's live query narrows it to one `task_id`. The collection has write handlers that call the Procedures and `awaitTxId`.
- **Activity.** `comment.created` is added to the Workspace activity event union with Workspace, Project, task id, ticket id, task title and actor, and no excerpt. Comment edits and deletes are not recorded.
- **Editor.** The sheet's Tiptap markdown setup, reused without the image/asset extension.
- **Migration:** creates the table, adds `comment_count`, publishes `task_comment` to Electric and adds the `comment` grants to existing default roles.

### Task history

- **New table `task_event`.** Columns:
  - id
  - task id (cascades)
  - Project id, repeated for shape scoping (cascades)
  - actor user id (`SET NULL`)
  - `type`
  - `data jsonb`
  - `created_at`
  - `updated_at`
  - An index on `(task_id, created_at)`.
- **Event types and payloads** are one zod discriminated union in `@morrow/sync-schemas`, used by the API to write and by the web app to render:
  - `created`, `imported`, `duplicated` (source ticket id).
  - `title` (from, to).
  - `column` (from and to as `{ id, name, category }`).
  - `priority` (from, to).
  - `assignee` (from and to as `{ id, name }` or null).
  - `due_date` (from, to as date strings or null).
  - `labels` (added and removed lists of `{ id, name, color }`).
  - `archived`, `unarchived`.
  - `description` (no payload).
- **Recording.** One helper, `recordTaskEvent(tx, …)`, is called from each field Procedure inside its existing transaction, after the write, while the Project lock is held. Only these per-task, user-initiated writes record:
  - create, import, duplicate
  - title, description, priority, assignee, due date
  - moves that change Column (reorders within a Column do not record)
  - label add and remove
  - archive and unarchive
- **Coalescing.** A pure function decides "insert", "merge into the previous event" or "delete the previous event", given the actor's latest event on the task and the new change.
  - **Merge:** when the latest event of that task is by the same actor, of the same field type, and newer than 10 minutes, the helper keeps the original `from`, replaces `to` and bumps `updated_at`.
  - **Delete:** if the merged `from` equals `to`, the event is deleted.
  - **Labels:** `labels` events merge their added and removed sets. A label added then removed cancels out, and an empty event is deleted.
  - **Description:** `description` events merge into one.
  - **Creation-type events** never merge.
- **Not recorded (system cascades):**
  - Column delete moving tasks
  - Column category change updating `completedAt`
  - member removal clearing assignees (the existing trigger)
  - Project key rename
  - label delete stripping ids
  - comment edits
- **Shape `task-events`.** On-demand, scoped by membership through `project_id`, narrowed by the sheet to one `task_id`. Read-only: no write handlers.
- **Rendering names.** The timeline resolves ids against the live Columns, labels and members collections. When the entity no longer exists it uses the snapshot in `data`.
- **Migration:** creates the table and publishes it to Electric. No backfill: existing tasks start with an empty history.

### Timeline

- The sheet merges the comments and events live queries by `created_at`, oldest first, below the description, with the composer last.
- Events render as one-liners with avatar, sentence and relative time. Comments render as cards with author, time, "edited", and an edit/delete menu shown by permission.
- A run of three or more consecutive events folds into "N more changes" and expands on click. Merging and folding is a pure helper.
- No pagination: the whole timeline of the open task loads.

### Import, export, MCP, account

- **Export.** It adds:
  - a top-level list of the labels used, with name and colour
  - per task, `labels` (names) and `comments` (author email, body, created and edited times)
  - History is not exported.
- **Import.**
  - Labels are matched by name ignoring case.
  - Missing labels are created when the importer has `label: create`. Otherwise they are dropped with a warning.
  - Comments keep their times. Authors are matched to Members by email; an unmatched author becomes null, with a warning.
  - `comment_count` is set.
  - Each task gets a single `imported` event.
  - Existing limits (5,000 tasks, 5 MB, one transaction) stay.
- **MCP.** A new `list_labels` read tool. A `get_task` read tool, or the existing task read extended, returns labels (names and colours) and comments. No history.
- **Account export** includes the user's own comments.

### Sync and documentation

- Three new shapes (`labels`, `task-comments`, `task-events`) bring a Workspace page to twelve long-polls. That is fine behind HTTP/2, which dev Caddy, prod Traefik and e2e Caddy all use.
- One ADR, `0006-labels-comments-history.md`, records these decisions and the comparison with Kaneo. `CONTEXT.md` gains Label, Comment and Task history entries.

### Delivery order

Four vertical slices, each shippable:

1. Labels.
2. Comments, including `comment_count` and the activity event.
3. Task history and the merged timeline.
4. Import/export, MCP and the account export for all three.

## Testing Decisions

A good test exercises behaviour at the highest available seam and asserts what a caller sees: Procedure results and typed errors, rows in the database, what the shape proxy serves, and what another browser tab shows. It does not test how collections, hooks or components are wired.

### Seam 1: the API in-process with real Postgres

Prior art: `projects-orpc`, `project-columns-orpc`, `shape-proxy`, `with-txid`, `activity-orpc`, `account-export`, `mcp-endpoint`, and the tasks integration tests.

- **Labels:**
  - Create, rename, recolour, move and delete return a txid.
  - Name length and trim are enforced; a case-insensitive duplicate is refused.
  - Colour must come from the palette.
  - Add and remove are idempotent.
  - Adding a label from another Workspace is refused, and a 21st label is refused.
  - Two concurrent adds both land.
  - Delete strips the id from every task in the Workspace and writes no task events.
- **Label permissions:**
  - A Viewer cannot apply labels.
  - A Member can apply and create labels but cannot rename or delete them.
  - Admins can do everything.
  - The migration adds grants to existing default roles only.
- **Comments:**
  - Create, edit and delete return a txid.
  - The body bounds are enforced.
  - Edit sets `edited_at` and is refused for non-authors, Admins included.
  - Delete works for the author and for an Admin, and is refused for another Member.
  - A Viewer can create.
  - Writes on an archived Project are refused; writes on an archived task are allowed.
  - `comment_count` tracks creates and deletes.
  - Deleting the author's user keeps the comment with a null author.
  - `comment.created` is recorded in Workspace activity without a body.
- **History:**
  - Each recorded write produces the right event type and payload with snapshot names.
  - Reorders and every listed cascade produce none.
  - Same-actor, same-field edits within the window merge; different actors, different fields or an older event insert.
  - A change undone within the window deletes the event.
  - Label add then remove cancels out.
  - Description autosave bursts leave one event.
  - Deleting a task removes its events and comments.
- **Shape proxy:**
  - `labels`, `task-comments` and `task-events` serve only rows of the user's Workspaces.
  - Subset requests for a foreign task return nothing.
  - Client-supplied table, columns or filter are ignored.
- **Import and export:**
  - The round trip preserves labels and comments.
  - Label creation versus a warning depends on `label: create`.
  - Unknown comment authors become null with a warning.
  - Imported tasks have one `imported` event.
- **MCP:** `list_labels` and the task read return labels and comments for a member, and "not found" otherwise.
- **Account export** includes the user's comments.

### Seam 2: Playwright e2e against the compose stack with real Electric and HTTP/2

Prior art: `projects.spec.ts`, `sync.spec.ts`, the tasks e2e specs.

1. Applying a label from the sheet picker (and with `L`) in one tab shows a chip on the card in another tab, and a "label is" filter narrows the board and survives a reload.
2. Creating a label inline from the picker, then renaming and recolouring it in settings, updates the chip in another tab; deleting it removes the chip.
3. Posting a comment in one tab shows it in another tab's open sheet and bumps the card badge; editing shows "edited"; deleting removes it.
4. Changing Priority and moving a task show history lines in another tab's open sheet; several quick title edits leave one line, and a run of changes folds into "N more changes".

### Unit tests beside pure helpers

- The event `data` union parses each type and rejects unknown ones.
- The coalescing decision covers insert, merge, delete-on-revert and label set arithmetic.
- Timeline merge order and folding of event runs.
- Label filter matching for any-of and none-of, combined with other subjects.
- Label name normalisation for uniqueness.

### Commands

`pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm typecheck`, `pnpm lint` and `pnpm knip` must pass with no new findings.

## Out of Scope

- @mentions and any notifications, since notifications were removed.
- Reactions on comments.
- Attachments or images in comments.
- Comment threads or replies.
- Label groups, exclusive labels, and Project-scoped labels.
- Grouping or swimlanes by label.
- Per-task history for system cascades.
- History of comment edits.
- Description diffs.
- History in exports or MCP.
- Backfilling history for existing tasks.
- Timeline pagination.
- Full-text search over comments.
- Real-time typing indicators or collaborative comment editing.

## Further Notes

- Kaneo's `label` table (template rows plus per-task copies), its `comment` table plus `comment` activity rows, and its label deletion lock are the reference for what not to repeat.
- `label_ids` without a foreign key is the only array-of-ids column in the schema. The ADR should state that label delete is the single path that must keep it consistent.
- The 10-minute coalescing window and the 20-label cap are product constants in code, not settings.
- If history volume ever becomes a problem, pagination of the `task-events` subset is the follow-up, not a change of storage.
