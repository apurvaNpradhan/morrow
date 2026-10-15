# 0001. Sync with Electric and TanStack DB

Status: accepted (2026-10-14)

## Context

The web app read everything through oRPC queries cached by TanStack Query. A change made elsewhere (another Member, a second tab) showed up only after a refetch or an invalidation someone remembered to write. The next real feature needs live data, so the sync stack is a fixed part of Morrow, proven first on one table: the Members of the user's Workspaces.

## Decision

**Infrastructure**

- Electric is a required second container, pinned by digest. There is no flag, fallback or setting that runs Morrow without it. In production it is its own Dokploy application in the same project as Morrow and the Postgres database service, on the internal network only (no public domain), with a persistent volume for its storage directory. It connects straight to Postgres, not through a pooler.
- Postgres runs with `wal_level=logical` and `max_slot_wal_keep_size=10GB`, so a stopped Electric cannot fill the disk. Electric connects as a dedicated `electric` role (`LOGIN REPLICATION`, `SELECT` on synced tables only). The role is created by hand once, because a migration would have to contain its password.
- Morrow refuses to start without `ELECTRIC_URL` and `ELECTRIC_SECRET`. Insecure mode is not used anywhere, so local development, CI and production share one code path.
- Tables are published manually (`ELECTRIC_MANUAL_TABLE_PUBLISHING`). One migration creates the publication. Each migration that makes a table synced sets `REPLICA IDENTITY FULL`, adds it to the publication and grants `SELECT` to `electric`, so reading the migrations shows which tables are synced.

**Reads: shapes**

- The browser never talks to Electric. `GET /api/shapes/:name` checks the Better Auth session (401 without), looks the name up in a registry (404 if unknown) and forwards to Electric. It copies only Electric's protocol parameters from the request and sets `table`, `columns`, `where`, the positional params and `secret` itself.
- The browser may narrow a shape with subset queries (`subset__where`, `subset__params`) but never widen it: Electric combines a subset with the shape's own filter by AND. A collection over a large table may therefore use `syncMode: "on-demand"` and load only what its live queries ask for (see [0004](0004-tasks.md)). `preload()` is a no-op on such a collection; a route loader preloads a live query instead.
- A shape is declared once in its Vertical (`shapes.ts`): a name, a table, a Zod schema of the columns that may be sent, and a `where` builder that receives the session. The column allowlist is the schema's keys; there is no way to send all columns. The schemas live in `@morrow/sync-schemas` so the web bundle never imports API runtime code.
- Shapes are scoped to the user through membership subqueries, not to one Workspace. Switching Workspaces needs no new sync, a join or removal reaches the browser live, and pages filter by Workspace in live queries. A per-Workspace collection is for a future table where some roles cannot read.

**Writes**

- Morrow-owned writes run in `withTxid`, which reads `pg_current_xact_id()` inside the same transaction and returns it with the result. The Procedure returns `{ …, txid }` and the collection handler waits with `awaitTxId`.
- Writes that Better Auth performs (member role, remove, leave, workspace update) cannot give a txid. Their collection handlers call the Procedure and then `awaitMatch` on the changed row's id and new value.
- A table is either a synced shape or an oRPC query, never both, so two caches never disagree about the same rows. Auth, admin, onboarding and one-off reads stay on oRPC Query.

**Web**

- Synced collections live in a `collections/` role folder inside the Vertical, next to `queries/`, and are created once at module level. Shared options (proxy URL, `snakeCamelMapper`, timestamp parsing, error handling) are defined once. Each collection is registered in `registerSyncedCollection`, and `cleanupSyncedCollections()` runs next to `queryClient.clear()` at sign-out, on a 401 and at account deletion.
- The Workspace layout route preloads its collections in its loader, so pages read with `useLiveSuspenseQuery`; link hover starts the sync early. A failed first sync shows a retry screen, not a crash.
- No offline or SQLite persistence for synced collections.
- Device preferences (theme, compact mode, sidebar default) are a TanStack DB `localStorageCollection`, not a synced collection. They belong to the browser, survive sign-out and sync between tabs.

## Consequences

- Local development and CI need Docker Compose with logical replication; GitHub Actions service containers cannot override the Postgres command, so CI starts Postgres and Electric through `docker compose`.
- Electric holds a replication slot. If it is stopped for a long time, drop the slot (see the runbook).
- Subqueries in a shape's `where` depend on Electric's subquery support. If a future version rejects them, stop and raise it rather than working around it.
