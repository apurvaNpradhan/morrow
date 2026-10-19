# Open from the local database, like Linear

Status: ready-for-agent

Ticket: MOR-2. Spun off: MOR-41 (app shell: modulepreload, inline splash, service-worker precache).

## Problem Statement

Every reload starts from nothing. The browser loads the bundle, waits for the session, then opens about eight Shapes and waits for each to reach up-to-date before the Workspace renders. Opening a large Project then downloads its whole Task subset again: 31k Tasks is about 18.7 MB of shape log (roughly 1.9 MB gzipped), about 1.2 s from a cold Electric before ingest on the main thread. A second tab repeats all of it. The data was on this machine a moment ago, but the app shows a loading screen anyway.

Linear opens straight into the app because its UI reads from a database in the browser. Morrow already has Linear's split: small "structure" collections loaded in full and Tasks loaded on demand. What it lacks is the local copy.

## Solution

Synced collections are kept in a SQLite database in the browser (OPFS), through TanStack DB persistence. The first visit downloads from the network as today. After that, a reload paints the Workspace, sidebar and an open board from the local database at once, and Electric catches up in the background from where it left off.

The app renders first and checks auth second. If this browser holds a signed-in user's database, the authenticated layout renders from it while the session is checked in parallel. If the session is gone, or any request gets a 401, the local data is wiped and the user goes to sign-in.

Signing out, a 401 or deleting the account wipes the local database. A different user never sees the previous user's rows. Several tabs share one database: one tab writes each collection and the others follow. Browsers without OPFS behave exactly as today.

Writes are unchanged: they still go through Procedures and need the network. Offline, you can read what was last synced.

## User Stories

1. As a Member, I want a reload to show my Workspace, sidebar and Projects at once, so that reopening Morrow feels instant.
2. As a Member, I want a board I opened before to paint from the local copy on reload, so that I don't wait for thousands of Tasks to download again.
3. As a Member, I want changes others made while my tab was closed to appear shortly after the page opens, so that the local copy never stays stale.
4. As a Member, I want the board to update in place when fresh data arrives, without flashing or reordering, so that I can start working before the catch-up finishes.
5. As a Member, I want a second tab to open as fast as the first, so that opening links in new tabs is not slow.
6. As a Member, I want a change made in one tab to appear in my other tabs, so that tabs never disagree.
7. As a Member, I want a reload to resume the change stream from where it stopped, not re-download every structure Shape, so that reloads use little data.
8. As a Member offline, I want a reload to still show what I last synced, so that I can read my Tasks without a connection.
9. As a Member offline, I want a write to fail clearly instead of pretending to save, so that I don't lose work silently.
10. As a Member on first visit in this browser, I want the app to load as today, so that nothing is shown before data exists.
11. As a Member whose session expired, I want to be sent to sign-in as soon as the server refuses me, so that I'm not left on a page that cannot sync.
12. As a Member whose session was revoked elsewhere, I want the local data on this machine wiped on the next refusal, so that a revoked session does not keep my data around.
13. As a Member signing out, I want every tab to drop my data and leave the app, so that the next person at this browser sees nothing of mine.
14. As a second user signing in on the same browser, I want never to see the first user's Workspaces, Members, Projects or Tasks, even for a frame, so that accounts stay private.
15. As a Member deleting my account, I want the local copy deleted with it, so that nothing of mine is left on the device.
16. As a Member accepting an invitation as a different account, I want the previous account's local data wiped, so that the new account starts clean.
17. As a Member removed from a Workspace, I want its rows gone from my local copy once sync tells me, so that I keep nothing I've lost access to.
18. As a Member in a private window or a browser without OPFS, I want Morrow to work as it does today, so that missing storage support is never an error.
19. As a Member, I want an app update that changes a Shape's columns to discard only that collection's local copy, so that I never see rows in an old format and the rest stays cached.
20. As a Member returning to a page from the back/forward cache, I want it to work, so that browser navigation never leaves a dead page.
21. As a Member, I want my theme and other device preferences to survive sign-out as today, so that they stay preferences of the browser.
22. As the owner, I want the reload gain measured on `/demo-scale` before and after each stage, so that we keep persistence only where it pays.
23. As the owner, I want end-to-end tests that prove a reload renders with the network stalled, so that "renders from local" is a fact, not a hope.
24. As the owner, I want end-to-end tests that prove the previous user's data never appears, so that the privacy promise is guarded.
25. As the owner, I want the decision recorded in an ADR and AGENTS.md, so that the old "no persistence" rule no longer misleads agents.
26. As a developer adding a synced collection, I want persistence to come from the same shared options every collection uses, so that a new collection cannot forget it.
27. As a developer changing a Shape's columns, I want the cache reset to follow automatically, so that I cannot forget a version bump.

## Implementation Decisions

**Database and ownership**

- One OPFS SQLite file per browser, opened through `@tanstack/browser-db-sqlite-persistence` with its version pinned exactly. The core is pre-1.0 and changes weekly; upgrades are deliberate.
- The database belongs to one user. Its owner is recorded as an **owner stamp**: the user id, kept in localStorage so a boot can read it before any network request, together with a copy of the last session's user part (id, name, email, image, onboarding state). The session token is never copied: it stays in the HttpOnly cookie.
- Invariant: the stamp is written only after the first successful sync as that user, and it is removed *before* any wipe starts. A boot with no stamp, or with a stamp for a different user than the session, deletes the database file before any collection loads. So a wipe cut short by a page unload (for example `handleUnauthorized` navigating away) is finished on the next boot.
- Synced collections stay module-level constants. The database opens asynchronously, so persistence is given an adapter that defers each call until the database is open (every adapter method is already async). No collection becomes a factory.
- Multi-tab: a module-level `BrowserCollectionCoordinator` with a fixed name elects one writer per collection over Web Locks and `BroadcastChannel`. Removing the stamp in one tab (sign-out) is seen by the others through the `storage` event, and they clean up and leave for sign-in.
- Without OPFS (`PersistenceUnavailableError`), collections are created without persistence and behave as today. This is a browser capability, not a setting. Nothing is shown to the user.
- On `pageshow` with `persisted` (back/forward cache), the page reloads: the library terminates its worker on `pagehide`, and fresh instances are needed anyway.

**Collections and load strategy**

- Persistence is added in the shared collection options (next to `shapeOptions`), so every synced collection gets it the same way. Device preferences remain a `localStorageCollection` and are not persisted here.
- Structure collections (workspaces, workspace members, member users, workspace invitations, my invitations, projects, project columns, labels) are eager and persisted in full. They restore at boot and resume Electric from their stored offset and handle.
- Task collections (tasks, descriptions, comments, events, links) stay `syncMode: "on-demand"` and are NOT persisted (stage 3 dropped, see Progress); they would be persisted in on-demand mode: a live query's `where` loads matching rows from SQLite first, then Electric fetches the subset and the rows reconcile in place. Skipping that refetch is not possible with TanStack DB today; picking it up when upstream certifies on-demand snapshots is a later change.
- `schemaVersion` of each persisted collection is derived from its Shape in `@morrow/sync-schemas`: a stable hash of the Shape's name and its column names and types, as a positive 32-bit integer. A changed column resets only that collection's cache (the library's default `reset` policy for synced collections). Changes to a Shape's server-side `where` need nothing: Electric rotates the handle and the collection truncates.

**Boot and auth (render first, check auth second)**

- `loadSession()` already returns a cached session at once and refreshes it in the background, treating a missing session or a different user like a 401. On a cold boot with a stamp, the session cache is seeded from the stamp's copy of the last session, so `_authenticated` renders without waiting on the network. Without a stamp, the boot awaits the session as today.
- With a stamp, loaders of the authenticated layout and the Workspace route wait for the persisted restore of the structure collections, not for network up-to-date. Pages read with `useLiveSuspenseQuery` as today; restored rows release Suspense (`initialRender` with no network wait) and live updates follow.
- With no stamp (first visit, or after a wipe), loaders wait for network sync as today, and the stamp is written once the first sync succeeds.
- `cleanupSyncedCollections()` becomes the wipe: remove the stamp, clean up every synced collection, close the database, delete the file. Its callers are unchanged: sign-out, `handleUnauthorized`, account deletion, accepting an invitation as another account, and the sync devtools.
- Showing cached rows before the session is confirmed is accepted: after a session expires, someone at this machine may see the last-synced data until the first network response refuses it. This is the trade Linear makes.

**Writes and offline**

- No change to writes: handlers still call Procedures and wait with `awaitTxId` or `awaitMatch`. Offline writes (an outbox) are not part of this.
- `docs/sync.md` (formerly AGENTS.md) drops "no offline or SQLite persistence for synced collections" and keeps "no offline writes". ADR 0001's web section is amended by a new ADR (0009) that records this design and points back to it.

**Staging**

Each stage is its own commit and records its numbers in this spec's Progress section:

1. Measurement harness (below), with baseline numbers.
2. Persistence for the structure collections, the owner stamp, the wipe and render-first auth.
3. Persistence for the Task collections.

A stage that does not cut first board paint on reload by at least 30% on the "Fast 4G" profile, or that brings correctness bugs from the library, is dropped and the reason recorded.

## Testing Decisions

- Good tests here check what a person sees in a real browser against the real stack: what renders, from where, and whose data. They don't assert on SQLite tables, coordinator messages or library internals. Mocking OPFS or the coordinator would test the mocks.
- **Main seam: browser end-to-end tests** in a new `persistence.spec.ts`, run against the disposable Compose stack (Postgres, Electric, Caddy over HTTP/2 on `https://localhost:18173`, a secure context, so OPFS works). The prior art is `sync.spec.ts` and its helpers (`signUp`, `createWorkspace`, `twoPeople`, `createProject`). The key move: on the second load, Playwright stalls `/api/shapes/**` and the session request, so anything that renders came from the local database.
  - After a reload with shapes and session stalled, the Workspace sidebar, the Projects and an opened board's Tasks render.
  - With the stall lifted, a change another Member made during the stall appears without a reload.
  - After signing out and signing in as another user with shapes stalled, none of the first user's rows render (extends the existing sign-out test in `sync.spec.ts`).
  - With the session cookie cleared, a reload shows the cached Workspace, then lands on sign-in. A further reload with shapes stalled shows no Workspace data.
  - Two tabs in one browser context both render the board and both receive a live change, and neither logs an OPFS lock error.
  - Signing out in one tab sends the other tab to sign-in.
  - With `navigator.storage.getDirectory` stubbed to throw, the app loads and syncs as today.
- **Unit test:** the `schemaVersion` hash in `@morrow/sync-schemas` is the same for the same columns, changes when a column is added, removed or retyped, and is a positive 32-bit integer. Use the package's existing Vitest setup.
- **Existing unit tests updated where contracts change:** `_authenticated.test.tsx` (a stamped cold boot does not await the session; an unstamped one does) and `use-sign-out.test.tsx` (sign-out awaits the wipe).
- **Measurement harness (not a CI gate):** a Playwright script on `/demo-scale` (from `seed:demo`, 400k Tasks) that records, on reload, the time to first board paint and the time to up-to-date, with no throttling and with a "Fast 4G" profile, against the 31k-Task Project. It needs the large seed, so it is run by hand, and its numbers go into Progress.

## Out of Scope

- Offline writes, an outbox, or `@tanstack/offline-transactions`.
- Skipping the network refetch of persisted Task subsets (Linear's `canSkipNetworkHydration`); waits on upstream.
- App-shell work: modulepreload, inline splash, service-worker precache, vendor chunking, font preload (MOR-41).
- Persisting oRPC Query data (roles, capabilities, activity, admin).
- Encrypting the local database.
- A database per Workspace; Shapes span all of a user's Workspaces, so one database per user is enough.
- Any setting to turn persistence off.

## Further Notes

- Grilled 2026-10-19. Linear sources: wzhudev/reverse-linear-sync-engine (load strategies `instant`/`lazy`/`partial`, local vs full bootstrap, `lastSyncId`, per-user database, `schemaHash`), Tuomas Artman's talks via fujimon.com, and performance.dev's "How's Linear so fast?" (render first, authenticate second).
- Local measurements on `demo-scale`: structure tables are tiny (33 Projects, 165 Columns, 13 Members, 11 Labels), so their reload cost is round trips. The largest Project has 31k Tasks: about 18.7 MB of all-column shape log in 3 requests, 1.2 s from a cold Electric and 143 ms warm.
- Library facts checked against `@tanstack/db-sqlite-persistence-core` 0.4.10 (pins `@tanstack/db` 0.15.0, the version in use): `Date` values round-trip (stored with a `date` tag), so the `timestamptz` parser stays. `initialRender` does not support on-demand collections. Opening the OPFS database has a 30 s default deadline. On `pagehide` the worker is terminated. Load `@tanstack/db#db-core/persistence` before starting.
- To verify while implementing: whether `preload()` on a persisted eager collection resolves on restore or on network up-to-date. The loaders must wait on the restore either way.

## Progress

- **1. Measurement harness: written, baseline not captured.** `tests/e2e/measure-reload.mjs` (usage in its header). Not run: it needs the 405k-Task `demo-scale` seed and a signed-in browser state, neither available in the implementing session. Run it by hand before judging the 30% gate for stages 2 and 3.
- **2. Structure collections, owner stamp, wipe, render-first auth: done.** `persistence.spec.ts` (7 e2e tests) passes against the Compose stack: a reload with shapes and session stalled renders the Workspace, sidebar and Projects; a change made during the stall arrives once lifted; the previous user's rows never render for the next user; a gone session shows cached data, then leaves for sign-in and a further stalled load shows nothing; two tabs share the database without lock errors; sign-out in one tab sends the other to sign-in; without OPFS the app syncs as before. Web unit tests (603), `schemaVersion` tests and the stamp tests pass. The e2e specs for tasks, comments, history and two projects tests fail identically on untouched `main` (checked with a baseline stack), so they predate this work. Bug found by the e2e: the stamp's copy of the user went stale (an onboarding step re-rendered from it); it is now rewritten on every fresh session fetch. The 30% first-paint gate is not measured (harness needs the 405k seed).
- **3. Task collections: dropped, ticket MOR-51.** With persistence on `tasks` (on-demand) and the network stalled, the board stays on its skeleton: after a reload the collection holds 0 rows while its live query loads, so persisted rows do not reach the live query before the network subset answers (TanStack DB 0.15 / persistence 0.4.10; the spec's note that skipping the refetch is not yet possible is the same limit). Showing them early needs upstream support. Revisit when on-demand snapshots are certified.
