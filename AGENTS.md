<!-- intent-skills:start -->

## Skill Loading

Use the repository’s installed Intent. If it is unavailable, report the missing dependency instead of downloading a replacement.
Before editing files for a substantial task:

- Run `pnpm exec intent list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm exec intent load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.

<!-- intent-skills:end -->

# Morrow

## What matters

- Keep routine work simple. Solve the problem with the smallest model that makes the behavior clear. Read the relevant code first, but do not keep complexity just because it is already there.
- Keep modules small. Give each file one responsibility: one component per file, pure helpers and types next to the code that uses them, tests beside them. Do not extract one-line wrappers.
- Keep views fast. Data-heavy views should not move or render more data than they need.
- No options for hypothetical operators. Product decisions are fixed in code; do not add flags, alternate providers or deployment modes. Single process, no Redis, one origin

## Sync

Decisions and reasons: `docs/adr/0001-electric-tanstack-db-sync.md`.

- A table is either a synced **Shape** or an oRPC query, never both. Auth, admin, onboarding and one-off reads stay on oRPC Query.
- Declare a shape once in its Vertical's `shapes.ts` (`defineShape`) and export it from the Vertical's `index.ts`; add it to the registry in `platform/sync/shapes.ts`. The column schema goes in `@morrow/sync-schemas`. The browser never chooses table, columns or filter, and a shape has no "all columns".
- Shapes are scoped to the user through membership subqueries. Use a per-Workspace collection only for a table where some roles cannot read.
- Making a table synced is one Drizzle migration: `REPLICA IDENTITY FULL`, `ALTER PUBLICATION electric_publication_default ADD TABLE`, `GRANT SELECT … TO electric` (see `0011_sync_workspace_members.sql`).
- Morrow-owned writes behind a synced collection run in `withTxid`; the Procedure returns `{ …, txid }` and the collection handler waits with `awaitTxId`. Writes Better Auth performs cannot give a txid: the handler calls the Procedure, then `awaitMatch` on the changed row's id and new value.
- Collections live in `collections/` inside the Vertical, next to `queries/`. Build them with `shapeOptions(name)` and wrap them in `registerSyncedCollection` so `cleanupSyncedCollections()` clears them at sign-out. Load them in the route loader (`preload()`) and read with `useLiveSuspenseQuery`.
- No offline or SQLite persistence for synced collections. Device preferences are a `localStorageCollection` and are not registered for cleanup.
- Load `@electric-sql/client#electric-proxy-auth`, `electric-postgres-security`, `@tanstack/db#db-core/collection-setup` and `@tanstack/react-db#react-db` (`pnpm exec intent load …`) before touching this layer.

## Agent skills

### Issue tracker

Issues and specs live as local markdown under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary, recorded as a `Status:` line. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
