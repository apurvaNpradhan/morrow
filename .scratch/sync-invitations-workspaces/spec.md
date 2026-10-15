# Sync invitations and workspaces

Status: ready-for-agent

## Problem Statement

Members now sync live through Electric, but the pages around them still read from oRPC queries cached by TanStack Query. The members page mixes two sources (synced members, oRPC invitations). The Workspace switcher, the home redirect, the Workspace name and logo and the invitation lists all depend on hand-written invalidation, and 348 lines of cache-eviction code guess which cached queries to drop when someone loses access to a Workspace. Several query keys are invalidated in about ten places although nothing reads them any more.

Two gaps in the first sync work also need closing. An instance admin can open a Workspace they never joined, but every shape is scoped through the user's own memberships, so that admin sees an empty members page. A Member whose custom role lacks `workspace: read` receives the members' rows through sync even though the server answers "not found" for that Workspace.

A fresh database also crashes Morrow at boot: Better Auth looks up a table before startup migrations have created it. The e2e stack hides this with a separate migrate step.

## Solution

Move invitations and Workspaces onto synced collections, remove the code that existed to compensate for polling, and close the two gaps by making the rules simple.

- Two invitation shapes (pending rows only): a Workspace's sent invitations, and invitations addressed to the signed-in user's email.
- A Workspace shape (name, slug, logo, description, created date) for every Workspace the user belongs to.
- Membership implies read. A role can no longer omit `workspace: read`; existing custom roles are fixed by a data migration. Every shape can then rely on membership alone.
- Instance admins open other people's Workspaces through the administration pages only. Inside `/$slug` a non-member admin sees "not found", like anyone else. The API's own workspace-access check keeps its admin rule, so admin and MCP flows are unchanged.
- The members page, the home redirect, onboarding, the switcher and the General settings page read synced data. The `workspace.list` and `workspace.full` Procedures are deleted.
- One watcher replaces the cache-eviction code: when the user's own membership row for a Workspace disappears, drop that Workspace's remaining cached queries and leave it.
- Startup order is fixed in the app, so a fresh database boots.
- The decisions are recorded as ADR 0002, which supersedes the parts of ADR 0001 it changes.

## User Stories

1. As a Member, I want pending invitations of my Workspace to appear on the members page without a reload, so that I see who has been invited.
2. As a Workspace admin, I want an invitation I cancel to disappear for every other open tab and Member, so that nobody sees a dead invitation.
3. As a Workspace admin, I want a new invitation I send to show up at once, so that the members page confirms what I did.
4. As an invited person, I want an invitation addressed to my email to show on my home page the moment it is sent, so that I do not have to refresh.
5. As an invited person, I want my pending invitations listed during onboarding, so that I can join an existing Workspace instead of creating one.
6. As an invited person, I want an accepted invitation to leave my list and my new Workspace to appear in my switcher without a reload, so that joining just works.
7. As a Workspace admin, I want the accepted invitation to turn into a member row live, so that the members page shows the new person.
8. As an invitee, I want an invitation that was cancelled or has been accepted to drop out of my list, so that I never click a dead link.
9. As a Member, I want every Member of my Workspace to see its pending invitations (as today), so that nothing I could see before is lost.
10. As a signed-in user, I want the Workspace switcher to list my Workspaces from synced data, so that a new or renamed Workspace shows up everywhere.
11. As a Workspace admin, I want a rename of the Workspace to appear live in other Members' sidebar and switcher, so that nobody works under a stale name.
12. As a Workspace admin, I want a change of the description to appear instantly for me and roll back if the server rejects it, so that editing feels immediate and honest.
13. As a Workspace admin, I want a new logo or a removed logo to show for every Member once saved, so that branding is consistent.
14. As a user, I want a Workspace I create to appear in my switcher and open without a reload, so that creation feels complete.
15. As a Workspace owner, I want a Workspace I delete to disappear from every Member's browser and send them off it, so that nobody is left on a page that no longer exists.
16. As a Member who is removed from a Workspace, I want to be taken off its pages at once, so that I do not keep working in a Workspace I lost.
17. As a Member who leaves a Workspace, I want my browser to drop its data and take me to my next Workspace or the start page, so that nothing of it stays.
18. As a user opening an old Workspace URL after a rename, I want to land on the new URL without a history entry, so that bookmarks keep working.
19. As a user opening the URL of a Workspace I do not belong to, I want "not found", so that I learn nothing about it.
20. As an instance admin, I want to manage any Workspace through the administration pages, so that I can help without joining it.
21. As an instance admin opening a Workspace I never joined through its URL, I want the same "not found" as anyone else, so that the rules are the same everywhere.
22. As a user who lands on the home route, I want to be sent to my last or first Workspace from synced data, so that the redirect does not wait on a separate request.
23. As a user in onboarding, I want the steps to know whether I have a name, a Workspace and an owned Workspace from synced data, so that the flow resumes in the right place.
24. As a Member with a custom role, I want the role to always include read access, so that being a Member always means being able to see the Workspace.
25. As a Workspace admin editing a custom role, I do not want a switch for read access, so that I cannot lock a Member out of their own Workspace.
26. As an owner with existing custom roles, I want them to keep working after the change, so that nobody gains or loses anything unexpectedly.
27. As a user whose sync fails on the first load, I want the existing retry screen, so that a sync problem does not crash the app.
28. As a user who signs out, deletes my account or switches account, I want all synced data removed before I am sent away, so that the next person never sees mine.
29. As a user whose session expires, I want to land on sign-in with synced data cleared, so that expiry behaves as before.
30. As the instance owner, I want Morrow to start against an empty database, so that a first deploy does not crash.
31. As a developer, I want the e2e stack to start without a separate migrate step, so that it matches production.
32. As a developer, I want a shape's name and column schema declared once and shared by the API and the web app, so that a collection cannot pair one shape's name with another's columns.
33. As a developer, I want no query keys or invalidations for data that is no longer read from the query cache, so that the code does not suggest two sources.
34. As a developer, I want the rename-slug and logo Procedures to return a transaction id, so that the page waits for the change to come back through sync.
35. As an attacker with a valid session, I want to be unable to read invitations addressed to other emails or sent by Workspaces I do not belong to, so that invitee addresses stay private.
36. As an attacker, I want a shape request without a session, with an unknown name, or with my own table, column or filter choices to be rejected or ignored, as before.
37. As a future agent, I want ADR 0002 and the AGENTS.md "Sync" section to state these rules, so that I follow them on the next feature.

## Implementation Decisions

**Order of work.** One branch cut from the Electric branch, one commit per step: dead cache code removed → shape names and schemas bundled → awaited cleanup → boot order fix → read-access rule → invitation shapes and pages → Workspace shape, pages and watcher → e2e → ADR and docs.

**Cleanup, first and alone**
- Delete invalidations of query keys nothing reads (the member list, active member and active-members keys) and their entries in the cache-eviction code. No behaviour changes.
- A shape's name and column schema are one exported object in the shared schemas package. The API's shape definition and the web collection each take that object, so the name is written once. The collection id derives from it.
- Sign-out, account deletion and account switch await `cleanupSyncedCollections()` before navigating. The 401 path stays fire-and-forget because it does a full page load.

**Boot order.** The API entrypoint applies migrations before the auth module is loaded (migrate first, then import the app dynamically). The e2e compose stack drops its migrate service and the restart workaround comments. Startup logging and failure behaviour stay as they are.

**Read access.** Every role carries `workspace: read`: built-in roles already do; custom roles get it enforced when a role is created or updated, the roles editor no longer offers the switch, and a data migration adds the permission to existing custom roles that lack it. Permission checks in the API stay as they are. With this rule, membership means read, and shapes scoped by membership are correct.

**Admin access.** The Workspace resolve Procedure no longer lets a non-member admin in; it becomes membership-only. The API's shared workspace-access check keeps its admin rule so the administration Procedures and MCP tools are unaffected. The administration pages are how admins reach foreign Workspaces.

**Shapes** (all scoped through the user's memberships or session, as before; declared in the owning Vertical and registered in the shape registry):
- `workspaces`: Workspace rows the user belongs to. Columns: id, name, slug, logo, description, createdAt. `metadata` is not sent.
- `workspace-invitations`: pending invitations of the user's Workspaces. Columns: id, workspaceId, email, role, status, expiresAt, createdAt, inviterId. Every Member sees them, as today.
- `my-invitations`: pending invitations whose email equals the session user's email. Same columns. The email is a positional parameter taken from the session, case-insensitively matched.
- One migration makes `workspace` and `invitation` synced tables (replica identity, publication, read grant to the `electric` role). Pending-only is a filter in the shape, not in the publication, so status changes reach the browser as deletes through the filter.

**Web collections** (in the `collections/` folder of their Vertical, created once, registered for cleanup):
- Workspace collection: `update` (name, description) is a collection mutation; its handler calls the existing update Procedure (performed by Better Auth) and waits with `awaitMatch` on the row's id and new values. Create and remove are plain mutations that wait with `awaitMatch` for the insert or the delete before navigating.
- Invitation collections: invite and cancel keep their Procedures (Better Auth); the mutations wait with `awaitMatch` for the new or removed row. Accept stays a Procedure; the page waits for the new membership row.
- Rename-slug and logo Procedures are Morrow-owned: they run in `withTxid`, return `{ …, txid }`, and their mutations wait with `awaitTxId`. These are the first real callers of `withTxid`.

**Loading.** The authenticated layout route preloads the Workspace, member and my-invitations collections, so Home, onboarding and the switcher read synced data. The Workspace route (`$slug`) additionally preloads the member-users and workspace-invitations collections. Failed first sync shows the existing retry screen.

**Resolving a Workspace URL.** The `$slug` loader finds the Workspace by slug in the Workspace collection. A miss calls a narrowed Procedure that resolves only former slugs (the alias table stays on oRPC) and returns the current slug, which the loader redirects to without a history entry. A miss there is "not found". The Workspace's own details (name, logo, description) come from the collection everywhere that used to call the resolve or get Procedures.

**Removed server surface.** `workspace.list` and `workspace.full` are deleted (MCP tools do not use them). Onboarding, the home redirect and the switcher compute what `list` gave (workspaces, my role, owned Workspace) from the Workspace and member collections. The old caller-role addition to `list` is not built.

**Eviction replaced.** The cache-eviction modules are replaced by one watcher mounted in the authenticated layout. When the user's own membership row for Workspace X leaves the member collection (removed, left, Workspace deleted), it removes every remaining oRPC query whose key names X (roles, capabilities, activity) and, if the user is on X, navigates to the start route. Roles, capabilities and activity stay on oRPC.

**Docs.** ADR 0002 "Sync invitations and workspaces" records: onboarding reads shapes; membership implies read; admins reach foreign Workspaces only through the administration pages; the alias table stays an oRPC query; the watcher replaces cache eviction. It supersedes the statements in ADR 0001 about onboarding staying on oRPC. AGENTS.md "Sync" and the CONTEXT glossary are updated to match.

## Testing Decisions

A good test exercises behaviour at the highest available seam and asserts what a caller sees: HTTP status, which upstream URL was requested, what another browser tab shows. It does not test how hooks or registries are built.

**Seam 1: the API in-process with real Postgres** (prior art: the shape proxy and `withTxid` tests, `workspace-read-boundaries`, `instance-admin-workspace-access`).
- Shape proxy: the three new shapes are served with the server-chosen table, columns, filter and params; `my-invitations` uses the session email; client-supplied table, where and columns are still ignored.
- Read rule: creating or updating a custom role always stores `workspace: read`; the migration adds it to an existing custom role that lacks it.
- Admin access: a non-member instance admin is "not found" at the resolve Procedure but still passes the shared workspace-access check.
- `withTxid` is exercised by rename-slug and logo: the returned id matches the changed row.
- The removed Procedures are gone; the narrowed alias resolver returns the current slug for a former slug and "not found" otherwise.
- Boot order: the app starts against an empty database (a test that runs the startup sequence on a fresh database).

**Seam 2: Playwright e2e against the compose stack with real Electric** (prior art: the smoke and sync specs).
1. An invitation sent in one tab shows on the invitee's home without a reload; on accept it disappears there and becomes a member for the admin.
2. A Workspace rename shows in another Member's switcher live.
3. An old Workspace URL redirects to the new slug.
4. A Member removed from a Workspace is taken off its pages live.

Existing web unit tests that mock the deleted queries are removed or reduced to pure helpers. `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm typecheck`, `pnpm lint` and `pnpm knip` (no new findings) must pass.

## Out of Scope

- Roles, capabilities and activity: they stay on oRPC (activity because the table is unbounded and append-only).
- Role-filtered shapes: invitee emails are visible to every Member.
- Per-Workspace "admin view" shapes and syncing foreign Workspaces to admins.
- Tightening the API's shared workspace-access check for admins.
- The slug alias table as a shape.
- Offline or SQLite persistence.
- A real product feature on top of the sync layer.

## Further Notes

- Decisions come from the 2026-10-14 grilling on follow-ups to the Electric work (Q1–Q24).
- Branch: `feat/sync-workspaces`, cut from `feat/electric-sync`.
- Facts found while grilling: the roles editor currently offers `workspace:read` as a toggle; instance admins can open foreign Workspaces today (and see empty members); `workspace.full` is read by only the members page and the General settings page; MCP tools do not use `workspace.full` or `workspace.list`.
