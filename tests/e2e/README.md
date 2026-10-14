# Browser smoke test

One Playwright flow proves the web shell works against a disposable, bundled
Morrow instance built from the current checkout: sign up, verify the email, create
a workspace, invite a member, and see the invitation on the workspace Home
activity feed. A second spec (`sync.spec.ts`) checks the live data layer end to end against real Electric: a role change reaches another member's open page, a theme change reaches another tab, and signing out clears the previous user's members. `sync-workspaces.spec.ts` covers invitations reaching the invitee live and becoming a member on accept, a workspace rename reaching another member, a former URL redirecting, and a removed member being taken off the workspace. `projects.spec.ts` covers projects and columns: a new project, a reorder, a workflow edit and an archive reaching another member live, and a key change leaving the old URL empty. PostgreSQL uses temporary storage; no existing database or root
`.env` is used. CI runs it too (the `e2e` job), against the same stack.

Email verification works because no Resend key is set: the API writes each email
to its console, and the test reads the verification link from the stack's
`docker compose logs`.

## Local run

Requires Node 24, pnpm 10.32.1, and Docker Compose v2. The stack runs Postgres with logical replication and Electric next to Morrow.

```sh
pnpm --dir tests/e2e install --frozen-lockfile --ignore-scripts
pnpm --dir tests/e2e run browsers
docker compose -f tests/e2e/compose.yml up --build --wait --wait-timeout 300
pnpm test:e2e            # run from the repository root
docker compose -f tests/e2e/compose.yml down --volumes
```

The instance binds to `http://localhost:18173` (Compose project `morrow-e2e`).
Tests create unique synthetic users and workspaces. Stop the stack afterwards,
including after failed runs. Reports, screenshots, and traces are written to
`.cache/e2e/`.
