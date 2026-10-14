# Deployment

## Dokploy

Deploy the published image as a Dokploy Application and attach a domain on container port `1337`. Dokploy's Traefik proxy terminates TLS. Create PostgreSQL as a separate Dokploy database service (daily backups to R2, 14 kept; see the [runbook](runbook.md)) and set `DATABASE_URL` to its internal connection string. Morrow applies database migrations at startup. There is no Redis.

Configuration is declared once in the root [`.env.schema`](../.env.schema), which lists every variable, its type, whether it is required and whether it is a secret. The container validates it at startup with varlock and refuses to start, naming the problem, if a required value is missing or malformed. Secrets are redacted from logs. Set production values in the Dokploy application's environment UI.

Required in production:

- `DATABASE_URL`: PostgreSQL connection URL reachable from the Morrow container.
- `AUTH_SECRET`: stable random secret of at least 32 characters; generate one with `openssl rand -hex 32` and keep it stable across restarts.
- `MORROW_CLIENT_URL`: public HTTPS origin, for example `https://morrow.example.com`.
- `RESEND_API_KEY` and `EMAIL_FROM`: sign-in codes and invitations are emailed, so production does not start without them.

- `ELECTRIC_URL`: internal URL of the Electric application, for example `http://morrow-electric:3000`. Never a public address.
- `ELECTRIC_SECRET`: the secret Electric was started with; Morrow sends it on every request to Electric. Generate one with `openssl rand -hex 32`.

Your own email in `ADMIN_EMAILS` makes you an administrator once you sign in with that verified address.

`MORROW_API_URL` defaults to `${MORROW_CLIENT_URL}/api`: the API and web app share one origin, so there is no CORS or cookie-domain configuration.

- `TRUSTED_PROXIES` (recommended): the CIDR of the Docker network Traefik reaches Morrow through (check it with `docker network inspect dokploy-network`, commonly a `10.0.x.0/24` or `172.x.0.0/16` range). Without it Morrow treats the proxy address as every visitor, which collapses sign-in rate limits to one shared identity. Use the specific proxy network, never `0.0.0.0/0`.

### Electric (sync)

Morrow streams live data (currently the members of your workspaces) through [Electric](https://electric-sql.com), a second container that reads Postgres. It is required: Morrow does not start without `ELECTRIC_URL` and `ELECTRIC_SECRET`.

Create a second Dokploy Application in the **same project** as Morrow and the database service:

- Image `electricsql/electric@sha256:efb6fa43859d67cb8c73439e0c8bc0f7a3daa467500fb06f2a924bcb2070c139` (the digest `compose.local.yml` pins).
- **No domain.** Electric must only be reachable on the internal network; Morrow reaches it by its service name.
- Environment: `DATABASE_URL` (direct connection to the database service as the `electric` role, with `?sslmode=disable` on the internal network), `ELECTRIC_SECRET`, and `ELECTRIC_MANUAL_TABLE_PUBLISHING=true`. Do not set `ELECTRIC_INSECURE`.
- A persistent volume mounted at `/var/lib/electric`, so a restart does not make every browser sync from scratch.

The database service needs `wal_level=logical` and `max_slot_wal_keep_size=10GB`, and the `electric` role must exist before the first deploy. The steps are in the [runbook](runbook.md#electric-sync).

Optional configuration (see `.env.schema` for all of it):

- Cloudflare R2 or another S3-compatible store: `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_REGION` (use `auto` for R2). Avatars are public objects: attach a custom domain to the bucket and set `S3_PUBLIC_BASE_URL` to it. Keep cache headers immutable; each upload gets a new key.
- Turnstile: set `TURNSTILE_SECRET_KEY` (runtime) and `VITE_TURNSTILE_SITE_KEY` (build-time) together.
- Sentry: set `SENTRY_DSN` (API, runtime) and `VITE_SENTRY_DSN` (web, build-time) to enable error reporting. Sentry stays disabled when the DSN is empty.
- Sign-in providers and policy: GitHub and Google OAuth credentials, and `ADMIN_EMAILS` (comma-separated emails that become instance administrators once their address is verified) and `REGISTRATION_OPEN` (set `false` and restart to close sign-ups). `MAX_WORKSPACES_PER_USER` limits workspaces owned per user (default `3`; instance admins are exempt).

The image is published as `ghcr.io/apurvanpradhan/morrow:latest` and also tagged `sha-<7-character commit SHA>` (for example `sha-1a2b3c4`). Publication runs only after the CI workflow passes on that push; pin the SHA tag for reproducible deploys. Port `1337` serves the web app, the API (including the `/rpc` realtime event stream) and the MCP OAuth metadata through one origin; there is no separate web server.

## API surface

The web app calls oRPC procedures over `/rpc`; there is no REST or OpenAPI view. Better Auth serves `/api/auth/*` (sign-in, sessions, OTP, organization, and the OAuth provider endpoints MCP clients use); see the Better Auth documentation. MCP clients register at `/api/auth/oauth2/register`, discover the server through `/.well-known/oauth-protected-resource/api/mcp` and `/.well-known/oauth-authorization-server/api/auth`, and call `/api/mcp` with an OAuth access token.

## Local compose

`compose.local.yml` starts the app, a disposable Postgres service (with logical replication on) and Electric. It exposes the app at `http://localhost:1337`, Postgres on port `5432` and Electric on `3010`:

```sh
docker compose -f compose.local.yml up --build
```

The local database uses the development-only password `morrow_local_dev` and stores its data in the `postgres_data` volume. Do not reuse that password outside local development. Production has no database in the image: point `DATABASE_URL` at the Dokploy database service. Set optional integrations in the shell or a local Compose environment file before starting the stack.

## CI scope

CI runs lint, the dead-code check (`pnpm knip`), typecheck, unit tests, and i18n consistency checks on pushes and pull requests. The `integration` job starts Postgres (with logical replication) and Electric through `docker compose`, because GitHub service containers cannot change the Postgres command, then runs `pnpm test:integration`, and the `checks` job also runs the deployment-script tests (`pnpm test:security`). The `e2e` job builds the image from the checkout and runs the Playwright tests against it, Postgres and Electric (see `tests/e2e/README.md`). To run integration tests locally, use a disposable test database. The image workflow runs CI first; a successful push to `main` publishes the combined image to GHCR and then triggers Dokploy's deploy webhook (repository secret `DOKPLOY_DEPLOY_WEBHOOK`). Day-to-day operations are in the [runbook](runbook.md).
