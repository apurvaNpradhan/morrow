# Task sheet, Linear style

Status: ready-for-agent

Ticket: MOR-72.

## Problem Statement

The task sheet stacks every section in one column: subtasks, relations, attachments, links, then the timeline. File cards download on click, videos show as a card, subtasks are a plain list with a one-line box, the timeline lists every event, and the properties panel shows every unset field.

## Solution

Rework the sheet and the full task page (they share `TaskDetails`) in four stages.

### Stage 1: files and video

- Remove the attachments list (`task-attachments.tsx`) from the sheet. Files live only inline in text.
- A file card opens the existing preview frame on click. Only its download icon downloads. A file with no preview type (zip and the like) shows the icon alone. Images open as they do now.
- Add `@kibo-ui/video-player` with `npx shadcn add`, replace its shadcn imports with the coss components, and move it to `design-system/ui/video-player.tsx`. Use it from there.
- A TipTap node view renders video files inline in descriptions and comments, like images: poster frame, controls, `preload="metadata"`, no autoplay. Audio stays a card. The preview frame uses the same component.

### Stage 2: properties panel

- The panel shows only properties with a value, plus one **Add property** control listing the unset ones (due date and custom Fields). Setting one shows it. Status is always visible. Priority, assignee and labels look as before.
- Remove "Set parent" from the panel.
- Add **Related**, **Blocked by** and **Blocking** sections: status icon and a truncated title per row, opening the task on click, and a "+" on each header to add a relation.
- Remove the relations section (`task-relations.tsx`) from the body. Remove the links section (`task-links.tsx`) from the UI; link data, API and MCP stay.

### Stage 3: activity

- Comments always show as cards, with the "Leave a reply" row.
- Created, status and priority events show as one-line rows with the actor, text and age.
- Runs of low-signal events (relations, parent changes, spec and link events) collapse into one row, "Show N events: <kinds>", which expands in place.

### Stage 4: parent line and sub-issues

- Under the title the sheet shows "Sub-issue of ✓ KEY-n Title" with a done-of-total pill, in place of `task-parent-link.tsx`. It opens the parent. Nothing shows without a parent. It has no set-parent action.
- The sub-issues section uses compact, non-draggable `TaskListRow` pieces: status icon, title, own-subtask pill, labels, blocked and blocking counts, due date, assignee. Nested subtasks are indented with an elbow connector.
- The header has a done-of-total ring and a display popover: Ordering (the existing sort options), Completed issues (All, Open, None), Nested sub-issues toggle, and display-property chips (Priority, ID, Status, Labels, Due date, Assignee). They are device preferences shared by all sheets.
- Selection is scoped to the sheet and clears on close. Selected rows get a checkbox and highlight, and use the shared bulk actions.
- The row context menu is the task menu plus "Remove from parent" and "Add sub-issue".
- "+ Add sub-issues" opens an inline composer built from the create-task form pieces: status circle, title, optional description, chips for the read-only Project, Priority, Assignee, Labels and "…" (due date, Fields), an attach icon, Cancel and Create. Create keeps the composer open with a cleared title. Enter submits, Esc or Cancel closes.

## Testing

Each stage adds or updates unit and component tests beside the code and runs typecheck, lint and the web unit tests for the touched area. Integration and e2e suites run once, after stage 4, along with a browser check of the sheet and the full page.

## Out of scope

Milestones, SLA, a links display property, changes to link data or MCP, document support.
