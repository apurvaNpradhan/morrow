# MCP good enough to run a project

Status: ready-for-agent

## Problem Statement

Running a project through an agent over MCP shows these gaps:

- every task change is one call;
- `list_tasks` omits descriptions, so reading a project is N+1 `get_task` calls;
- there is no way to filter by label, assignee or column, search text, or list a user's tasks across projects;
- a label must exist before it can be applied.

Already done in the working tree: `create_task` takes `column` and `labels`, `update_task` takes `addLabels`/`removeLabels`, and `comment_task` adds, edits and deletes comments.

## Solution

- **Batch tools:** `create_task`/`update_task` are replaced by `create_tasks`/`update_tasks`, which take 1–50 items and return one small result per item.
- **Reads:** `list_tasks` gains workspace-wide scope, filters, text search and an opt-in description, capped at 200 results.
- **Labels:** labels named in create or update are created when missing.

## User Stories

1. As an agent, I want to create 20 tasks in one call, each with column, priority, labels and assignee, so that seeding a project is one step.
2. As an agent, I want to retitle or reprioritise many tasks in one call, so that bulk edits are cheap.
3. As an agent, I want each item's result or error separately, so that one bad item does not hide the others.
4. As an agent, I want `list_tasks` with descriptions on request, so that I can read a project in one call.
5. As an agent, I want to filter by assignee (`me` or an email), label, column and archived state, so that I fetch only what I need.
6. As an agent, I want to search title and description text, so that I can find a task without knowing its id.
7. As an agent, I want to list my assigned tasks across every project of a workspace, so that I can work my queue.
8. As an agent, I want naming a missing label to create it, so that I do not have to check first.
9. As an agent without permission to create labels, I want a clear per-item error, so that I know why.
10. As an agent, I want to be told when a listing was cut at 200, so that I narrow the query.

## Implementation Decisions

- **`create_tasks`:** `{ workspaceId, projectId, items: [...] }`, 1–50 items. Each item has today's `create_task` fields (title, description, column, priority, assignee, dueDate, labels, at).
- **`update_tasks`:** `{ workspaceId, projectId, items: [...] }`, 1–50 items. Each item has today's `update_task` fields keyed by ticketId.
- **Application:** items run in order, one at a time, through the existing procedures; not all-or-nothing.
- **Results:**
  - per item: `{ ticketId, changed: [fieldNames] }`, plus `createdLabels` when labels were created;
  - on error: `{ index, error }`;
  - no whole tasks in the output.
- `create_task` and `update_task` are removed. The tool descriptions say "1–50 items".
- **Missing labels:** label resolution creates missing names with the default colour through the labels procedure. The permission is checked there; failure is that item's error.
- **`list_tasks` input:**
  - `workspaceId`;
  - `projectId?` (absent means every project the caller can read in the workspace);
  - `assignee?` (`"me"` or an email);
  - `label?` (name);
  - `column?` (name; only with `projectId`);
  - `query?` (case-insensitive match on title and description);
  - `includeArchived` (default false);
  - `withDescription` (default false);
  - `limit` (default and max 200).
- **`list_tasks` output:** `{ tasks, truncated }`. Each task has today's fields plus `project` (key) when listing workspace-wide, `labels` (names) and `description` when asked.
- **Server side:** filtering runs in a single query in a new tasks operation (or an extension of `list`), never in the MCP layer.
- Search is `ILIKE` on title and description; no full-text index until it is slow.
- `get_task` is unchanged apart from links (see `task-external-links`).

## Testing Decisions

- **Integration tests through the MCP endpoint (`mcp-endpoint.test.ts`):**
  - batch create with mixed valid/invalid items returns per-item results;
  - batch update changes only the passed fields;
  - a missing label is created and reported;
  - a role without label-create gets an item error;
  - filters by assignee `me`, label, column and query;
  - workspace-wide listing spans projects the caller can read and never others;
  - `truncated` is true past 200;
  - `withDescription` is absent by default.

## Out of Scope

- An `ensure_labels` tool.
- A global multi-type search tool (Kaneo has `search`).
- Duplicate-task, relations and time entries.

## Further Notes

- Grilled 2026-10-17 (Q8–Q11). Q11 (comment edit/delete) was already done.
- Kaneo reference: `packages/mcp/src/tools/register.ts` (no batch tools there).
