# 0010. Attachments

Status: accepted (2026-10-20). Replaces the unused draft-upload code ported from Kaneo. Builds on [0005](0005-task-descriptions-apart.md) and [0006](0006-labels-comments-history.md).

## Context

Descriptions and comments are markdown edited in one Tiptap editor. People need to put files in them: screenshots inline, and any other file (PDF, zip, logs) as a card, up to 100 MB.

The public images (avatars, logos, backgrounds) go through the API to a public R2 bucket with a custom domain.

Kaneo uploads with a presigned PUT, tracks three states (`draft-pending`, `draft`, attached), streams downloads through the API, and deletes files by diffing asset ids in the old and new text of the description, comments and activity. That cleanup breaks undo, races with concurrent edits, and has to know every place text can live.

## Decision

**Presigned PUT straight to R2, then a verifying finalize.**

- Through the API, a 100 MB file crosses the box twice, holds a request open for minutes and dies on redeploy.
- Finalize HEADs the object for its size and reads its first 64 KB to recognise PNG, JPEG, WebP and GIF and their dimensions. Only recognised bytes render inline; nothing trusts the declared type or the extension.
- Two states: draft (`attached_at` null) and attached.
- **Cost:** a one-time CORS rule on the bucket.

**Same bucket, private by indirection.**

- Objects sit at `assets/<workspaceId>/<assetId>`; the client only sees `/api/asset/<id>`.
- The route checks membership and redirects to a 60-second presigned GET. Files never stream through the API.
- Anything opened inline opens on R2's origin, not Morrow's, so uploaded HTML or SVG cannot script against the app. Types that are not viewable are forced to download.
- A second, private bucket would add credentials and setup for protection the indirection already gives, as long as keys stay on the server.

**Files belong to a container, and cleanup follows the container.**

- `asset.task_id` cascades with the task. Documents will add `document_id`.
- Saving content claims the caller's drafts it references. A reference to another task's file copies it (`CopyObject`, inside R2) and rewrites the link, so a task's files are always its own. Duplicate and import use the same path. The copy remembers its source (`source_asset_id`), so the editor re-sending the old link while it autosaves finds the copy instead of making another.
- Removing a reference from text deletes nothing, so undo and history stay intact.
- Objects are deleted only when they have no row: drafts after 24 h, and a nightly sweep of `assets/` for objects whose rows are gone. That one sweep covers every delete path, present and future, without per-path code.

**Plain markdown.**

- An image is `![name](/api/asset/<id>?w=..&h=..)`. A file is a link alone in its paragraph, titled `"<mime> <bytes>"`. Only our own `/api/asset/` images load in the editor; any other image stays text, so a pasted remote image cannot phone home.
- The editor renders both richly. MCP, export and any other reader see working links.
- The markdown carries everything the editor shows, so the editor needs no shape. The Attachments list under the description does: `task-attachments` is the `asset` table read on demand one task at a time, attached rows only (a draft is its uploader's alone) and without the object key. Deleting a file there is the one way to free its storage; it removes the row, queues the object, and leaves links in the text to stop showing.

## Consequences

- One new kind of row, no new sync shape, one new cron, one CORS rule in the deployment docs.
- Removed files keep using storage until their task is deleted. An Attachments list with manual delete is the follow-up.
- Freed storage comes back up to a day after a delete.
- Links copied into another instance or Workspace render broken. Exports carry links, not files.
- Database backups do not include files; bucket versioning is the option if that matters.
- A file a browser can show (PDF, plain text, video, audio) previews in a frame inside the app, from the storage service's origin with no sandbox (a sandbox would stop the PDF viewer). Anything else downloads.
