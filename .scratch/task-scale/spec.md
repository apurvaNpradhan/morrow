# Task scale

Status: ready-for-agent

## Problem Statement

The owner loaded a demo Workspace with 20 Projects of 10–30k Tasks each, and every Project page is slow to open, slow to scroll and slow to type into. Creating one Task stalls the whole page. The cause is in every layer:

- **Too much data.**
  - Opening a Project's list or board loads every unarchived Task, full markdown descriptions included.
  - Shape responses go out uncompressed.
  - The board loads Done and Canceled Columns that are mostly history.
  - The database has no index for "unarchived Tasks of a Project".
- **Too much rendering.**
  - Every Task becomes a mounted row or card, each with its own drag-and-drop sortable, its own context menu, two field chips and an avatar.
  - Nothing is virtualized.
- **Too much recomputation.**
  - Each keystroke in search, each filter change and each synced change re-filters, re-groups and re-sorts all Tasks in one pass. Search lowercases every full description.
  - Creating a Task bumps the Project's counter and `updatedAt`, which are in the Projects Shape. That gives the Project row a new identity, and every row and card re-renders.
- **Too much waiting.**
  - The route loader waits on Projects and Columns twice before it asks for Tasks, then blocks first paint on all of them.
  - The rich-text editor is in the root bundle on every page.
  - The Task collection eagerly builds indexes on nearly unique fields.

Navigation and looks also fall short:

- **Navigation.** `J`/`K` already step between Tasks, but ↑/↓ don't step through Tasks while the sheet is open. Both use DOM queries that cannot reach rows that aren't rendered.
- **Looks.** Priority and status icons are small and boxed in bordered chips. Rows don't show their status. Padding and the ticket column don't line up, and closed rows and closed cards follow different rules. The owner wants the look of the Circle template (cloned under `repos/circle`, MIT).

## Solution

A Project with 30k open Tasks opens, scrolls and filters like a small one. Targets, measured against a committed demo seed:

- **(a) First visit, nothing cached:** the list is usable in under 1.5s.
- **(b) Returning to a Project already opened in this tab:** under 200ms.
- **(c) Scrolling, `J`/`K`, ↑/↓, typing in search or filters:** no frame over 16ms.

How we get there:

- **Lighter rows.** A synced Task row carries no description. The description is its own on-demand Shape, loaded when the sheet opens. Checklist progress is stored on the Task as two counts.
- **Compressed and indexed.** Shape snapshots are compressed. The database indexes unarchived Tasks by Project and by Column.
- **Rendering.**
  - The list and every board lane are virtualized.
  - Rows and cards only re-render when their own Task changes.
  - One context menu serves the whole surface.
- **Board.** Done and Canceled lanes on the board start collapsed with a count, the same as on the list.
- **Faster first paint.** The page renders its frame at once and fills in its Tasks. The editor and the sheet load only when needed.
- **Keys.**
  - `J`/`K` step through the view's Tasks in data order and scroll the next one into view.
  - With the sheet open, ↑/↓ do the same unless the cursor is in a text field.
- **Circle look.**
  - Priority bar icons and status pie icons at 16px, with a status icon on every row.
  - 36px rows, borderless icon buttons and semibold titles.
  - One rule for closed Tasks on rows and cards.

## User Stories

1. As the owner, I want a committed command that seeds a demo Workspace of 20 Projects with 10–30k Tasks each, so that every performance change is measured on the same data.
2. As the owner, I want the seed to produce the same data on every run, so that measurements before and after a change are comparable.
3. As the owner, I want the seed to refuse to run in production, so that I cannot flood the real instance.
4. As the owner, I want the seed's Tasks to look real, so that the page is measured under realistic content. That means about 70% Completed, about 10% Archived, checklists in about 20% of descriptions, 8 Members as Assignees, and varied Priorities and due dates.
5. As the owner, I want baseline numbers for targets (a), (b) and (c) recorded before any change, so that each change shows its own gain.
6. As a Member, I want a Project's list to be usable within 1.5s on a first visit, so that a big Project feels like a small one.
7. As a Member, I want returning to a Project I already opened to take under 200ms, so that switching between Projects is instant.
8. As a Member, I want scrolling through 30k Tasks to stay smooth, so that I can skim a long backlog.
9. As a Member, I want typing in search to never stutter, so that I can narrow 30k Tasks as I type.
10. As a Member, I want changing a filter or sort to never freeze the page, so that I can explore a Project's Tasks freely.
11. As a Member, I want creating a Task to not stall the page, so that adding work in a big Project feels the same as in a small one.
12. As a Member, I want a change made by someone else to update only that Task's row, so that live sync does not cost me frames.
13. As a Member, I want the page's frame, toolbar and Column headers to appear at once and the Tasks to fill in, so that I see where I am before the data arrives.
14. As a Member, I want the board's Done and Canceled lanes to start collapsed with their count, so that history does not slow down the work in progress.
15. As a Member, I want to expand a collapsed board lane and have its Tasks load then, so that history is one click away.
16. As a Member, I want a Task's description to appear when I open the Task, so that the list never pays for text I am not reading.
17. As a Member, I want rows and cards to still show checklist progress, so that I see how far a Task is without opening it.
18. As a Member, I want checklist progress to update when anyone ticks an item, so that the counts are always current.
19. As a Member, I want search to match the title and the Ticket id, so that I can find a Task by name or by `MOR-12`.
20. As a Member, I want `J` and `K` to move focus to the next and previous Task in the view's order, so that I can walk the list from the keyboard.
21. As a Member, I want `J` and `K` to reach Tasks scrolled out of view, scrolling them in, so that keyboard walking works across 30k Tasks.
22. As a Member with a Task open in the sheet, I want `J`, `K`, ↓ and ↑ to open the next or previous Task, so that I can triage in a row without closing the sheet.
23. As a Member typing in the sheet's title or description, I want ↑ and ↓ to move my cursor, not switch Tasks, so that editing is never hijacked.
24. As a Member, I want stepping to follow what the view shows (its filters, search, sort and grouping), so that "next" means the next Task I see.
25. As a Member, I want stepping to skip collapsed groups, so that it never opens a Task I have hidden.
26. As a Member, I want arrow keys on the board to keep moving within a lane and across lanes, so that board navigation still works when lanes are virtualized.
27. As a Member, I want to drag a Task to reorder it or move it to another Column, with the view scrolling as I drag, so that drag-and-drop works in a long list.
28. As a Member, I want right-clicking any row or card to open the Task's context menu, so that its actions are one click away.
29. As a Member, I want the context menu to close cleanly if its row scrolls away, so that it never points at nothing.
30. As a Member, I want priority shown as a 16px Circle-style bar icon, so that I can read it at a glance.
31. As a Member, I want each row to show its Column's status as a pie icon in the Column's colour, filled by its place in its Column category, so that I see a Task's state without looking at the group header.
32. As a Member, I want rows at 36px with semibold titles and borderless icon buttons, so that the list is dense but readable.
33. As a Member, I want closed rows and closed cards to follow one rule (priority and status shown, due date hidden), so that the list and the board agree.
34. As a Member, I want Ticket ids with five-digit numbers to fit in the list, so that `ABCDEF-12345` is not cut off.
35. As a Member, I want the list's group headers, rows and toolbar to share one left edge, so that the page looks aligned.
36. As a Member, I want the right edge of rows to line up whether or not a Task has a due date or Assignee, so that columns of facts read straight down.
37. As a Member, I want the rich-text editor to load only when I open a Task or create one, so that other pages load faster.
38. As a Member on a slow connection, I want Shape snapshots compressed, so that a big Project downloads in a fraction of the bytes.
39. As the owner, I want the database to use an index for "unarchived Tasks of a Project or Column", so that Electric's subset queries stay fast at 600k Tasks.
40. As the owner, I want the latest TanStack DB and its Electric collection, so that later work (persistence) starts from a supported version.
41. As the owner, I want production confirmed to serve over HTTP/2, so that eight long-polls never queue behind each other.
42. As the owner, I want the description split recorded in an ADR, so that the reason for a second Shape is not lost.

## Implementation Decisions

**Order of work.** Each item is its own issue and commit, and each records its effect on targets (a), (b) and (c).

1. Demo seed and baseline.
2. TanStack DB upgrade.
3. Database indexes.
4. Smaller payloads.
5. Description split.
6. Client data.
7. Rendering.
8. Board lanes.
9. Keys.
10. Visuals.
11. HTTP/2 check.

**Demo seed**

- A script in the API workspace with its own package script.
- It bulk-inserts through Drizzle in chunks, not through the import Procedure.
- It uses a fixed random seed and refuses to run when `NODE_ENV` is production.
- It creates one Workspace, 8 Members, 20 Projects with their default Columns, and 10–30k Tasks each, with the mix in story 4.
- It sets each Project's Task counter to its highest number, so new Tasks number correctly.

**Measurement**

- A short documented procedure: browser performance panel or a script, run against the seed.
- It records (a) cold list usable, (b) warm Project switch, and (c) longest frame while scrolling, stepping with `J`, and typing a search.
- Results go into each issue's comments. Measurement is not a CI test.

**Upgrade**

- `@tanstack/db`, `@tanstack/react-db` and `@tanstack/electric-db-collection` go to their latest versions in one commit, before the other client work.

**Database**

Two partial indexes, added in a Drizzle migration:

- Tasks by Project where unarchived.
- Tasks by Column where unarchived.

The Tasks Shape's membership subquery is checked with EXPLAIN against the seed; anything it shows that needs fixing goes into the same issue.

**Smaller payloads**

- **Compression.** The app compresses Shape responses except live long-polls (`live=true`). The proxy's `content-encoding` handling is adjusted so the encoding header matches the body.
- **Projects Shape.** It drops the Task counter and `updatedAt`. The counter stays in the table; Task numbers are still assigned by the server, and a Task shows no number until it has one, as today.

**Description split** (ADR 0005)

- **New table.** A `task_description` table keyed by Task id, holding the markdown. It is synced as its own Shape, scoped by membership like Tasks. It is read with `syncMode: "on-demand"`, narrowed by a live query on one Task id when the sheet opens.
- **Making it synced.** One migration: `REPLICA IDENTITY FULL`, publication and grant (per the AGENTS.md recipe). The Shape is registered in the Tasks Vertical and in the Shape registry, and its schema lives in the sync schemas package.
- **Task rows.** The Tasks Shape drops `description` and gains `checklistDone` and `checklistTotal` (integers, 0 when there is no checklist).
- **Who writes them.** The Task Procedures (create, update description, duplicate, import) write the description row and the two counts in the same transaction, so the existing txid handshake covers both. The checklist counter is a pure function shared by API and web (moved into the sync schemas package), so both count the same way.
- **The sheet.** Its description editor reads and writes through the description collection. Autosave keeps its debounce and goes through a Procedure that returns a txid.
- **Search.** Searches title and Ticket id only. Description search is out of scope.
- **Import and export.** They keep round-tripping descriptions.

**Client data**

- **Indexes.** The Task collection uses `autoIndex: "off"` with explicit indexes on Project id and Column id.
- **The view context.**
  - **Stable part:** Project id and key, Columns by id, people by id, permissions, `openTask`.
  - **Changing part:** display options, frozen state, today.
  - Rows and cards are memoized on the Task row and the few primitives they use.
- **The view model.**
  - It is split into memoized stages: group and sort per Column (keyed on Tasks and sort), then filter and search (keyed on filters and search).
  - The search input is deferred.
  - Sorting by title uses one cached collator, and Priority sorts by a rank lookup.
  - Date formatters are cached per locale and options.
- **The route loader.** It starts the Task preload as soon as the Project id is known and does not block on it. The surface shows a skeleton inside a Suspense boundary.

**Rendering**

- **List.** `@tanstack/react-virtual` renders one flat virtual list of group headers and rows. Collapsed groups contribute only their header.
- **Board.** Each board lane has its own virtualizer.
- **Drag-and-drop.** It stays on dnd-kit for the rows that are rendered, with auto-scroll while dragging. The drop target is computed from data, not DOM order.
- **Context menu.** One surface-level ContextMenu opens from `onContextMenu` at the row's `data-task-id`, in the same pattern as the field picker. It closes when its row unmounts.
- **Lazy loading.** The create dialog's form, the description editor and the sheet are lazy-loaded, so tiptap leaves the root and surface chunks. The command palette renders its content only while open.

**Board lanes**

- Lanes for Columns in the `done` and `canceled` categories start collapsed, showing their count, and load their Tasks when expanded.
- They reuse the list's per-Column loading.

**Keys**

- **Stepping logic.** Stepping is a pure function over the view's flattened order (the groups shown, their sorted and filtered Tasks, collapsed groups skipped). It returns the neighbour, or nothing at either end.
- **Focus.** The surface asks the virtualizer to scroll that index into view, then focuses it.
- **Bindings.**
  - With the sheet closed, `J`/`K` move focus and ↑/↓ keep moving focus.
  - With the sheet open, `J`/`K` and ↑/↓ open the neighbour. ↑/↓ are ignored when the event target is editable (input, textarea, contenteditable).
  - Bindings stay in the command registry, so they show up in the shortcuts help.
- **Board arrows.** Left and right on the board move by lane index and height in data, not by DOM queries.

**Visuals**

- **Priority icons.** Circle's 16px SVG bars: three bars with partial opacity per level, a dotted icon for `none` and a filled alert square for `urgent`. Copied with attribution (MIT).
- **Status icons.**
  - `backlog`: a dashed circle.
  - `unstarted`: an empty circle.
  - `started`: a pie, filled by the Column's place among its category's Columns.
  - `done`: a filled check.
  - `canceled`: a filled cross.
  - All in the Column's colour.
- **Rows.** 36px, with borderless icon buttons for priority and status that open the field picker. Titles are semibold. The Ticket id column fits five-digit numbers. Group headers, rows and toolbar share one horizontal padding. The right side keeps fixed-width slots so edges line up.
- **Closed Tasks.** One rule for rows and cards: priority and status shown, due date hidden, dimmed.
- **Checklist progress.** The list uses the same chip as the card.

**HTTP/2.** Confirm Dokploy's proxy serves the app over HTTP/2 and fix the stale long-poll count in the Caddy configuration comment.

## Testing Decisions

A good test checks behaviour through the highest existing seam. It works from inputs and visible outputs, not internal state, and it does not test performance.

**Pure view-model functions.** This is the main seam; prior art is the existing tests for sort, search, filters and view order. They cover:

- stepping over the flattened order, including collapsed groups and both ends
- grouping, then sorting, then filtering
- search on title and Ticket id
- Priority rank sorting
- the closed-Task display rule
- position in a category for status pies

Arrow navigation tests are rewritten against data instead of DOM.

**Checklist counting.** It moves into the sync schemas package, and its existing tests move with it.

**Shape proxy.** Its existing tests gain three cases:

- snapshot responses are compressed and carry a matching encoding header
- live responses are not compressed
- the Projects Shape no longer includes the Task counter or `updatedAt`, and the Tasks Shape no longer includes `description`

**List surface.** One component test, in the pattern of the commands tests. It renders the list over an in-memory collection, with the virtualizer given a fixed size, and checks:

- `J`/`K` and ↑/↓ with the sheet open open the neighbour and scroll it into view
- ↑/↓ inside an editable element do nothing
- right-click opens the shared context menu for that Task

**Task Procedures** stay untested, as today; no real-Postgres harness is added.

## Out of Scope

- **Persistence** across reloads (OPFS SQLite via TanStack DB persistence), including per-user databases, sign-out and session-expiry wipe, and multi-tab coordination. That is the next pass, and the AGENTS.md rule against persistence stands until then.
- **Server-side full-text search** over descriptions.
- **Automatic archiving** of long-closed Tasks.
- **Fewer Shapes:** merging Member Shapes or switching Electric to SSE live mode.
- **Paging** Tasks per group from the server. Full load per Project stays.
- **A real-Postgres test harness** for Procedures.
- **Labels, cycles, and the other parts of Circle** besides the priority and status visuals and row density.

## Further Notes

- **Linear.** Its sync engine loads issue content, comments and history lazily, separate from the instant bootstrap, which is the same move as the description split. Its delta-sync read-path rebuild (turbopuffer posting lists) is server-side at a scale Electric's Shape log already covers for us.
- **The counter fix.** Removing the counter and `updatedAt` from the Projects Shape likely accounts for most of the stall on create (story 11). Measure it on its own.
- **Description search.** Search on descriptions disappears with the split. If it is missed, the follow-up is a server-side search Procedure over `task_description`.
- **References.**
  - [Rebuilding delta sync read path](https://linear.app/now/rebuilding-delta-sync-read-path)
  - [reverse-linear-sync-engine](https://github.com/wzhudev/reverse-linear-sync-engine)
  - TanStack DB `db-core/persistence` skill (for the next pass).

## Progress

- **1. Demo seed: done** (`pnpm --filter @morrow/api seed:demo <owner-email>`, workspace `demo-scale`, 405,721 tasks). No browser baseline was captured (no browser tooling in the session): measure targets (a), (b), (c) by hand on `/demo-scale` before and after each remaining step.
- **2. TanStack DB upgrade: done, not committed.** `@tanstack/db` 0.15.0, `react-db` 0.5.10, `electric-db-collection` 0.6.1; typecheck clean, web tests pass except the 13 in `commands.test.tsx`, which fail on a broken nested React copy under `@tanstack/react-hotkeys` that predates the upgrade. `apps/web/package.json` and `pnpm-lock.yaml` also hold uncommitted dependencies of the tasks web UI, so the upgrade goes in with that work.
- **3. Database indexes: skipped.** `EXPLAIN ANALYZE` of a 28k-task Project's unarchived subset takes 84ms (7ms of it the index scan; the rest is fetching the rows). A partial index would save about a tenth, not worth a migration. The database is not the bottleneck; payload and rendering are.
- **4. Smaller payloads: done** (compression except live long-polls; projects shape without `lastTaskNumber` and `updatedAt`).
- **5–11: not started.** They edit the tasks web UI, which is still untracked.
