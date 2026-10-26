# 0014. Documents on Yjs and Durable Streams

Status: accepted (2026-10-26). Supersedes [0013](0013-collaborative-documents.md). Amends [0001](0001-electric-tanstack-db-sync.md): a page's content does not sync through Electric. Builds on [0005](0005-task-descriptions-apart.md), [0009](0009-local-database.md) and [0010](0010-attachments.md). Spec: `.scratch/documents/spec.md`.

## Context

ADR 0013 chose a server-rebase protocol over a Postgres commit log, written by us. Nothing had been built on it. It ruled out Yjs for two technical reasons:

- y-prosemirror rebuilt the whole document on each remote update, which breaks plugins that map positions;
- it deleted nodes that failed the schema, for every peer.

`@tiptap/y-tiptap` 3.0.10 (13 Oct 2026) fixes both. A remote update now replaces only the top-level blocks that changed. A client that cannot show some content pauses its editing instead of deleting the content.

Without those two reasons, Yjs removes most of what 0013 would have written:

- the authority and its rebase;
- the client commit queue;
- the first SSE endpoint and its registry of streams;
- carets mapped through steps;
- undo that only reverts your own changes;
- in-memory unsent steps.

Agents are coming to the app, with chat sessions that must survive a refresh. Morrow also wants Linear's model of version history: checkpoints, Restore, and author names on text.

Two Yjs transports were weighed:

- **y-electric**: updates are rows in Postgres, synced by Electric. No new service. But compaction is ours to build, presence would write a row per caret move through the WAL, and the package is at 0.1.x with its integration still marked "help wanted".
- **Durable Streams** (`@durable-streams/y-durable-streams`): an append-only HTTP stream per page, with server compaction, snapshots and ephemeral awareness. The same system later carries AI chat sessions (`@durable-streams/aisdk-transport`). AI SDK's own resumable streams would need Redis. The cost is a stateful service outside Postgres.

## Decision

**Content is a Yjs document per page**, edited through Tiptap's open-source Collaboration, CollaborationCaret and y-tiptap packages, against a schema in `packages/document-schema` shared by the browser and the server. Every block has an id. Clients give ids only to blocks they create, and the server repairs the rest.

**Durable Streams carries the update log and presence.** It runs self-hosted, as the Caddy-based server in its own container. `YjsServer` runs inside `api`. The browser reaches both only through Morrow's origin and an access-checking proxy:

- page updates by long-poll, which checks access on every poll;
- awareness by SSE, closed by the proxy every 60 s so that access is checked again.

**Postgres is the record.**

- `document_body` holds the content, markdown and text for search, export, MCP and recovery.
- `document_clients` maps each Yjs client id to a user and a `via`.
- `document_checkpoints` holds the version history.
- `documents` is the tree, a synced Shape as before.

The Durable Streams volume is backed up nightly. A lost volume is rebuilt from `document_body`, losing the edits since the last mirror (seconds, at worst about 30).

**Two processes from one image.** `api` is stateless HTTP. `worker` runs pg-boss queues, crons and the page job. One replica each, and no Redis. Postgres covers jobs and locks, and Durable Streams covers fan-out.

**Writes are checked twice.**

1. `api` checks each update without holding the page: membership and role, archive state, generation, size, client ids registered to the sender, node and mark names in the schema, attribute validators. A refused update is terminal. Yjs cannot take back an update its author has already applied, so the client turns read-only, offers its unsent text, drops its local copy and reloads.
2. A debounced job per page in `worker` (`document-settle`) loads the merged page and repairs what one update cannot show: structure that fails the schema, duplicate block ids, links to copied files. It writes these fixes from a `system` client. The same job mirrors the body, enforces the 1 MB limit through `documents.over_limit`, and takes interval checkpoints.

**Version history as Linear does.** A checkpoint is taken:

- before every agent run;
- on the first MCP write per token per page in each 10-minute window;
- every 10 minutes of changed content;
- before every restore.

Restore applies the checkpoint as a new change. It is the undo for agent edits. Author names come from the Yjs client id on each item.

**One edit engine for agents.** MCP and the later in-app agent use the same block operations on a `Y.Doc`, guarded by `BLOCK_CHANGED` against a state-vector version. MCP runs it in `api` for one call. The in-app agent will run it in `worker`, one block at a time.

**Unsent edits survive a reload.** Each page's `Y.Doc` is kept in IndexedDB per user and deleted at sign-out. This is not offline mode: edits reach nobody until the network is back, and nothing advertises otherwise.

**Schema changes.** Additive changes need only a version bump. A breaking change writes every page into a new stream generation from `document_body`.

## Consequences

- Morrow runs a third stateful service (Durable Streams) with its own volume and backup, and a second process (`worker`). `AGENTS.md` no longer says "single process".
- Page content lives in two places. Durable Streams holds the live log, and Postgres holds the record. Search and export can lag the live page by a few seconds.
- The server cannot drop part of an update. Refusals reset the author's editor, and repairs arrive a few seconds after the edit that caused them.
- The write check and the page job run outside a transaction with the update itself. A page archived between the check and the forward accepts that one update.
- Packages are pre-1.0 (`y-durable-streams` 0.2.x, `aisdk-transport` 0.0.x), and Electric has joined Databricks. The Durable Streams protocol is open (Apache-2.0) with a conformance suite, so another server can replace it.
- Dragging a block while someone types in it can lose the typing, because a move is a delete and an insert. The drag handle shows that someone is editing the block.
