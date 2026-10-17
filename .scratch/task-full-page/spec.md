# Task full page

Status: ready-for-agent

Blocked by: settings-return (shared return-location store)

## Problem Statement

A task's link, `/$slug/tasks/MOR-12`, opened cold renders the whole project's board or list with the task in the sheet (`task-ticket-page.tsx` → `ProjectTasksPage`) and preloads every task in the project. There is no full page for a task to read, share or reload on its own. Opening a task from somewhere other than its project, such as My tasks, has no good destination.

## Solution

`/$slug/tasks/$ticketId` stays the one address of a task.

- **Clicked in the app** (board, list): the sheet opens over the page, with the address bar masked to the task URL, as today.
- **Loaded cold** (pasted link, reload, "Open in full page"): the route renders a full task page.

The sheet and the page render one shared task-details component. The loader preloads only that task.

## User Stories

1. As a Member, I want to paste a task link and see the task on its own page, so that links open quickly and read well.
2. As a Member, I want to reload a task page and stay on it, so that the address is stable.
3. As a Member, I want "Open in full page" in the sheet header (expand icon), the task menu, the right-click menu and the palette, so that I can expand a task from anywhere.
4. As a Member, I want Esc or back on the full page to return to the board or list I came from, so that I keep my place.
5. As a Member who opened the page cold, I want Esc to go to the task's project board, so that there is always somewhere to go.
6. As a Member, I want Esc to do nothing while I am editing text or a picker or menu is open, so that it does not throw away my work.
7. As a Member, I want the same fields, editors, comments and timeline on the page as in the sheet, so that there is one task view to learn.
8. As a Member on a wide screen, I want properties in a right rail; on a narrow container, as a chip row under the title.
9. As a Member, I want a not-found message for a ticket id that does not exist or a project I cannot see.

## Implementation Decisions

- **Route:** `/$slug/tasks/$ticketId`. No `/$slug/projects/$key/$ticketId` route; the ticket id already names the project.
  - An in-app open keeps the masking used today (`board?task=12` shown as `/tasks/MOR-12`).
  - A cold load renders `TaskPage`.
  - Reloading while the sheet is open lands on the full page. This is accepted.
- **Loader:**
  - preloads a live query of the on-demand tasks collection with `where projectKey = key and number = n` (never the whole project);
  - plus the project's columns, labels and members needed by the pickers;
  - not awaited; the frame and a skeleton render first.
  - `preloadProjectTasks` is no longer called from this route.
- **Shared component:** extract the sheet body into one `TaskDetails` component (title, description, links, comments/timeline, properties), used by `task-sheet.tsx` and `TaskPage`. No second task view.
- **Layout:**
  - `TaskDetails` uses a container query: at about 720 px or more of container width, properties sit in a right rail (writing on the left, labelled properties on the right, as Kaneo d9cb5558);
  - narrower (the sheet on small screens, phones), they stack as a compact chip row under the title;
  - layout follows the container, not the route.
- **Page header:** breadcrumb (project → ticket id) and the same header actions as the sheet (copy actions, more menu).
- **Leaving:** reuse the return-location store from `settings-return`.
  - Esc and the back control go to the stored location if it is valid;
  - otherwise to `/$slug/projects/$key/board`.
  - Esc is gated by `shouldLeaveOnEscape`.
- **"Open in full page":** one registry command, available when a task is open or focused. It navigates without masking. No hotkey yet.
- **My tasks:** the My tasks page (MOR-20, MOR-21) links rows to this route when it is built.

## Testing Decisions

- Cold load of `/$slug/tasks/MOR-12` renders the page, and the collection receives only the one-task `where`.
- An unknown ticket id or project shows not-found.
- From the board: open the sheet → "Open in full page" → Esc returns to the board with its search.
- Cold load → Esc goes to the project board.
- Esc inside the description editor does not leave.
- `TaskDetails` renders the rail above the width threshold and chips below it (container width stubbed).
- Prior art: `$slug.test.tsx`, existing sheet tests.

## Out of Scope

- Subtasks, relations, custom fields.
- A hotkey for "Open in full page".
- Building My tasks.

## Further Notes

- Grilled 2026-10-17 (Q3–Q5, Q23, Q24).
- Kaneo reference: `task/$taskId_.tsx`, `task-details-content.tsx`, `task-details-sheet.tsx` (it uses `useDeferredValue` so the sheet frame paints first; worth copying).
