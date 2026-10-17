# Reserve top-level paths beside `/$slug`

Status: ready-for-agent

## Problem Statement

Workspaces live at `/$slug`, so any future top-level page (an inbox, My tasks, search) collides with a workspace that has that slug. `RESERVED_WORKSPACE_SLUGS` in `packages/permissions/src/workspace-slug.ts` lists only today's 13 words, and nothing checks that it covers every top-level route.

## Solution

Keep `/$slug` (no `/w/` prefix). Reserve the likely future words now, and add a test that fails when a top-level route segment is missing from the list.

## User Stories

1. As the owner, I want future top-level pages to never collide with a workspace, so that adding a page is safe.
2. As a developer, I want a failing test when I add a top-level route without reserving it.
3. As a Member, I want "This workspace URL is reserved" when I pick a reserved slug.

## Implementation Decisions

- **Add to the list:** `inbox`, `my`, `search`, `home`, `help`, `docs`, `app`, `w`, `u`, `p`, `t`, `account`, `notifications`, `views`, `teams`, `explore`, `share`, `embed`, `oauth`, `.well-known`.
  - `.well-known` already fails the format rules, but stays listed for clarity.
- The check applies to creating and renaming only. Existing workspaces are not migrated; a dev check confirms none of the owner's slugs collide.
- **Test** (web, beside the route tree): collect the first path segment of every route in the generated route tree that is not under `$slug` or a pathless layout, and assert each is in `RESERVED_WORKSPACE_SLUGS`. Also include the API mount paths (`api`, `rpc`, `mcp`) and the static folders.

## Testing Decisions

- The route-coverage test above.
- A unit test that a few new words report `reserved`.

## Out of Scope

- A `/w/` or other prefix (decided against: longer URLs and broken links, for a risk the list and test already cover).

## Further Notes

- Grilled 2026-10-17 (Q18).
