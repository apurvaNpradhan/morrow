# Documents

Status: ready-for-agent

## Problem Statement

Morrow has no place for writing that is not a Task: specs, notes, runbooks, meeting pages. People keep them elsewhere and link to them. Task descriptions are markdown saved whole, so two people editing one overwrite each other, which is fine for a description and not for a shared page.

## Solution

A Workspace has a tree of **Documents** (pages). A page can sit under a Project or at the Workspace root, and can hold child pages. Several people and agents edit a page at once, see each other's carets, and every change is checked by the server and attributed to its author.

The decisions are recorded in [ADR 0013](../../docs/adr/0013-collaborative-documents.md): server rebase over a Postgres commit log, one in-process authority per open page, a per-page SSE stream for edits and presence, ProseMirror JSON as content.

## User Stories

1. As a Member, I want to create a page at the Workspace root or in a Project, so that writing lives next to the work.
2. As a Member, I want to nest pages under pages, drag them to reorder or re-parent, and rename them inline in the tree.
3. As a Member, I want a page with children to show as a folder, without a separate folder type.
4. As a Member, I want to see the whole tree in the sidebar and a Project's pages in its Documents tab.
5. As a Member, I want to type in a page while a colleague types in it, and both of us to end with the same text.
6. As a Member, I want to see who else is on the page and where their carets and selections are.
7. As a Member, I want a second tab of the same page to stay in step with the first.
8. As a Member, I want to be warned before I leave a page with edits the server has not confirmed.
9. As a Member, I want to be told plainly, and keep my unsent text, when the page was archived, I lost access or the app was updated under me.
10. As a Viewer, I want to read pages and watch them change live, without being able to edit.
11. As a Member, I want to archive a page and everything under it, and restore it all.
12. As an Admin, I want to delete a page; its children move up one level and keep their order.
13. As a Member, I want to move a page, with its subtree, into another Project or to the root.
14. As a Member, I want slash commands, headings, lists, task lists, tables, code blocks, details, highlights, emoji, mentions of members, ticket references and `[[page]]` links.
15. As a Member, I want an outline of the page's headings.
16. As a Member, I want to drag blocks around with a handle.
17. As a Member, I want to paste or drop images and files into a page, as in descriptions.
18. As a Member, I want to find pages by title in the palette and by body text in search.
19. As an agent, I want to list, find and read pages as markdown with block ids, and replace, insert, delete or append blocks without overwriting what a person is typing.
20. As a Member, I want to undo an agent's change to a page in one action.
21. As a Member of another Workspace, I must not be able to read or edit this Workspace's pages, their stream or their files.

## Implementation Decisions

### Model

- **Document**: `id`, `workspace_id` (cascade), `project_id` (nullable, cascade), `parent_id` (nullable, no action: app code re-parents), `position` (fractional index among siblings), `title`, `icon`, `archived_at`, `archived_root_id`, `created_by`, `created_at`, `updated_at`.
- A page and its descendants share one `project_id`. Moving a page under a page in another Project, or to the root, rewrites the whole subtree's `project_id`.
- **Archive** stamps `archived_at` and `archived_root_id` on the page and every descendant in one transaction that holds their locks. Restore clears the rows whose `archived_root_id` is that page. Archived pages are hidden from the tree and read-only. A move into an archived subtree is refused. An archived Project makes its pages read-only.
- **Delete** is admin-only and permanent. Children move to the deleted page's parent, keyed into its position with `generateNKeysBetween`, keeping their order. The page's commits, body and files go with it.
- No caps on page count or depth.

### Content

- New package `packages/document-schema`:
  - the extension list (schema parts only, on `@tiptap/core`);
  - `getSchema()`;
  - `DOCUMENT_SCHEMA_VERSION`, with a committed fingerprint test of the schema spec;
  - per-attribute validators: `/api/asset/<id>` sources; http(s) or mailto hrefs; UUID block ids; mentions and page links inside the Workspace;
  - `assignBlockIds(doc)`;
  - markdown serializers and parsers for every node, including details, mention, `[[page]]`, ticket reference, image and file card;
  - the forked UniqueID, writing with `setNodeAttribute`.
- The web app adds node views, menus and the slash menu. Every custom node is split into a schema part (package) and a view part (web). The task description editor moves onto the package with no visible change.
- One installed copy each of `prosemirror-model`, `-transform` and `-state`, checked in CI. The Dockerfile copies the new package.
- Extensions:
  - from descriptions: StarterKit with `trailingNode: false`, TableKit, TaskList, CodeBlockLowlight, Placeholder, slash menu, ticket references, attachments, bubble link editor;
  - new in v1: UniqueID, DragHandleReact, Details (`persist: false`), Mention, `[[page]]` link, FileHandler, Highlight, Typography, Emoji;
  - the outline is built from headings and their ids, not the TableOfContents extension.
- Readers and archived pages get `editable: false`, and UniqueID does not update the document for them.
- 1 MB of content JSON per page. The client refuses a change past it before creating the step; the server checks the size in bytes.

### Tables

- `documents`: as above. Synced.
- `document_commits`: `doc_id`, `from_version`, `to_version`, `steps jsonb`, `ref` (unique with `doc_id`), `client_id` (namespaced under the session user), `actor_id` (no FK; renders as "Deleted user"), `via` (`web` | `mcp` | `system`), `schema_version`, `created_at`. Not synced. Kept forever in v1.
- `document_body`: `doc_id` (PK), `version`, `content jsonb`, `schema_version`, `markdown`, `text`, `derived_version`, `updated_at`. GIN expression index on `to_tsvector(text)`. Not synced.
- Migrations start at `0035`.

### Sync of the tree

- Shape `documents` in the `documents` Vertical's `shapes.ts`, registered in `platform/sync/shapes.ts`, columns in `@morrow/sync-schemas`. Filter: `workspace_id IN (membership)`. The publish and grant migration follows `docs/sync.md`.
- An eager collection, persisted with `persistedShape`, loaded in `$slug.tsx`, registered for cleanup.
- `updated_at` is bumped by the body job at most once a minute, never per commit. A shape test asserts that typing does not churn the row.
- Tree writes (create, rename, icon, move, archive, restore, delete) are Procedures in `withTxid`.

### Authority (API, in `documents`)

- A session per open page: `{version, doc, idIndex, recent step maps}`, created from `document_body` plus later commits and evicted when idle. A per-page mutex serialises commits and agent edits.
- `documents.commit({workspaceId, docId, baseVersion, ref, schemaVersion, steps})`:
  - Before the lock:
    - check the schema version;
    - `Step.fromJSON`;
    - attribute validators;
    - collect asset ids referenced in the changed ranges (nodes, `AttrStep`s, link marks) and copy other containers' assets the actor can read, idempotent on `(document_id, source_asset_id)`.
  - Under the mutex and one transaction:
    - `documents FOR NO KEY UPDATE`: the page exists, is in the Workspace and is not archived;
    - Project `FOR SHARE`;
    - return the stored result for a seen `ref`;
    - rebase through the step maps since `baseVersion`, dropping steps that no longer map;
    - apply to head; check size, `check()` on the changed ranges, and the role filter written per step (so a comment role can be added later);
    - append a `system` commit of repair `AttrStep`s: missing or duplicate block ids, links to copied assets;
    - claim the caller's drafts with `document_id`;
    - insert the commits.
  - After commit: update the session, publish on the stream, enqueue the body job.
  - Responds with every commit since `baseVersion`.
- Errors: retryable (network, 5xx, `RATE_LIMITED` with `Retry-After`), terminal (`FORBIDDEN`, `DOCUMENT_ARCHIVED`, `DOCUMENT_NOT_FOUND`, `DOCUMENT_TOO_LARGE`, `SCHEMA_MISMATCH`, `INVALID_STEP`). Added to `errors.ts` and `DOMAIN_KEYS`.
- The commit route gets its own body limit (1 MB plus overhead) in `mount.ts`. Other routes keep `MAX_IMAGE_REQUEST_BYTES`.
- A rate budget per (user, page) on commits and bytes, shared with MCP writes.

### Stream

- `documents.stream({workspaceId, docId, sinceVersion?})` over oRPC SSE. Events:
  - `init {version, content, schemaVersion}`;
  - `commit`;
  - `presence`;
  - `reset {version, content}`, when the client is too far behind to replay.
- Morrow's first streaming endpoint:
  - exempt it in `compress-responses.ts`;
  - keep a registry of streams by user and Workspace that closes them on member removal, role change or sign-out;
  - cap streams per user.

### Client

- One `applyCommits` path for the commit response and the stream:
  - apply a commit only when its `from_version` equals the local version;
  - buffer commits that arrive ahead;
  - ignore versions already held;
  - rebase unconfirmed local steps over the rest;
  - recognise own commits by `(actor, client)`.
- One commit in flight; local steps coalesce for 100–200 ms.
- Retryable errors back off and keep the steps. A terminal error makes the editor read-only, shows the unsent text for copying and reloads from head.
- An archive seen in the metadata shape turns an open editor read-only.
- Unsent steps live in memory. `beforeunload` and route changes ask while steps are pending. The guard is lifted before `handleUnauthorized` and in `onSyncedCollectionsCleared`; a 401 while editing shows the pending-loss notice. Attachment downloads use `<a download>` so they do not trip it.
- Large catch-ups are applied in chunks.

### Presence

- `documents.presence({workspaceId, docId, version, anchor, head})` at about 20 Hz. The sender maps its selection back past its unconfirmed steps.
- Published on the page stream in order after the commits of that version. Receivers map forward through recent step maps, clamp, and draw with a decoration plugin.
- A closed stream or a TTL with no updates removes the caret. Avatars show who is on the page.

### Body and search

- pg-boss queue in `platform/jobs`, `singletonKey = docId`. It runs when head is 100 versions past the body or after 30 s idle, plus a startup sweep of pages whose last commit is newer than their body.
- Writes content, markdown, text and `derived_version` with `WHERE version < $new`, bumps `documents.updated_at` (throttled) and evicts idle sessions.
- Titles are searched in the browser from the tree. Body hits come from the expression index into the existing `search` vertical's results and the command palette. Export includes pages as markdown.

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
- In the sidebar (Workspace pages, then one group per Project) and in a Documents tab per Project (same component, filtered).
- The drag handle shows when someone else's caret is in the block; the drag is not blocked.

### Permissions

- Resource `document`: viewer `[]` (read comes from `workspace: read`), member `create, update`, admin and owner `create, update, delete`.
- Added to `permissionResources`, the roles, `CAPABILITIES` and `role-permission-labels.ts`.
- A `DO $$` backfill migration adds it to stored `workspace_role` rows, as `0020` did, with an integration test like `label-comment-role-migration.test.ts`.
- Every documents Procedure takes `workspaceId` and checks that the page belongs to it.

### MCP

- Read, `readOnly`, scoped through `resolveScope`:
  - `list_documents`;
  - `find_document`;
  - `get_document`: markdown with block-id anchors and the version, rendered from head.
- Edit: `replace_block(id, md, baseVersion)`, `insert_after(id, md, baseVersion)`, `delete_block(id, baseVersion)`, `append(md, baseVersion)`, through `documents.editBlocks`:
  - runs under the page mutex;
  - `BLOCK_CHANGED` with fresh markdown if a commit since `baseVersion` touched the block;
  - otherwise parse with the shared schema, `assignBlockIds`, diff to minimal steps keeping child ids where the structure matches, nothing if unchanged.
- The commit's actor is the token's user, with `via = 'mcp'`.
- The page offers "Undo agent change" on an `mcp` commit: its inverse steps, mapped to head, committed as the current user.

### Activity, i18n, data

- Activity events for page create, move, archive, restore and delete. A `documents` i18n namespace. Pages in `export-data` and the demo seed.
- CONTEXT.md gains Document and Page.

## Delivery

One MOR ticket per slice, in this order. Each one is shippable.

0. **Docs.** This spec, ADR 0013, CONTEXT.md entries. *(Done with this spec.)*
1. **Schema package.**
   - Package, node split, the description editor moved onto it with no visible change.
   - `DOCUMENT_SCHEMA_VERSION` and fingerprint test, attribute validators, `assignBlockIds`.
   - Forked UniqueID, plugin allowlist test, single-copy check, Dockerfile.
2. **Pages with collaborative editing.**
   - Tables, permission and role backfill, metadata shape, tree Procedures with archive and delete.
   - `DocumentTree` in the sidebar and the Project tab.
   - The authority, repairs and typed errors; the stream and its SSE plumbing; a content-only body job.
   - The base extensions without files.
   - The client: `applyCommits`, the terminal-error path and the unsent-step guard.
   - Correct for a second tab and a second user from the first release.
3. **Presence.** Events on the stream, avatars, caret plugin.
4. **Derived body and search.** Markdown and text, the expression index, search results and palette, export.
5. **Attachments.** Asset migration, shape filter, commit body limit, copy before lock, fix-up steps, claiming, FileHandler, missing-asset view. No uploads into pages before this slice.
6. **Extensions.** DragHandle (with the "someone is editing" hint), Details, Mention, `[[page]]`, Highlight, Typography, Emoji, the outline.
7. **MCP.** Read tools, `editBlocks`, "Undo agent change".

## Testing Decisions

- **Schema package:**
  - every node round-trips to markdown and back;
  - the fingerprint test fails on a schema change without a version bump;
  - validators refuse foreign image sources, `javascript:` hrefs, malformed ids and out-of-Workspace mentions;
  - the browser's and the server's extension lists produce the same spec.
- **Commit Procedure:**
  - a stale base is rebased, not refused;
  - an invalid step, an over-size change and a schema mismatch are terminal with their codes;
  - a Viewer and a non-member are refused;
  - an archived page, and a page under an archived ancestor, are refused;
  - a repeated `ref` returns the stored result and inserts nothing;
  - a duplicate id from two concurrent drags is repaired by a `system` commit;
  - claiming and the asset fix-up happen in the commit transaction;
  - the author's own steps are never rewritten.
- **Convergence property test:**
  - N simulated clients on real `EditorState`s with the full plugin set;
  - random edits, delays, reconnects and drops;
  - all end with identical documents and unique block ids;
  - readers produce no steps.
- **Plugin allowlist:** opening a page, receiving a remote commit and being a reader dispatch nothing outside the allowlist.
- **Terminal recovery (web):** a terminal error makes the editor read-only, offers the unsent text and reloads to head.
- **Schema mismatch:** an old-version tab is frozen and asked to reload.
- **Role backfill migration:** stored roles gain `document` with the right actions.
- **Metadata shape:** typing in a page does not change the synced row within a minute.
- **Tree:**
  - delete re-parents the children in order;
  - archive and restore cover the subtree;
  - a move rewrites the subtree's `project_id`;
  - a move into an archived subtree is refused.
- **Stream:**
  - replay from `sinceVersion`;
  - `reset` when too far behind;
  - removed members and signed-out users are disconnected.
- **Playwright:** two browser contexts type into one page at once, converge, and show each other's carets. A third context as a Viewer sees the result live and cannot edit.
- **MCP:**
  - `replace_block` racing a human typing in the same block returns `BLOCK_CHANGED`;
  - racing an edit in a sibling block succeeds and keeps child ids;
  - "Undo agent change" restores the prior text with the human's later edits intact.

## Out of Scope

These are follow-up tickets:

- Version-history UI, and a retention rule for commits.
- Inline comments anchored to block ids.
- Backlinks ("Mentioned in").
- Agent edits as suggestions with review.
- Persisting unsent steps for offline editing.
- Templates.
- Public sharing.
- Mathematics, embeds, mermaid.
- Task descriptions on this editor.

Not planned at all:

- A separate folder type.
- Per-page permissions.
- Color, FontFamily, FontSize, LineHeight.
- Tiptap's paid platform extensions.

## Further Notes

- Grilled 2026-10-24 (Q1–Q28), then reviewed by three independent Opus critiques (codebase fit, prior art, protocol risks) and a synthesis. The review moved edits off Electric, replaced client rebase with server rebase, and added typed errors, server repairs, a schema version, the plugin allowlist and the role backfill.
- The user set the decisions on agent attribution (user with `via`), agent edits (live with undo), the 1 MB limit, and drag versus typing (allowed, with a hint). Commit retention (keep forever in v1) was not discussed and follows the recommendation.
- References:
  - `@stepwisehq/prosemirror-collab-commit` 1.0.5 (MIT), the model for the authority;
  - Fidus Writer (`consumers.py`), prosemirror-collab over Postgres with an in-memory doc per process;
  - Atlassian `@atlaskit/collab-provider`, for reconcile and reset;
  - Outline's `EditorVersionExtension`, for the schema-version gate;
  - Moment, "collab with AI is hard", for agent diffs.
