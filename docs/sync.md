# Sync

Decisions and reasons: `docs/adr/0001-electric-tanstack-db-sync.md` and `docs/adr/0002-sync-invitations-and-workspaces.md`.

- A table is either a synced **Shape** or an oRPC query, never both. Auth, admin and one-off reads stay on oRPC Query. Members, users, workspaces and invitations are shapes; roles, capabilities and activity stay on oRPC.
- Membership implies read: every role carries `workspace: read`, so a shape scoped by membership needs no permission logic. Instance admins reach foreign Workspaces through the administration pages only, never `/$slug`.
- Declare a shape once in its Vertical's `shapes.ts` (`defineShape`) and export it from the Vertical's `index.ts`; add it to the registry in `platform/sync/shapes.ts`. The shape's name and column schema are one object in `@morrow/sync-schemas`, imported by both the API and the collection. The browser never chooses table, columns or filter, and a shape has no "all columns".
- Shapes are scoped to the user through membership subqueries. Use a per-Workspace collection only for a table where some roles cannot read.
- A shape may be read in `syncMode: "on-demand"` (tasks): the browser narrows it with a live query's `where`, never widens it. `preload()` is a no-op there; preload a live query in the loader.
- Making a table synced is one Drizzle migration: `REPLICA IDENTITY FULL`, `ALTER PUBLICATION electric_publication_default ADD TABLE`, `GRANT SELECT … TO electric` (see `0011_sync_workspace_members.sql`).
- Morrow-owned writes behind a synced collection run in `withTxid`; the Procedure returns `{ …, txid }` and the collection handler waits with `awaitTxId`. Writes Better Auth performs cannot give a txid: the handler calls the Procedure, then `awaitMatch` on the changed row's id and new value.
- Collections live in `collections/` inside the Vertical, next to `queries/`. Build them with `shapeOptions(name)` and wrap them in `registerSyncedCollection` so `cleanupSyncedCollections()` clears them at sign-out. Load them in the route loader (`preload()`) and read with `useLiveSuspenseQuery`.
- No offline or SQLite persistence for synced collections. Device preferences are a `localStorageCollection` and are not registered for cleanup.
- Load `@electric-sql/client#electric-proxy-auth`, `electric-postgres-security`, `@tanstack/db#db-core/collection-setup` and `@tanstack/react-db#react-db` (`pnpm exec intent load …`) before touching this layer.
