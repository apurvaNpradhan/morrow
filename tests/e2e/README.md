# Browser smoke test

One Playwright flow proves the web shell works against a disposable, bundled
Morrow instance built from the current checkout: sign up, verify the email, create
a workspace, invite a member, and see the invitation on the workspace Home
activity feed. PostgreSQL uses temporary storage; no existing database or root
`.env` is used. This is a local check; CI does not run it.

Email verification works because no Resend key is set: the API writes each email
to its console, and the test reads the verification link from the stack's
`docker compose logs`.

## Local run

Requires Node 24, pnpm 10.32.1, and Docker Compose v2.

```sh
pnpm --dir tests/e2e install --frozen-lockfile --ignore-scripts
pnpm --dir tests/e2e exec playwright install chromium
docker compose -f tests/e2e/compose.yml up --build --wait --wait-timeout 300
pnpm test:e2e            # run from the repository root
docker compose -f tests/e2e/compose.yml down --volumes
```

The instance binds to `http://localhost:18173` (Compose project `morrow-e2e`).
Tests create unique synthetic users and workspaces. Stop the stack afterwards,
including after failed runs. Reports, screenshots, and traces are written to
`.cache/e2e/`.
