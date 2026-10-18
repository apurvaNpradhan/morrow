# 0007. Open from the local database

Status: accepted (2026-10-19). Amends the web section of [0001](0001-electric-tanstack-db-sync.md), which ruled out persistence for synced collections.

## Context

Every reload started from nothing: the bundle, the session, then about eight Shapes each waiting for up-to-date before the Workspace rendered. Opening a large Project downloaded its Tasks again (31k Tasks is about 18.7 MB of shape log), and a second tab repeated all of it. Linear opens straight into the app because its UI reads a database in the browser. Morrow already had Linear's split, small structure collections loaded in full and Tasks on demand; it lacked the local copy.

## Decision

**One OPFS SQLite database per browser**, through `@tanstack/browser-db-sqlite-persistence` (version pinned exactly; the core is pre-1.0). It is opened with top-level await in `local-database.ts`, so collections stay module-level constants and a boot can delete the file before any collection exists. Without OPFS there is no persistence and the app behaves as before. A `BrowserCollectionCoordinator` elects one writer tab per collection.

**The database belongs to one user, recorded as an owner stamp** in localStorage: the user id and a copy of the last session's user part (never the token). It is written after the first successful sync as that user and removed before any wipe starts; a boot without a stamp deletes the database file. A wipe cut short by a page unload (`handleUnauthorized` navigates away) is therefore finished by the next boot. A different user signing in is treated like a 401. Removing the stamp in one tab reaches the others through the `storage` event.

**Render first, check auth second.** On a stamped boot the session cache is seeded from the stamp, so `_authenticated` renders at once while `loadSession()` refreshes in the background; a missing session or a different user wipes and goes to sign-in. Loaders of a stamped boot wait for the local restore (the persisted readiness of each collection), not the network. Showing cached rows before the session is confirmed is accepted, as Linear does.

**Persistence is added where every collection already gets its options**: `persistedShape(shape, electricCollectionOptions(…))`. `schemaVersion` is a hash of the Shape's name and column names and types (`shapeSchemaVersion` in `@morrow/sync-schemas`), so a changed column resets only that collection's cache. Structure collections are eager and restored in full; Task collections stay on-demand and load each live query's rows from SQLite before Electric reconciles the subset. Skipping that refetch is not possible in TanStack DB 0.15 and waits upstream.

**`cleanupSyncedCollections()` is the wipe**: remove the stamp, stop the collections, close the database, delete the file. Its page cannot start collections again, so entering the authenticated area afterwards reloads the page once.

**Writes are unchanged.** Procedures need the network; there is no outbox.

## Consequences

- A reload paints from the local copy and catches up in the background; a second tab opens as fast as the first.
- Someone at this machine may see the last-synced data of an expired session until the first network response refuses it.
- The page waits for the database to open before it boots (milliseconds; five seconds at most, then no persistence).
- Upgrading the persistence packages is deliberate work.
