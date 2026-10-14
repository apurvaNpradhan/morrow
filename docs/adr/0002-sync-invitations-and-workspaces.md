# 0002. Sync invitations and workspaces

Status: accepted (2026-10-14). Supersedes parts of [0001](0001-electric-tanstack-db-sync.md): onboarding and the pages outside a Workspace now read synced data, and membership implies read.

## Context

Members synced live ([0001](0001-electric-tanstack-db-sync.md)), but the pages around them still read oRPC queries with hand-written invalidation: the members page mixed two sources, the switcher and the start redirect polled, and about 350 lines of cache-eviction code guessed which cached queries to drop when someone lost access to a Workspace. Two gaps also showed: an instance admin could open a Workspace they never joined but saw no synced data in it, and a Member whose custom role lacked `workspace: read` received the Workspace's members through sync even though the server answered "not found" for it.

## Decision

**Membership implies read.** Every role carries `workspace: read`. The roles API adds it to any role it saves, the roles editor shows it as always on, and a migration added it to existing custom roles. Shapes scoped by membership are therefore correct, with no permission logic in their filters.

**Instance admins reach other people's Workspaces through the administration pages only.** The `/$slug` entry point (`workspace.resolve`) is membership-only; a non-member admin sees "not found". The API's shared workspace-access check keeps its admin rule, so administration Procedures and MCP tools are unchanged. Tightening that check is a separate security decision.

**New shapes** (same rules as 0001: declared in the owning Vertical, columns from `@morrow/sync-schemas`, scoped by session):
- `workspaces`: Workspaces the user belongs to, plus those with a pending invitation for them, so an invitation can name where it leads. Web code lists only Workspaces the user is a member of.
- `workspace-invitations`: pending invitations of the user's Workspaces. Every Member sees them, as before; hiding them by role would need a role-filtered shape, which stays deferred.
- `my-invitations`: pending invitations whose email equals the session user's verified email. An unverified email matches nothing.
- Only `pending` rows sync, so an accepted or cancelled invitation leaves the browser as a delete. Expired-but-pending rows are filtered in the browser (`now()` is not available in a shape filter).
- The members user shape also includes the people who invited the user, so an invitation can name its sender.

**Reads that moved**: the Workspace switcher, the start redirect, onboarding, the `/$slug` route, the active workspace, the members page and the General page. Onboarding now waits on sync, the first non-Workspace page to do so. `workspace.full` and `members.pendingInvitations` are deleted. `workspace.list` stays because MCP tools use it.

**Resolving a Workspace URL.** The `$slug` loader looks the slug up in the synced Workspaces. A miss asks the server, which also resolves former slugs. The slug-alias table stays an oRPC query: it is rare history, and syncing it would put every former slug into every browser. The route keeps the Workspace's id, so a rename elsewhere keeps the tab on the same Workspace and `useCanonicalWorkspaceUrl` moves it to the new slug.

**Writes.**
- Better Auth performs Workspace `update`, `create` and `remove`, and invitation `invite`, `cancel` and `accept`. Their handlers wait with `awaitMatch` (or, for create, remove and accept, for the Member row).
- Name and description are an optimistic collection update.
- Slug rename and logo changes are Morrow-owned: they run in `withTxid`, return `txid` (null when nothing changed), and the caller waits with `awaitTxId`. These are `withTxid`'s first callers.

**Cache eviction replaced.** One watcher in the signed-in layout watches the user's own membership rows. When one disappears (removed, left, Workspace deleted) it drops the oRPC queries that still mention that Workspace and, if the tab is on it, goes to the start page. Roles, capabilities and activity stay on oRPC (activity because its table is unbounded and append-only).

**Startup.** The API entrypoint applies migrations before it loads the app, because Better Auth reads its tables as soon as it is created and a fresh database made the first boot exit.

## Consequences

- Everything a signed-in user sees outside roles, capabilities and activity is live. Adding a feature on these tables means a shape, not a query.
- The inviter's name, email and avatar also reach an invitee through the members user shape.
- A Workspace's name, logo and description now reach the browsers of people who only hold a pending invitation. This is more than the old `pendingInvitations` Procedure exposed (name only) and is the price of showing where an invitation leads.
- Instance admins lose the `/$slug` back door. Anything an admin needs inside a foreign Workspace must exist as an administration Procedure.
