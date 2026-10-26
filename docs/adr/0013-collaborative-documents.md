# 0013. Collaborative documents

Status: superseded by [0014](0014-documents-on-yjs-and-durable-streams.md) (2026-10-26). Never built. Was: accepted (2026-10-24). Amends [0001](0001-electric-tanstack-db-sync.md): a document's edits are not synced through Electric. Builds on [0005](0005-task-descriptions-apart.md), [0009](0009-local-database.md) and [0010](0010-attachments.md). Spec: `.scratch/documents/spec.md`.

## Context

Morrow needs pages: a Workspace wiki, optionally filed under a Project, that several people and agents edit at once. Task descriptions are markdown saved whole, so two editors overwrite each other. That is acceptable for a description, not for a shared page.

Three models were weighed:

- **Yjs** (y-electric, y-durable-streams, Hocuspocus, Tiptap Collaboration). Outline, Docmost, Plane, Linear and Electric's AI-editor demo use it, for Tiptap's ready-made collaboration pieces and for offline merging. Updates are opaque to the server, so validating the schema, checking a role per change and building an agent's edit all mean holding and inspecting a Y.Doc. y-prosemirror still rebuilds the whole ProseMirror document on each update in its released version, which breaks position-mapped plugins, and a node that fails the schema can be deleted for every peer.
- **prosemirror-collab** (client rebases). One authority holds the version; a stale submission is refused and the client rebases and resends. It can only say "accepted" or "stale". Any other refusal (a duplicate block id, an archived page, a size limit) leaves the client resending the same steps forever, and under contention slow clients starve. Moment, whose gist argues for this approach, runs the server-rebase variant itself.
- **Server rebase** (the `prosemirror-collab-commit` model). The authority maps incoming steps through everything committed since the client's base version, so a submission is never stale, and the server can answer accepted, repaired, retry or refused.

Morrow is one process with no offline writes ([0009](0009-local-database.md)), wants a role check and an actor on every change, and treats agents as editors. Every advantage Yjs has rests on offline editing or a masterless network, which Morrow rules out.

## Decision

**Server rebase over a Postgres commit log, with one in-process authority per open page.** We write the protocol ourselves on `prosemirror-transform`'s `Mapping` (about 200 lines), using `@stepwisehq/prosemirror-collab-commit` as the reference rather than a dependency.

**Content is ProseMirror JSON**, against a schema in `packages/document-schema` shared by the browser and the API. Every block has a UniqueID minted or repaired by the server. Markdown and plain text are derived from it for MCP, search and export; markdown is never the source of truth for a page.

**Tables.**

- `documents`: the tree (Workspace, optional Project, parent, fractional `position`, title, icon, archive stamps). A synced Shape, loaded in full and persisted like the other structure collections. Its `updated_at` moves at most once a minute.
- `document_commits`: one row per accepted commit, with the steps, the version range, the actor, `via` (`web` or `mcp`), the schema version and an idempotency `ref`. Not synced. Kept as attribution, not as replayable history.
- `document_body`: the current content of each page with its version, and the derived markdown and text. Not synced.

**Edits travel on a per-page stream, not Electric.** A Shape's filter depends only on the session, never the request. A commits Shape would send every keystroke of every Workspace to every open page, and replication lag would sit inside each round trip. Opening a page subscribes to `documents.stream` over oRPC SSE: an `init` with the content, then `commit` and `presence` events in one order, with replay from `sinceVersion` or a `reset` on reconnect. The metadata Shape still syncs through Electric.

**Write path.** A client keeps one commit in flight. Validation and asset copies happen before the lock. Under a per-page mutex and one transaction, the server:

1. locks the page `FOR NO KEY UPDATE` and its Project `FOR SHARE`;
2. returns the stored result if the `ref` was seen;
3. rebases the steps onto head;
4. checks size, the schema and the role;
5. appends repair steps as a system actor (missing or duplicate ids, links to another container's files);
6. claims the caller's drafts;
7. inserts the commits.

After the commit, it publishes on the stream and schedules the body job. The response holds every commit since the client's base. Refusals are typed:

- **retryable** (network, 5xx, 429): the client keeps its steps and backs off;
- **repaired**: the server fixes the steps instead of refusing them;
- **terminal** (role, archived, deleted, too large, schema): the editor turns read-only, keeps the unsent text for copying and reloads from head.

**Client steps are never rewritten.** Every server change is a separate step everyone receives, so the author never diverges.

**Schema version.** Every commit and stream carries `DOCUMENT_SCHEMA_VERSION`, fixed by a committed fingerprint of the schema spec. A mismatch is terminal for that tab and asks for a reload. A breaking schema change ships with a job that rewrites every body at head; commits from before it are not replayed.

**Body job.** A pg-boss job, one per page (`singletonKey`), runs after 100 versions or 30 seconds idle, plus a startup sweep. It writes the body and derived text with a `version <` guard and evicts idle sessions.

**Presence** rides the same stream: `{version, anchor, head}` at about 20 Hz, mapped forward by receivers. Tiptap's CollaborationCaret is Yjs-only; Morrow draws carets with its own decoration plugin.

**Agents edit in place, as the user.** MCP tools read markdown with block ids and a version. They edit by block with a `baseVersion`. If someone touched the block since, the tool returns `BLOCK_CHANGED` with fresh markdown. Otherwise the server applies the smallest diff under the same lock. The commit's actor is the token's user, with `via = 'mcp'`. Each agent commit can be undone from the page, as the inverse of its steps mapped to head. Suggestions with review are not in v1.

**Plugins must not write on their own.** Plugins must not dispatch on open, on remote commits or for readers. TrailingNode is off, the outline is built from headings rather than the TableOfContents extension, and UniqueID is forked to write ids with `setNodeAttribute`. A test lists every `appendTransaction` allowed.

## Consequences

- The server can check every change: schema, attributes, role, size and files, before anyone else sees it.
- Morrow gets its first streaming endpoint and its first in-memory state per entity. Both are safe only because Morrow is one process; a second process would need a shared lock and fan-out.
- Commits are kept forever in v1. A retention rule comes with the version-history UI.
- Dragging a block while someone types in it loses the typing (a move is a delete and an insert). The drag handle shows that someone is editing the block; the drag is not blocked.
- No offline editing. Unsent steps live in memory, and leaving the page or the route while steps are pending asks first.
- Moving to Yjs later is a migration of bodies (`prosemirrorJSONToYDoc`), not a rewrite. Revisit if pages need hours of offline editing, routinely have more than about ten simultaneous writers, or Morrow adopts Tiptap's paid platform.
