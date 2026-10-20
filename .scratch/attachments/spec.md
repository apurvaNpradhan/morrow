# Attachments in descriptions and comments

Status: ready-for-agent

## Problem Statement

A task cannot hold a screenshot, a PDF or a log file. People link to files hosted elsewhere or leave them out.

The storage vertical has a half-port of Kaneo's draft uploads: an `asset` table with `surface` states, an authenticated `/api/asset/:id` route, an hourly draft cleanup and presign helpers in `storage/lib/s3.ts`. Nothing uploads into it.

## Solution

Any file up to 100 MB can be attached to a task description or a comment.

- The browser uploads straight to R2 with a presigned PUT; the API signs, then verifies.
- PNG, JPEG, WebP and GIF render inline, recognised from their bytes. Every other file, and any image over 20 MB, renders as a card.
- Files belong to their task and are deleted with it.
- The asset model leaves room for documents, which add a `document_id` container later.

The decisions are recorded in [ADR 0010](../../docs/adr/0010-attachments.md).

## User Stories

1. As a Member, I want to paste a screenshot into a description, so that it shows inline without leaving the editor.
2. As a Member, I want to drag a PDF or a zip into a description or a comment, so that it is attached as a card with its name and size.
3. As a Member, I want an `/attach` slash command and a paperclip button on the comment composer, so that I can pick files without dragging.
4. As a Member, I want a placeholder with the filename and a progress bar while a file uploads, so that I know a 100 MB upload is moving.
5. As a Member, I want a failed upload removed and explained in a toast, so that nothing half-broken stays in my text.
6. As a Member, I want to click an inline image to see it full size in an overlay, with a link to the original.
7. As a Member, I want a card's PDF, image, video, audio or text file to open in a new tab, and anything else to download.
8. As a Member, I want inline images to keep their space while they load, so that a long description does not jump.
9. As a Viewer, I want to attach files to my comments, since I may comment.
10. As a Member, I want undo after deleting an image to bring back a working image.
11. As a Member, I want a duplicated task's files to survive deleting the original.
12. As a Member, I want an image copied from one task into another to keep working after the first task is deleted.
13. As an agent, I want `get_task` to return absolute asset URLs that I can fetch with my MCP token.
14. As a Member of another Workspace, I must not be able to fetch this Workspace's files, even with an asset id.

## Implementation Decisions

### Table `asset` (migration replaces the current shape)

- Columns:
  - `id`;
  - `workspace_id` (cascade);
  - `task_id` (nullable, cascade on task delete);
  - `object_key` (unique);
  - `filename`;
  - `mime_type`;
  - `size`;
  - `kind` (`image` | `file`);
  - `width`, `height` (nullable);
  - `source_asset_id` (nullable, no foreign key): the asset this one was copied from;
  - `created_by` (set null);
  - `created_at`;
  - `attached_at` (nullable: null means draft).
- **CHECK:** an attached asset has a container (`attached_at IS NULL OR task_id IS NOT NULL`). Documents later add `document_id` and turn this into "exactly one container".
- **Dropped:** `surface`, and the `draft-pending` state. The draft expiry index becomes a partial index on `created_at WHERE attached_at IS NULL`.
- **Not synced:** no Electric shape (the Attachments list ticket adds one).

### Object keys

- `assets/<workspaceId>/<assetId>` under `S3_KEY_PREFIX`, in the existing bucket.
- Keys never reach the client; it only sees `/api/asset/<id>`.

### Upload procedures (in `storage`)

1. **`assets.createUpload`** `{ workspaceId, filename, size, contentType }`:
   - checks `size` ≤ 100 MB, and that the caller has fewer than 20 open drafts in the Workspace (`TOO_MANY_UPLOADS`);
   - inserts the draft row;
   - returns `{ assetId, uploadUrl, headers }`. The presign covers `content-length` and `content-type`, with the existing TTL (`S3_PRESIGN_TTL_SECONDS`).
   - **Permission:** `workspace: read` here. The content permission is checked when the draft is claimed.
2. **`assets.finalize`** `{ assetId }`. The caller must be the draft's uploader. It:
   - HEADs the object; a missing object is `UPLOAD_MISSING`. A size other than the declared one, or over 100 MB, deletes the object and the row (`UPLOAD_INVALID`);
   - range-GETs the first 64 KB and sniffs PNG, JPEG, WebP and GIF;
   - for an image, reads width and height from the header;
   - an image over 20 MB, or bytes that are not one of the four formats, is `kind: file`;
   - stores the sniffed type for images and the declared type otherwise;
   - returns `{ id, kind, mimeType, size, width, height, filename }`.
- **Reused and removed:** the presign and HEAD code in `s3.ts` is reused. `buildDraftAssetObjectKey*`, `validateDraftAssetUploadInput` and the `surface` checks are removed.

### Markdown

- **Image:** `![filename](/api/asset/<id>?w=<w>&h=<h>)`.
- **File:** `[filename](/api/asset/<id> "<mime> <bytes>")`, alone in its paragraph.
- The server ignores the query string. A link to `/api/asset/` that is not alone in its paragraph stays an ordinary link.
- **Reference parsing:** one helper, `assetIdsIn(markdown)`, in `@morrow/sync-schemas`, used by the server and the editor.

### Claiming (one helper, `claimAssets(tx, { workspaceId, taskId, userId, markdown })`)

It is called inside the transaction of `tasks.create`, `tasks.updateDescription`, comment add and comment edit, task import and task duplicate. For each referenced id:

- **The caller's own draft in this Workspace:** set `task_id` and `attached_at`.
- **Already attached to this task:** nothing to do.
- **Attached to another task in this Workspace:** `CopyObject` to a new key, insert a new attached row for this task, and rewrite the id in the markdown before it is stored.
- **Anything else** (another user's draft, another Workspace, unknown): left untouched, so the link renders broken. Never an error.
- **A copy is made once per task and source** (`source_asset_id`). The editor keeps sending the old link while it autosaves; without this each save would copy again.

Duplicate goes through the same path, so the copy's files are its own.

### Serving `/api/asset/:id`

- **Access:** session or bearer token, and a Workspace member with `workspace: read`. A draft is visible only to its uploader.
- **Response:** `302` to a presigned GET (60 s), with `Cache-Control: private, max-age=50`.
  - `response-content-disposition`: `inline` for images, `application/pdf`, `video/*`, `audio/*` and `text/plain`; `attachment` for everything else, with the filename encoded as `buildContentDisposition` does today.
  - `response-content-type` is the stored type, or `application/octet-stream` when downloading.
- The route no longer streams bytes.
- `?download=1` (the card's download button) forces `attachment` for a viewable type.

### Cleanup

- **Drafts:** the `draft-upload-cleanup` cron (moved into `storage`) deletes drafts older than 24 h (`attached_at IS NULL`) and queues their keys.
- **Objects without rows:** a new nightly cron, `asset-orphan-sweep`, lists `assets/` and deletes objects with no row whose `LastModified` is over 24 h old. It covers task, project and workspace deletion with no per-path code, and gets a Sentry monitor like the other crons.
- **Content edits:** removing a reference deletes nothing; the file stays until its task is deleted.

### Editor (shared `TaskDescriptionEditor`, used by descriptions and comments)

- **Extensions:** Tiptap `Image` (with `w`/`h`, `loading="lazy"` and an aspect-ratio box), an `attachmentCard` node that parses and serialises the file link, and an `uploadPlaceholder` node.
- **Ways in:** paste and drop of files, the `/attach` slash command (hidden file input) and a paperclip button in `comment-composer.tsx`.
- **Upload:** `XMLHttpRequest` PUT for progress. Several files upload at once, each with its own placeholder.
- **Failure:** the placeholder is removed and a toast shows the error code's translation.
- **Card:** a type icon from the MIME type, the filename, a human size and a download button. Clicking opens `/api/asset/<id>` in a new tab.
- **Image overlay:** a `Dialog` with the image at its natural size, capped at the viewport, plus "Open original". Escape closes it.
- **Read-only:** comments render through the same editor, so cards and images work there too.

### Permissions

- **Descriptions:** `task: update`, already checked by the procedures that claim.
- **Comments:** comment permission, so Viewers can attach files to comments.

### MCP

`get_task` and `list_tasks` (with descriptions) rewrite `/api/asset/` links to absolute URLs from `MORROW_API_URL`. The asset route accepts the MCP access token: `resolveAssetBearerOrCookie` now tries it first (`verifyMcpToken` moved from `mcp` to `auth` for this), then a session bearer, then the cookie.

### Ops

`docs/deployment.md` gains the R2 CORS rule:

- allowed origin: `MORROW_CLIENT_URL`;
- allowed methods: `PUT`;
- allowed headers: `content-type`, `content-length`;
- max age: 3600.

It also notes that files are not included in exports or database backups (bucket versioning is the option if that matters).

### Error codes

All are translated in `en-US.json`:

- `UPLOAD_TOO_LARGE`
- `UPLOAD_MISSING`
- `TOO_MANY_UPLOADS`
- `UPLOAD_INVALID`
- `STORAGE_UNAVAILABLE`
- `ASSET_NOT_FOUND`

## Testing Decisions

- **API integration (`storage`):**
  - `createUpload` refuses over 100 MB, a non-member and a 21st open draft;
  - `finalize` by another user is refused;
  - `finalize` with a missing object is `UPLOAD_MISSING`;
  - a size mismatch deletes the object and is `UPLOAD_INVALID`;
  - PNG, JPEG, WebP and GIF bytes become `image` with the right dimensions;
  - a `.png` name over PDF bytes becomes `file`;
  - a 21 MB PNG becomes `file`.
  - Use the S3 test double from `s3.test.ts`.
- **Asset route:**
  - redirects a member with `inline` for a PDF and `attachment` for a zip;
  - refuses a non-member (403), an anonymous caller (401) and another user's draft (403);
  - accepts the MCP bearer token.
  - Extend `authorize-asset-access.test.ts`.
- **Claiming (`claimAssets`):**
  - an own draft is claimed;
  - another user's draft and another Workspace's asset are left alone;
  - an asset of another task is copied and the markdown rewritten;
  - task duplicate copies the files;
  - a comment post claims;
  - a description save that removes a link deletes nothing.
- **Cleanup:**
  - drafts older than 24 h are deleted and queued;
  - the orphan sweep deletes an object without a row past the grace period and keeps a fresh one and one with a row.
- **`assetIdsIn`:**
  - finds image and card links;
  - ignores other URLs;
  - handles query strings and titles.
- **Web:**
  - pasting an image inserts a placeholder, then an image with `w`/`h`;
  - dropping a zip inserts a card;
  - card markdown round-trips through the editor unchanged;
  - an upload error removes the placeholder and toasts;
  - the comment paperclip opens the picker.
- **MCP:** `get_task` returns absolute asset URLs.

## Out of Scope

These are follow-up tickets:

- An Attachments section in the task sheet (with an `asset` shape and manual delete).
- An MCP upload tool.
- Exports and imports that carry files.
- Documents as a second container.

Not planned at all:

- Image resizing, thumbnails or re-encoding.
- Inline PDF or video players.
- Captions, and resize handles.
- Per-workspace quotas.
- Deleting files when their reference is removed from the text.

## Further Notes

- Grilled 2026-10-20 (Q1–Q22).
- Kaneo reference:
  - `apps/api/src/task/controllers/stage-task-asset.ts` (presign and finalize);
  - `apps/api/src/storage/cleanup-assets.ts` (the text-diff cleanup we chose not to copy);
  - `apps/web/src/components/editor/insert-uploaded-asset.ts`;
  - `apps/web/src/components/task/extensions/attachment-card.tsx`.
