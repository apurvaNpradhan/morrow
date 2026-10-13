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

## Agent skills

### Issue tracker

Issues and specs live as local markdown under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary, recorded as a `Status:` line. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
