<!-- intent-skills:start -->

## Skill Loading

Use the repository’s installed Intent. If it is unavailable, report the missing dependency instead of downloading a replacement.
Before editing code for a substantial task (not for ticket or doc work):

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
- No options for hypothetical operators. Product decisions are fixed in code; do not add flags, alternate providers or deployment modes. One image running two processes (`api` and `worker`), with Postgres, Electric and Durable Streams; no Redis; one origin

## Sync

Rules for shapes, collections and sync migrations are in `docs/sync.md`. Read it, and load the skills it names, before touching `shapes.ts`, `collections/` or a table that syncs.

## Agent skills

### Issue tracker

Specs live as local markdown under `.scratch/`. See `docs/agents/issue-tracker.md`.

Tickets (`MOR-n`) live in the Morrow app, workspace `atlas`, project `MOR`. Use the `morrow` MCP, not `.scratch/`. Read the ticket's description and notes (they list required tests) before changing code; finish them before moving it to Done.

- MCP: a codemode server (`tools.mcp__morrow__*`; list them with `ALL_TOOLS`). `workspaceId` accepts the slug `atlas`. `create_tasks` and `update_tasks` need the project id `gmbxi3c69i1lqbbnf6im940c`.
- Call `list_tasks` without descriptions, then `get_task` for the few you need. Descriptions for the whole project run to about 80 KB.
- Every `feat`, `fix` and `perf` commit ends with a `Refs: MOR-n` trailer (`Refs: none` if there is no ticket). The commit hook enforces it. Moving a ticket's status is part of landing it.
- When a ticket reaches Done, set its spec's `Status:` to `shipped` and delete "State" or "probably built" notes from the ticket.

### Triage labels

Default five-role vocabulary, recorded as a `Status:` line. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
