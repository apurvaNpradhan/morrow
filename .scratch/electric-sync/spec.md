# Electric + TanStack DB sync layer

Status: ready-for-agent

## Problem Statement

Morrow's web app reads everything through oRPC queries cached by TanStack Query. Data changed by someone else (another Member changing a role, a second tab) only shows up after a refetch or an invalidation someone remembered to write. The owner wants to build the next real feature on live, synced data, but the sync stack (ElectricSQL reading the Postgres WAL, TanStack DB collections in the browser) has never run in this codebase. Its packages are installed and unused, Postgres isn't configured for logical replication, there's no shape proxy, no convention for where collections, shapes and txids live, and no test proves any of it works in production on Dokploy.

Client-side preferences live in a Zustand store. Two of its five fields (`advancedSettings`, `weekStartsOn`) do nothing, a second store (`background`) is dead, and preferences don't sync between open tabs.

## Solution

Add the sync layer as a fixed part of Morrow, with no flag to turn it off, and prove it end to end with one real **synced collection**: the Members of the user's Workspaces.

- Electric runs as a second container next to Morrow and reads the existing Postgres through logical replication.
- The browser never talks to Electric directly. It asks Morrow for a **shape** by name. Morrow checks the session, decides the table, columns and filter on the server, and passes the request through.
- Writes still go through oRPC Procedures. Morrow-owned writes return a Postgres transaction id so the client knows when its change has come back through sync. Writes that Better Auth performs are matched on content instead.
- The members page, the "current member" lookup behind permission checks, and role changes all run on synced data. A role change in one tab shows up in every other tab and for every other Member without a reload.
- Device preferences (theme, compact mode, sidebar default) move to a TanStack DB localStorage collection, which syncs across tabs. Zustand and the dead preferences are removed.
- The decisions are recorded as ADR 0001, and AGENTS.md gets the sync rules, so the next feature follows them without re-deriving them.

## User Stories

1. As the instance owner, I want Electric to run as its own Dokploy app with no public domain, so that the sync service is never reachable from the internet.
2. As the instance owner, I want Electric to connect to the existing Postgres database service at the project level, so that I keep managing backups and restores for that database in Dokploy.
3. As the instance owner, I want Postgres configured for logical replication with a cap on retained WAL, so that a stopped Electric can't fill the database disk.
4. As the instance owner, I want Electric to use a dedicated database role that has only replication and read rights on synced tables, so that a leaked Electric credential can't change data.
5. As the instance owner, I want Electric's shape cache on a persistent volume, so that restarting the container doesn't force every client to re-sync from scratch.
6. As the instance owner, I want the runbook to list every manual step (Postgres settings, the replication role, the volume, the secret), so that I can rebuild the deployment from the docs.
7. As the instance owner, I want Morrow to refuse to start without `ELECTRIC_URL` and `ELECTRIC_SECRET`, so that a missing setting fails at deploy time instead of breaking sync silently.
8. As a developer, I want `pnpm dev:services` to start Electric next to Postgres and MinIO, with Postgres already set up for logical replication, so that sync works locally with no extra steps.
9. As a developer, I want local Electric to use a secret just as production does, so that the proxy follows one code path everywhere.
10. As a developer, I want each table that becomes a shape to be declared synced in a single Drizzle migration (replica identity, publication membership, read grant), so that I can see which tables are synced by reading migrations.
11. As a developer, I want `pnpm exec intent list` and `intent load` to work, so that agents load the TanStack DB and Electric skills shipped in `node_modules` as AGENTS.md says.
12. As a signed-in user, I want the members list of my current Workspace to load from synced data, so that it stays current without refreshing.
13. As a signed-in user, I want to see each Member's name, email, avatar and role, so that the members page shows what it shows today.
14. As a signed-in user, I want to sort and filter the members list, and page through it, as I can today, so that the move to synced data loses nothing.
15. As a Workspace admin, I want a role change I make to show up in my other open tabs without a reload, so that I'm never looking at stale state.
16. As a Member, I want another admin's change to my role to reach me live, so that my UI matches my real permissions.
17. As a Member whose role just changed, I want the actions I'm allowed to take (invite, manage members, manage roles…) to update as well, so that the UI doesn't offer actions the server will reject or hide ones I now have.
18. As a Member, I want a role change I make to appear right away and roll back if the server rejects it, so that the UI feels instant without lying to me.
19. As a user who joins a Workspace, I want its Members to appear in my synced data without a reload, so that switching to the new Workspace just works.
20. As a user removed from a Workspace, I want its Member data to drop out of my browser, so that I keep no data from a Workspace I no longer belong to.
21. As a user switching between my Workspaces, I want member data to show instantly, so that moving between Workspaces doesn't load again each time.
22. As a user hovering a link into a Workspace, I want sync to start before I click, so that the page is usually ready when it opens.
23. As a user whose first sync fails, I want a Workspace error screen with a retry button, so that a sync problem doesn't crash the whole app.
24. As a user whose session expires, I want to land on sign-in with my synced data cleared, so that an expired session behaves the same for synced data and for queries.
25. As a user who signs out, I want all synced Workspace data removed from the tab, so that the next person to sign in on this browser never sees my Members.
26. As a user who deletes my account, I want synced data cleared the same way as at sign-out, so that nothing of mine stays in the tab.
27. As a user, I want my theme, compact mode and sidebar preference to survive sign-out, so that device settings belong to the device and not to the session.
28. As a user, I want a theme change in one tab to apply in my other open tabs, so that tabs never disagree about the theme.
29. As a user, I want the theme applied before the first paint on reload, so that the page never flashes the wrong theme.
30. As a user, I want the theme change to keep its view-transition animation from where I clicked, so that the switch to the new storage changes nothing I can see.
31. As a user, I want the preferences page to show only settings that do something, so that I'm not offered an "advanced settings" toggle or a week-start choice with no effect.
32. As a user on a browser that had the old preference storage, I want the old key removed, so that stale data doesn't stay in my browser for good.
33. As an attacker with a valid session, I want to be unable to choose the table, columns or filter of a shape from the browser, so that I can't read rows outside my Workspaces or columns such as tokens.
34. As an attacker, I want a shape request without a session to be rejected, so that synced data never leaves without authentication.
35. As an attacker, I want an unknown shape name to be rejected, so that the registry is the only list of what can be synced.
36. As a developer adding a shape, I want to declare it once in my Vertical (name, table, column schema, filter from the session), so that the proxy, the column allowlist and the client types all come from one definition.
37. As a developer adding a Morrow-owned write, I want a helper that runs my change in a transaction and returns its txid, so that my collection handler can wait for the change to come back through sync without me handling the txid rules.
38. As a developer adding a write that Better Auth performs, I want a documented content-match pattern, so that I know to use it instead of a txid.
39. As a developer, I want one rule (a table is either a shape or an oRPC query, never both), so that two caches never disagree about the same rows.
40. As a developer, I want synced collections in a `collections` role folder inside the Vertical, next to `queries`, so that I find them where the layout predicts.
41. As a developer, I want shared shape options (proxy URL, camelCase column mapping, timestamp parsing, error handling) defined once, so that every collection gets the same behaviour.
42. As a developer, I want new synced collections registered for cleanup in one place, so that sign-out clears them without anyone remembering to.
43. As a developer, I want the members procedures the web app no longer calls removed, while the operation the MCP tool uses stays, so that there are no dead Procedures.
44. As a developer, I want CI to run the integration and e2e suites against real Postgres with logical replication and real Electric, so that a broken sync setup fails CI before it reaches Dokploy.
45. As a future agent, I want ADR 0001 and an AGENTS.md "Sync" section to state these rules, so that I follow them on the next feature without being told.
46. As a future agent, I want `CONTEXT.md` to define Shape, Synced collection and Device preference and to stop linking to ADRs that no longer exist, so that the glossary matches the repo.

## Implementation Decisions

**Infrastructure**

- Electric (`electricsql/electric`, pinned by digest) is a required second container. There's no flag, fallback or setting that runs Morrow without it.
- Production: a separate Dokploy application in the same project as Morrow and the Postgres database service, attached to the internal network only, with a persistent volume for its storage directory and `ELECTRIC_SECRET` set. It connects straight to Postgres, with no pooler.
- Postgres (the Dokploy database service) runs with `wal_level=logical` and `max_slot_wal_keep_size=10GB`. The `electric` role (`LOGIN REPLICATION`) is created by hand once and documented in the runbook, since a migration would have to contain its password.
- Local and CI: `compose.local.yml` and the e2e compose file both start Postgres with logical replication and an Electric service that has a development secret. Insecure mode isn't used anywhere. CI starts these through `docker compose`, because GitHub Actions service containers can't override the Postgres command.
- `.env.schema` gains `ELECTRIC_URL` (an internal URL, not public) and `ELECTRIC_SECRET` (a secret), both required.
- Publication is managed manually (Electric's manual table publishing). One migration creates the publication. Each later migration that makes a table synced sets `REPLICA IDENTITY FULL`, adds the table to the publication and grants `SELECT` to the Electric role, all in one migration. This spec makes `workspace_member` and `user` synced.
- `@tanstack/intent` becomes a root devDependency.

**Server sync module (a platform module in the API)**

- **Shape definition**: a name, a table, a Zod schema of the columns that may be sent, and a `where` builder that receives the authenticated context and returns SQL with positional parameters plus the parameter values. The column allowlist comes from the schema's keys and is required. Shapes have no way to send "all columns".
- **Shape registry**: name → definition, built from each Vertical's public `shapes` export, the same way routers are put together today.
- **Shape proxy route**: `GET /api/shapes/:name` on the Hono app.
  - Rejects with 401 without a Better Auth session and 404 for an unknown name.
  - Copies only Electric's protocol query parameters from the request. It sets `table`, `columns`, `where`, the positional params and `secret` itself.
  - Streams Electric's response back, minus `content-encoding` and `content-length`, and is excluded from the global `compress()` middleware.
- **Members shapes** (members Vertical):
  - `workspace-members`: rows of `workspace_member` whose `workspace_id` is in the user's own memberships (a subquery on user id). Columns: id, workspaceId, userId, role, joinedAt.
  - `workspace-member-users`: rows of `user` whose id belongs to a member of any of the user's Workspaces (a nested subquery). Columns: id, name, email, image, which matches what `listMembers` exposes today. If Electric rejects the nested subquery, stop and raise it. Don't work around it.
- **`withTxid`**: runs a callback inside a Drizzle transaction, reads `pg_current_xact_id()` inside that same transaction, and returns the callback's result with the txid. Every Morrow-owned write behind a synced collection must use it.
- **Write ownership rule**: Morrow-owned writes return `{ …, txid }` from the Procedure and the collection waits with `awaitTxId`. Writes Better Auth performs (member role, remove, leave, workspace update) can't give a txid. Their collection handlers use `awaitMatch` on the changed row's id and new value. Member role change in this spec follows the Better Auth path.
- Remove the `members.page` and `members.current` Procedures once the web app no longer calls them. Keep the `listMembers` operation, which the MCP tool uses.

**Shared schemas package**

- A new workspace package, `@morrow/sync-schemas`, holds the Zod schemas for every shape's columns, in camelCase. The API (allowlist, shape definition) and the web app (collection schema) both import it, so the web bundle never pulls API runtime code. It follows the package layout of `@morrow/permissions`.

**Web sync module (app-level)**

- Shared shape options: builds the proxy URL from a shape name and applies `snakeCamelMapper()`, a `timestamptz` → `Date` parser, and `onError` handling:
  - 401 → the existing unauthorized handler (clear and redirect), and stop the stream.
  - 403/404 → stop and report to Sentry.
  - 5xx and network errors → Electric's built-in backoff.
- Synced collection list plus `cleanupSyncedCollections()`. It runs next to `queryClient.clear()` on sign-out, on the 401 handler and on account deletion. Device preferences aren't on the list.

**Members collections and queries (web members Vertical)**

- Two synced collections, one per shape, created once at module level. They're scoped to the user, not the Workspace. Pages filter by the active Workspace id in live queries.
- A members live-query hook joins members with their users for the active Workspace. It supports the sort, filter and paging the members table uses today, all on the client.
- The current-member lookup becomes a live query (the user's own row in the active Workspace). It replaces the oRPC current-member query.
- The role-change mutation becomes a collection update whose handler calls the existing `updateRole` Procedure and then `awaitMatch`.
- The `workspace.can` capability query stays on oRPC (custom roles need the server), and its query key gains the current member's role, so a synced role change refetches capabilities with no extra listener.

**Routing and loading**

- The Workspace layout route (`$slug`) loader awaits `preload()` on both member collections. Components read with `useLiveSuspenseQuery`. The router's existing `defaultPreload: "intent"` starts sync on link hover.
- The `$slug` route gets an `errorComponent` that reuses the existing error-fallback look, with a retry button that invalidates the router. Pending UI stays on the router default.

**Device preferences (web app-level)**

- A `localStorageCollection` with `startSync: true`, holding one row with id `device` and the fields `theme`, `compactMode` and `sidebarDefaultOpen`, validated by Zod with defaults.
- A hook returns the row merged with defaults and offers an upsert. A theme setter wraps the update in the existing view-transition and click-coordinate behaviour.
- The old `user-preferences` localStorage key is deleted on first load. Preferences reset once.
- Remove `advancedSettings` and `weekStartsOn`: the advanced-settings switch (on the preferences page and the Workspace general page), the week-start row, their i18n keys, the dead `background` store and the `zustand` dependency.

**Rules recorded for later features**

- A table is either a synced shape or an oRPC query, never both. Auth, admin, onboarding and one-off reads stay on oRPC Query.
- Shapes are scoped to the user through membership subqueries. Use a per-Workspace collection only for a future table where some roles can't read.
- No offline or SQLite persistence for synced collections.
- `collections/` is a role folder inside a Vertical, next to `queries/`.

**Docs**

- `docs/adr/0001-electric-tanstack-db-sync.md` records the decisions above. ADRs 0001 and 0002 were lost in the repo re-init and aren't rebuilt.
- `CONTEXT.md`: remove the dead ADR links and add **Shape**, **Synced collection** and **Device preference** to the glossary.
- AGENTS.md: a short "Sync" section with the rules above.
- `docs/deployment.md` and `docs/runbook.md`: the Electric app, the Postgres settings, the replication role, the volume, the variables, and what to do if Electric is down for a long time (dropping the slot).

## Testing Decisions

A good test exercises behaviour at the highest available seam and asserts what a caller sees: HTTP status, which upstream URL was requested, rows that arrive in another tab. It doesn't assert how the registry or hooks are built inside. Two seams, both already in the repo:

**Seam 1: the API in-process with real Postgres** (prior art: `tests/api-integration/*`, which use `createApp().app`, `resetTestDatabase`, the mocked-session helpers and `createTestClient`).

- Shape proxy, through `app.request("/api/shapes/<name>?…")`, with only the outgoing fetch to Electric faked so the test can inspect the upstream URL and return a canned response. Cases:
  - 401 without a session.
  - 404 for an unknown shape name.
  - Only protocol parameters forwarded: a client-supplied `table`, `where` or `columns` is ignored.
  - `table`, `columns` (exactly the schema keys) and the `where` with positional params set from the session user.
  - `secret` attached.
  - `content-encoding` and `content-length` removed, and the response not re-compressed.
- `withTxid` against real Postgres: write a row through it and assert that the returned txid matches that row's `xmin`. A write outside `withTxid` doesn't match.
- Members Procedures: removed Procedures are gone. The `updateRole` Procedure still enforces the Better Auth role rules (existing coverage stays green).

**Seam 2: Playwright e2e against the compose stack with real Electric** (prior art: `tests/e2e/smoke.spec.ts`, `tests/e2e/compose.yml`).

- Two browser contexts as two Members of one Workspace. An admin changes a Member's role in context A, and the members list in context B shows the new role without a reload. Context B's permission-gated actions update to match.
- Two tabs of one user: a theme change in one applies in the other.
- Sign out, sign in as a different user in the same tab: the previous user's Members never appear.

There are no web component tests that mock collections. The members join, client-side sort and filter, and the preferences hook are covered through Seam 2. `pnpm test:integration`, `pnpm test:e2e`, `pnpm typecheck`, `pnpm lint` and `pnpm knip` must pass.

## Out of Scope

- Moving any other read to synced data (workspaces, invitations, roles, activity, admin) beyond what Members needs.
- Taking member writes away from Better Auth to get txids.
- Account-level preferences stored on the server (`weekStartsOn` comes back with a feature that reads it).
- Offline support or SQLite persistence for collections.
- Per-Workspace collections and role-filtered shapes.
- A real product feature on top of the sync layer. That's the next spec.
- Rebuilding the lost ADRs 0001/0002 or the earlier `.scratch` spec.

## Further Notes

- Work happens on branch `feat/electric-sync`, one commit per step, roughly in this order: Intent → Electric infrastructure and the publication migration → server sync module and `withTxid` → shared schemas and the members shapes → web sync module and members collections → preferences switch and dead-code removal → e2e and CI → ADR and docs.
- The skills shipped in `node_modules` (`@tanstack/db`, `@tanstack/react-db`, `@electric-sql/client`) target `@electric-sql/client` 1.5.10 and `@tanstack/db` 0.13. Installed versions are 1.5.28 and 0.13.0. Load `electric-proxy-auth`, `electric-postgres-security`, `electric-deployment`, `db-core/collection-setup` and `react-db` before the matching steps.
- Electric's subquery support in `where` (for membership) should be checked against the pinned image early, in the infrastructure step, because the members shapes depend on it.
- The decisions come from the 2026-10-14 grilling session (26 decisions plus the two test seams).
