# Documents

Status: ready-for-agent

## Problem Statement

Morrow has no place for writing that is not a Task: specs, notes, runbooks, meeting pages. People keep them elsewhere and link to them. Task descriptions are markdown saved whole, so two people editing one overwrite each other. That is fine for a description and not for a shared page.

## Solution

A Workspace has a tree of **Documents** (pages). A page sits under a Project or at the Workspace root and can hold child pages. Several people and agents edit a page at once and see each other's carets. Every change is checked by the server, every piece of text knows its author, and the page keeps a version history that can be restored.

The decisions are in [ADR 0014](../../docs/adr/0014-documents-on-yjs-and-durable-streams.md), which supersedes [ADR 0013](../../docs/adr/0013-collaborative-documents.md). In short:

- the content is a Yjs document, edited through Tiptap's open-source Collaboration extensions (`@tiptap/extension-collaboration`, `@tiptap/extension-collaboration-caret`, `@tiptap/y-tiptap`);
- the update log and presence travel over Durable Streams (`@durable-streams/y-durable-streams`), self-hosted, behind Morrow's origin;
- Postgres stays the record: the body, checkpoints, authors and the tree;
- Morrow runs as two processes from one image, `api` and `worker`. There is no Redis.

## User Stories

1. As a Member, I want to create a page at the Workspace root or in a Project, so that writing lives next to the work.
2. As a Member, I want to nest pages under pages, drag them to reorder or re-parent, and rename them inline in the tree.
3. As a Member, I want a page with children to show as a folder, without a separate folder type.
4. As a Member, I want to see the whole tree in the sidebar and a Project's pages in its Documents tab.
5. As a Member, I want to type in a page while a colleague types in it, and both of us to end with the same text.
6. As a Member, I want to see who else is on the page and where their carets and selections are.
7. As a Member, I want a second tab of the same page to stay in step with the first.
8. As a Member, I want what I typed to survive a closed tab or a crash and be sent the next time I open the page.
9. As a Member, I want to be told plainly, and keep my unsent text, when the page was archived, I lost access, the page is over its size limit or the app was updated under me.
10. As a Viewer, I want to read pages and watch them change live, without being able to edit.
11. As a Member, I want to archive a page and everything under it, and restore it all.
12. As an Admin, I want to delete a page; its children move up one level and keep their order.
13. As a Member, I want to move a page, with its subtree, into another Project or to the root.
14. As a Member, I want slash commands, headings, lists, task lists, tables, code blocks, details, highlights, emoji, mentions of members, ticket references and `[[page]]` links.
15. As a Member, I want an outline of the page's headings.
16. As a Member, I want to drag blocks around with a handle.
17. As a Member, I want to paste or drop images and files into a page, as in descriptions.
18. As a Member, I want to find pages by title in the palette and by body text in search.
19. As a Member, I want to see who wrote each piece of text, a colleague or an agent.
20. As a Member, I want a page's version history, to preview an earlier checkpoint and restore it.
21. As an agent, I want to list, find and read pages as markdown with block ids, and replace, insert, delete or append blocks without overwriting what a person is typing.
22. As a Member, I want to undo an agent's change by restoring the checkpoint taken before it.
23. As a Member of another Workspace, I must not be able to read or edit this Workspace's pages, their streams or their files.

## Implementation Decisions

### Processes and services

- One image, two processes:
  - `api` handles HTTP and is stateless. It runs `YjsServer` (from `@durable-streams/y-durable-streams/server`) on a localhost port.
  - `worker` runs every pg-boss queue and cron, and the page job (below).
- One replica of each. Both use Postgres, so jobs and locks need nothing else. No Redis.
- **Durable Streams** runs as its own container: the Caddy-based server binary from the `durable-streams` releases, with a data volume. It gets no domain. Only `api` reaches it.
- The browser reaches everything through Morrow's origin. `api` proxies `/api/documents/yjs/*` to `YjsServer` after checking access.
- The Durable Streams volume is backed up nightly to R2. `document_body` in Postgres is the record. A lost volume is rebuilt from it (Recovery, below).

### Model

- **Document**: `id`, `workspace_id` (cascade), `project_id` (nullable, cascade), `parent_id` (nullable, no action: app code re-parents), `position` (fractional index among siblings), `title`, `icon`, `generation` (int, default 1), `over_limit` (bool), `archived_at`, `archived_root_id`, `created_by`, `created_at`, `updated_at`.
- A page and its descendants share one `project_id`. Moving a page under a page in another Project, or to the root, rewrites the whole subtree's `project_id`.
- **Archive** stamps `archived_at` and `archived_root_id` on the page and every descendant, in one transaction that holds their locks. Restore clears the rows whose `archived_root_id` is that page. Archived pages are hidden from the tree and read-only. A move into an archived subtree is refused. An archived Project makes its pages read-only.
- **Delete** is admin-only and permanent. Children move to the deleted page's parent, keyed into its position with `generateNKeysBetween`, keeping their order. The page's stream, body, clients, checkpoints and files go with it.
- No caps on page count or depth.

### Content

- New package `packages/document-schema`:
  - the extension list (schema parts only, on `@tiptap/core`);
  - `getSchema()`;
  - `DOCUMENT_SCHEMA_VERSION`, with a committed fingerprint test of the schema spec;
  - per-attribute validators: `/api/asset/<id>` sources; http(s) or mailto hrefs; UUID block ids; mentions and page links inside the Workspace;
  - `assignBlockIds(doc)`;
  - markdown serializers and parsers for every node, including details, mention, `[[page]]`, ticket reference, image and file card.
- The web app adds node views, menus and the slash menu. Every custom node is split into a schema part (package) and a view part (web). The task description editor moves onto the package with no visible change.
- One installed copy each of `prosemirror-model`, `-transform`, `-state` and `yjs`, checked in CI. The Dockerfile copies the new package.
- Extensions:
  - from descriptions: StarterKit with `trailingNode: false` and `undoRedo: false`, TableKit, TaskList, CodeBlockLowlight, Placeholder, slash menu, ticket references, attachments, bubble link editor;
  - collaboration: Collaboration (on the page's `Y.Doc`, fragment `default`), CollaborationCaret, and y-tiptap's undo, so undo reverts only your own changes;
  - new in v1: UniqueID, DragHandleReact, Details (`persist: false`), Mention, `[[page]]` link, FileHandler, Highlight, Typography, Emoji;
  - the outline is built from headings and their ids, not the TableOfContents extension.
- Block ids: a client gives ids only to blocks created by its own local transactions, never in a transaction that came from y-sync. The page job repairs missing and duplicate ids as `system`.
- Plugins must not write on their own. A reader or Viewer that emits an update is refused and reset, then emits it again, in a loop. A test lists every allowed `appendTransaction` and asserts that opening a page, receiving a remote update and being a reader emit no Yjs update.
- Readers and archived pages get `editable: false`.
- The client never seeds content. `documents.create` creates the page's stream holding an empty document from the shared schema.

### Tables

- `documents`: as above. Synced.
- `document_body`: `doc_id` (PK), `content jsonb`, `state_vector bytea`, `schema_version`, `markdown`, `text`, `size_bytes`, `updated_at`. GIN expression index on `to_tsvector(text)`. Not synced.
- `document_clients`: `(doc_id, yjs_client_id)` PK, `user_id` (no FK; renders as "Deleted user"), `via` (`web` | `mcp` | `agent` | `system`), `run_id` (nullable), `created_at`. Not synced.
- `document_checkpoints`: `id`, `doc_id` (cascade), `content jsonb`, `reason` (`agent_run` | `mcp` | `interval` | `restore`), `actor_id`, `run_id` (nullable), `editors` (user ids that edited since the previous checkpoint), `created_at`. Not synced.
- Migrations start at the next free number.

### Sync of the tree

- Shape `documents` in the `documents` Vertical's `shapes.ts`, registered in `platform/sync/shapes.ts`, columns in `@morrow/sync-schemas`. Filter: `workspace_id IN (membership)`. The publish and grant migration follows `docs/sync.md`.
- An eager collection, persisted with `persistedShape`, loaded in `$slug.tsx`, registered for cleanup.
- `updated_at` is bumped by the page job at most once a minute, never per update. A shape test asserts that typing does not churn the row.
- Tree writes (create, rename, icon, move, archive, restore, delete) are Procedures in `withTxid`.

### Streams

- One page is one Yjs document at `docs/{docId}/g{generation}` under the `YjsServer` service `morrow`. Awareness uses the `default` awareness stream on the same path.
- The client uses `YjsProvider`:
  - `liveMode: "long-poll"` for page updates. Each poll comes back through the proxy and checks access again, so a removed member stops receiving within one poll (about 30 s).
  - Awareness is SSE. The proxy closes each awareness connection after 60 s, and the provider reconnects and is checked again.
- The proxy is exempt from `compress-responses.ts` for these routes and gets its own body limit (1 MB plus framing). Other routes keep `MAX_IMAGE_REQUEST_BYTES`.
- `y-indexeddb` keeps the page's `Y.Doc` per user (`morrow:{userId}:doc:{docId}:g{n}`). Unsent edits survive a reload and are sent on the next visit. `cleanupSyncedCollections()` deletes every such database at sign-out. There is no `beforeunload` guard.

### Write path (`api`, stateless)

Every write (`POST` of an update or an awareness update) goes through one check before it is forwarded to `YjsServer`:

1. The session's user is a Member with `document: update`, the page belongs to the Workspace in the URL, the page and its Project are not archived, and `generation` matches.
2. The body is at most 1 MB. A smaller cap would refuse a large paste or a batch of edits sent after a reload.
3. The update is decoded with `Y.decodeUpdate`:
   - every struct's client id is registered to this user in `document_clients`;
   - every inserted element name and mark is in the schema;
   - every attribute passes the package's validators.
4. If `documents.over_limit` is set, only updates that insert nothing (a delete set alone) are accepted.
5. Asset ids found in inserted image and file nodes are claimed for the page (`claimAssetsInDoc`). Assets from another container the actor can read are copied, idempotent on `(document_id, source_asset_id)`. The page job rewrites the links to the copies.
6. The update is forwarded, and `document-settle` is enqueued for the page.

- Awareness updates are checked for the user's identity: the `user` field must be the session's user, so nobody can show a caret under another name.
- Client ids: before its first write, the editor calls `documents.registerClient({workspaceId, docId, clientId})`. The call is refused if another user holds that id, and the client then picks a new `clientID` before editing. MCP and `system` writes register their own ids.
- Refusals are typed: `FORBIDDEN`, `DOCUMENT_ARCHIVED`, `DOCUMENT_NOT_FOUND`, `DOCUMENT_TOO_LARGE`, `SCHEMA_MISMATCH`, `INVALID_UPDATE`, `RATE_LIMITED` (with `Retry-After`). Added to `errors.ts` and `DOMAIN_KEYS`.
- Network errors, 5xx and `RATE_LIMITED` are retried by the provider and keep the edits.
- Every other refusal is terminal:
  - the editor turns read-only;
  - it shows the text that wasn't sent, for copying;
  - the local IndexedDB copy is discarded;
  - the page reloads from the server.
- A rate budget per (user, page) on updates and bytes, in process memory, shared with MCP writes.

### The page job (`worker`)

- pg-boss queue `document-settle`, `singletonKey = docId`, started 5 s after the last write. A startup sweep enqueues every page whose stream is newer than its body.
- It loads the page from `YjsServer` (snapshot plus updates) into a `Y.Doc`, converts it with `yXmlFragmentToProseMirrorRootNode`, then:
  - **repairs**, as one update from a `system` client: missing or duplicate block ids, nodes that fail `check()`, and links to copied assets;
  - **measures** the ProseMirror JSON and sets or clears `documents.over_limit` (1 MB);
  - **mirrors** `content`, `state_vector`, `markdown`, `text` and `size_bytes` into `document_body`, and bumps `documents.updated_at` at most once a minute;
  - **takes an `interval` checkpoint** when the content changed and the last checkpoint is more than 10 minutes old.
- Nothing about a page is held in memory between runs.

### Author names and version history

- Every Yjs item carries the client id that wrote it. `document_clients` maps that id to a user and `via`.
- "Show author names" is a page display option. The web app reads each block's items, groups them by author and draws names in the margin. Agents read as "Agent for {name}".
- Checkpoints:
  - `agent_run`, before every agent run (the in-app agent is a follow-up);
  - `mcp`, the first MCP write per token per page in each 10-minute window, taken before that write;
  - `interval`, from the page job;
  - `restore`, before every restore.
- Retention: `agent_run`, `mcp` and `restore` checkpoints are kept. `interval` checkpoints older than 30 days are thinned to the last one of each day by a nightly cron.
- Version history panel:
  - a list of checkpoints with time, reason and editors;
  - a read-only preview;
  - **Restore**, which takes a `restore` checkpoint and then applies the checkpoint's content with `updateYFragment` as one `system` update attributed to the restoring user.

  There is no side-by-side diff in v1.
- Undoing an agent change means restoring the checkpoint taken before it.

### Presence

- CollaborationCaret, with `{name, color, userId}` from the session. Avatars show who is on the page.
- Awareness is not stored in Postgres. A closed provider removes its caret. The Durable Streams awareness heartbeat (15 s) removes stale ones.

### Search and export

- Titles are searched in the browser from the tree. Body hits come from the expression index into the existing `search` vertical's results and the command palette.
- Export includes pages as markdown from `document_body`.

### Attachments (amends ADR 0010)

- `asset.document_id` (nullable, cascade). The check becomes `attached_at IS NULL OR num_nonnulls(task_id, document_id) = 1`. Index `(document_id, source_asset_id)`.
- The `task-attachments` shape filter adds `task_id IS NOT NULL`.
- `claimAssetsInDoc(tx, scope, assetIds)` works over node attributes, not markdown. A missing asset renders as missing and is never a refusal.
- FileHandler uses the existing upload pipeline. The Attachments list and the cleanup sweep work keyed by `document_id`.

### Tree UI (web, `documents` Vertical)

- `DocumentTree`:
  - coss Collapsible (added from `@coss`) and Button, following the shadcn file-tree pattern;
  - `@dnd-kit/react` for reorder and re-parent;
  - `@tanstack/react-virtual`;
  - the existing context menu;
  - ARIA `tree` and `treeitem`, with keyboard navigation and inline rename.
- In the sidebar (Workspace pages, then one group per Project) and in a Documents tab per Project (the same component, filtered).
- The drag handle shows when someone else's caret is in the block. The drag is not blocked.

### Permissions

- Resource `document`: viewer `[]` (read comes from `workspace: read`), member `create, update`, admin and owner `create, update, delete`.
- Added to `permissionResources`, the roles, `CAPABILITIES` and `role-permission-labels.ts`.
- A `DO $$` backfill migration adds it to stored `workspace_role` rows, as `0020` did, with an integration test like `label-comment-role-migration.test.ts`.
- Every documents Procedure and proxy route takes `workspaceId` and checks that the page belongs to it.

### Edit engine and MCP

- `documents/lib/edit-engine.ts` works on a `Y.Doc`:
  - `read(doc)` returns markdown with block-id anchors and a `version`, the base64 of the encoded state vector;
  - `replaceBlock(id, md, version)`, `insertAfter(id, md, version)`, `deleteBlock(id, version)` and `append(md, version)`.
- An edit returns `BLOCK_CHANGED`, with the block's fresh markdown, if any item inside the block was created or deleted after `version`.
- Otherwise the engine parses the markdown with the shared schema, runs `assignBlockIds`, keeps child ids where the structure matches, and applies the change with `updateYFragment` in one transaction. It does nothing if nothing changed.
- MCP runs the engine in `api` for the length of one call: load the page from `YjsServer`, take the `mcp` checkpoint when due, apply the change, write one update under the token's MCP client id (`via = 'mcp'`, user = the token's user), then enqueue `document-settle`.
- Read tools (`readOnly`, scoped through `resolveScope`): `list_documents`, `find_document`, `get_document`.
- Edit tools: `replace_block`, `insert_after`, `delete_block`, `append`.
- The in-app agent (a follow-up) uses the same engine in `worker`, applying one block at a time.

### Schema changes

- An additive schema change bumps `DOCUMENT_SCHEMA_VERSION` and needs nothing else. An old tab that meets content it cannot show is paused by y-tiptap and asked to reload.
- A breaking change ships with a job that writes each page from `document_body` into generation n+1 and bumps `documents.generation`. A tab on generation n sees the bump in the tree shape, or gets `SCHEMA_MISMATCH`, and reloads.

### Recovery

- `scripts/rebuild-document-streams.ts` recreates every page's current generation from `document_body`, for a lost Durable Streams volume. It is documented in the runbook.

### Activity, i18n, data

- Activity events for page create, move, archive, restore and delete. A `documents` i18n namespace. Pages in `export-data` and the demo seed.

## Delivery

One MOR ticket per slice, under MOR-73, in this order. Each one blocks the next and is shippable.

0. **Docs** (MOR-74). This spec, ADR 0014, CONTEXT.md, `AGENTS.md`, `docs/sync.md`. *(Done with this spec.)*
1. **Schema package** (MOR-75). The package, the node split, the description editor moved onto it with no visible change. `DOCUMENT_SCHEMA_VERSION` and its fingerprint test, the attribute validators, `assignBlockIds`, the markdown round trip, the single-copy check, the Dockerfile.
2. **Processes and Durable Streams** (MOR-76). The `worker` process, the Durable Streams container, `YjsServer` in `api`, the auth proxy (long-poll, the 60 s awareness cap, the compression exemption and body limit), compose, deployment and runbook, the nightly volume backup, the rebuild script. No user-visible change.
3. **Pages** (MOR-77). Tables, the permission and its backfill, the tree shape and Procedures with archive and delete, `DocumentTree` in the sidebar and the Project tab, stream creation, the editor on `YjsProvider` with the base extensions (no files), client registration, the stateless write check and the terminal reset, IndexedDB with cleanup at sign-out, the plugin allowlist test. Several people can edit from this slice on.
4. **Page job and presence** (MOR-78). `document-settle` with repairs, `over_limit` and the body mirror (content only), CollaborationCaret and avatars, the awareness identity check, the convergence property test, Playwright for two editors and a Viewer.
5. **Derived body and search** (MOR-79). Markdown and text, the expression index, search results and palette, export.
6. **Version history and author names** (MOR-80). `document_checkpoints`, interval checkpoints and thinning, the history panel with preview and Restore, author names.
7. **Attachments** (MOR-81). The asset migration, the shape filter, claiming and copying in the write path, the link rewrite in the page job, FileHandler, the missing-asset view.
8. **Extensions** (MOR-82). DragHandle (with the "someone is editing" hint), Details, Mention, `[[page]]`, Highlight, Typography, Emoji, the outline.
9. **MCP** (MOR-83). The edit engine, the read and edit tools, `mcp` checkpoints.

## Testing Decisions

- **Schema package:**
  - every node round-trips to markdown and back;
  - the fingerprint test fails on a schema change without a version bump;
  - the validators refuse foreign image sources, `javascript:` hrefs, malformed ids and out-of-Workspace mentions;
  - the browser's and the server's extension lists produce the same spec.
- **Write check:**
  - a Viewer, a non-member and another Workspace's page are refused;
  - an archived page, and a page under an archived ancestor or in an archived Project, are refused;
  - an update over 1 MB, an unknown node name, a bad href and a client id owned by someone else are terminal with their codes;
  - while `over_limit` is set, an insert is refused and a pure delete passes;
  - a spoofed awareness `user` is refused;
  - a wrong `generation` is `SCHEMA_MISMATCH`.
- **Proxy:** a removed member gets no updates after the next poll, and their awareness connection closes within 60 s.
- **Page job:**
  - duplicate ids from two concurrent splits are repaired by one `system` update;
  - `over_limit` is set over 1 MB and cleared under it;
  - the body mirrors content;
  - an interval checkpoint is taken only after 10 minutes and a change.
- **Convergence property test:** N simulated clients on real editors with the full plugin set, random edits, delays, reconnects and drops. All end with identical documents and unique block ids, and readers emit no updates.
- **Plugin allowlist:** opening a page, receiving a remote update and being a reader emit nothing.
- **Terminal reset (web):** a terminal refusal turns the editor read-only, offers the unsent text, discards the IndexedDB copy and reloads.
- **Persistence (web):** text typed while the network is down survives a reload and reaches a second client once the network is back. Sign-out deletes the IndexedDB databases.
- **Role backfill migration:** stored roles gain `document` with the right actions.
- **Metadata shape:** typing in a page does not change the synced row within a minute.
- **Tree:**
  - delete re-parents the children in order;
  - archive and restore cover the subtree;
  - a move rewrites the subtree's `project_id`;
  - a move into an archived subtree is refused.
- **Version history:**
  - Restore brings back the checkpoint's content, and the page gains a `restore` checkpoint first;
  - thinning keeps one interval checkpoint per day past 30 days and keeps every `mcp` and `restore` checkpoint.
- **Author names:** text from two users and an MCP token shows three authors.
- **Playwright:** two browser contexts type into one page at once, converge and show each other's carets. A third context as a Viewer sees the result live and cannot edit.
- **MCP:**
  - `replace_block` racing a human typing in the same block returns `BLOCK_CHANGED`;
  - racing an edit in a sibling block succeeds and keeps child ids;
  - the first MCP write in a window takes an `mcp` checkpoint, and restoring it undoes the agent's change with later human edits elsewhere kept in a new checkpoint.

## Out of Scope

These are follow-up tickets:

- The in-app agent: AI SDK chat over `@durable-streams/aisdk-transport`, agent runs as pg-boss jobs on a live page peer, "composing" presence, highlighting of agent edits while the chat is open, token-by-token streaming.
- A side-by-side diff in version history.
- Inline comments anchored to block ids.
- Backlinks ("Mentioned in").
- Agent edits as suggestions with review.
- Templates.
- Public sharing.
- Mathematics, embeds, mermaid.
- Task descriptions on this editor.

Not planned at all:

- A separate folder type.
- Per-page permissions.
- Color, FontFamily, FontSize, LineHeight.
- Tiptap's paid platform and Pro extensions.
- Redis.

## Further Notes

- First grilled 2026-10-24 (Q1–Q28) on a server-rebase design (ADR 0013). Re-grilled 2026-10-26 (Q1–Q22), which moved the content to Yjs over Durable Streams.
- What changed the decision: `@tiptap/y-tiptap` 3.0.10 (13 Oct 2026) replaces only the changed top-level blocks on a remote update, instead of the whole document, and pauses a client that cannot show some content instead of deleting it. Those were ADR 0013's two technical reasons against Yjs.
- Durable Streams was chosen over y-electric for built-in compaction, presence kept out of Postgres, and one system for the later AI chat sessions.
- The user set: refusal resets the client; version history, checkpoints and author names in v1, as Linear does; MCP undo is Restore; the in-app agent and MCP share one edit engine; edits apply a block at a time; `api` and `worker` processes; no Redis.
- References:
  - [Durable Streams Yjs protocol](https://github.com/durable-streams/durable-streams/blob/main/packages/y-durable-streams/YJS-PROTOCOL.md);
  - [Electric's collaborative AI editor](https://electric.ax/blog/2026/04/08/ai-agents-as-crdt-peers-with-yjs), for the agent as a Yjs peer;
  - Linear's [documents](https://linear.app/docs/documents) and its [2026-07-23 changelog](https://linear.app/changelog/2026-07-23-agent-assisted-editing), for checkpoints and author names;
  - Outline's `EditorVersionExtension`, for the schema-version gate.
