# External links on a task

Status: ready-for-agent

## Problem Statement

A task cannot carry the URLs that belong to it: pull requests, designs, docs. People paste them into the description, where they are hard to find and agents cannot manage them.

## Solution

A `task_link` table, synced as one shape scoped by membership like labels.

- **Web:** the task details show a Links section under the description, with favicon, title and host.
- **MCP:** a `manage_link` tool adds, edits and removes links, and `get_task` returns them.

The server never fetches the linked page.

## User Stories

1. As a Member, I want to attach a URL with an optional title to a task, so that related work is one click away.
2. As a Member, I want each link to show its site's favicon, its title (or host and short path) and its host, so that I can tell links apart.
3. As a Member, I want to edit a link's title or URL and remove a link, so that links stay correct.
4. As a Member, I want adding a URL that is already on the task to do nothing, so that I do not get duplicates.
5. As a Member, I want a clear error for a non-http(s) URL, so that `javascript:` and similar never get stored.
6. As an agent, I want `manage_link` to attach a PR link to a task by ticket id, so that I can record my work.
7. As an agent, I want `get_task` to include links, so that I can see what is attached.

## Implementation Decisions

- **Table `task_link`:** id, workspaceId, taskId (cascade on task delete), url, title (nullable), createdBy, createdAt, updatedAt.
  - Unique `(taskId, url)`.
  - Drizzle migration with `REPLICA IDENTITY FULL`, publication and `GRANT SELECT … TO electric`, as in `0011_sync_workspace_members.sql`.
- **Validation (shared zod schema):** URL parsed with `new URL`, scheme `http:` or `https:` only, at most 2048 characters. Title trimmed, at most 200 characters, empty means null. At most 50 links per task (409 above that).
- **Adding a duplicate URL** returns the existing link, not an error.
- **Permission:** the same as editing the task. No new capability.
- **Shape:** declared once in the tasks Vertical's `shapes.ts`. Name and columns live in `@morrow/sync-schemas`; it goes into the registry in `platform/sync/shapes.ts`. Scoped by membership subquery like labels.
- **Writes:** oRPC procedures add/update/remove run in `withTxid`; the collection handlers `awaitTxId`.
- **Display:**
  - section under the description, oldest first;
  - favicon is an `<img>` of `https://<host>/favicon.ico` with `referrerpolicy="no-referrer"`, falling back to a globe icon on error;
  - title is the stored title, else host plus a short path;
  - host is shown without `www.`;
  - links open in a new tab with `rel="noopener noreferrer"`.
- **No server-side fetch** of title or favicon (SSRF), and no third-party favicon service.
- **MCP:** `manage_link` (action add/edit/remove, ticketId, url, optional title, linkId for edit/remove), following `manage_label`. Output is the link id plus the changed fields. `get_task` gains `links: [{ id, url, title }]`.
- **Activity:** add/remove are task events in the timeline if the history work supports a new event type cheaply; otherwise left for later.

## Testing Decisions

- **API integration:**
  - http(s) accepted;
  - `javascript:`, `data:`, `ftp:` and over-long values rejected;
  - a duplicate returns the existing link;
  - the 51st link is rejected;
  - a non-member cannot read the shape rows;
  - links are deleted with their task.
- **Web:** add → shows host and title; a favicon error shows the globe; edit and remove.
- **MCP:** `manage_link` round trip and `get_task` includes the links.
- Prior art: `labels-orpc.test.ts`, `shape-proxy.test.ts`, `mcp-endpoint.test.ts`.

## Out of Scope

- GitHub, GitLab and Gitea integrations, and auto-created links.
- Fetching page titles or previews.
- Showing links on cards.

## Further Notes

- Grilled 2026-10-17 (Q6, Q7, Q25, Q26).
- Kaneo reference: `apps/api/src/external-link/`, `apps/web/src/components/external-links/` (no favicons there; host via `link-host.ts`).
