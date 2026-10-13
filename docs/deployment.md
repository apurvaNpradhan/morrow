# Deployment

## Dokploy

Deploy the published image as a Dokploy Application and attach a domain on container port `1337`. Dokploy's Traefik proxy terminates TLS. Create PostgreSQL as a separate Dokploy database service (daily backups to R2, 14 kept; see the [runbook](runbook.md)) and set `DATABASE_URL` to its internal connection string. Morrow applies database migrations at startup. There is no Redis.

Configuration is declared once in the root [`.env.schema`](../.env.schema), which lists every variable, its type, whether it is required and whether it is a secret. The container validates it at startup with varlock and refuses to start, naming the problem, if a required value is missing or malformed. Secrets are redacted from logs. Set production values in the Dokploy application's environment UI.

Required in production:

- `DATABASE_URL`: PostgreSQL connection URL reachable from the Morrow container.
- `AUTH_SECRET`: stable random secret of at least 32 characters; generate one with `openssl rand -hex 32` and keep it stable across restarts.
- `MORROW_CLIENT_URL`: public HTTPS origin, for example `https://morrow.example.com`.
- `RESEND_API_KEY` and `EMAIL_FROM`: sign-in codes and invitations are emailed, so production does not start without them.

Your own email in `ADMIN_EMAILS` makes you an administrator once you sign in with that verified address.

`MORROW_API_URL` defaults to `${MORROW_CLIENT_URL}/api`: the API and web app share one origin, so there is no CORS or cookie-domain configuration.

- `TRUSTED_PROXIES` (recommended): the CIDR of the Docker network Traefik reaches Morrow through (check it with `docker network inspect dokploy-network`, commonly a `10.0.x.0/24` or `172.x.0.0/16` range). Without it Morrow treats the proxy address as every visitor, which collapses sign-in rate limits to one shared identity. Use the specific proxy network, never `0.0.0.0/0`.

Optional configuration (see `.env.schema` for all of it):

- Cloudflare R2 or another S3-compatible store: `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_REGION` (use `auto` for R2). Avatars are public objects: attach a custom domain to the bucket and set `S3_PUBLIC_BASE_URL` to it. Keep cache headers immutable; each upload gets a new key.
- Turnstile: set `TURNSTILE_SECRET_KEY` (runtime) and `VITE_TURNSTILE_SITE_KEY` (build-time) together.
- Sentry: set `SENTRY_DSN` (API, runtime) and `VITE_SENTRY_DSN` (web, build-time) to enable error reporting. Sentry stays disabled when the DSN is empty.
- Sign-in providers and policy: GitHub and Google OAuth credentials, and `ADMIN_EMAILS` (comma-separated emails that become instance administrators once their address is verified) and `REGISTRATION_OPEN` (set `false` and restart to close sign-ups). `MAX_WORKSPACES_PER_USER` limits workspaces owned per user (default `3`; instance admins are exempt).

The image is published as `ghcr.io/apurvanpradhan/morrow:latest` and also tagged `sha-<7-character commit SHA>` (for example `sha-1a2b3c4`). Publication runs only after the CI workflow passes on that push; pin the SHA tag for reproducible deploys. Port `1337` serves the web app, the API (including the `/rpc` realtime event stream) and the MCP OAuth metadata through one origin; there is no separate web server.

## API surface

The web app calls oRPC procedures over `/rpc`; there is no REST or OpenAPI view. Better Auth serves `/api/auth/*` (sign-in, sessions, OTP, organization, and the OAuth provider endpoints MCP clients use); see the Better Auth documentation. MCP clients register at `/api/auth/oauth2/register`, discover the server through `/.well-known/oauth-protected-resource/api/mcp` and `/.well-known/oauth-authorization-server/api/auth`, and call `/api/mcp` with an OAuth access token.

## Local compose

`compose.local.yml` starts the app and a disposable Postgres service. It exposes the app at `http://localhost:1337` and Postgres on port `5432`:

```sh
docker compose -f compose.local.yml up --build
```

The local database uses the development-only password `morrow_local_dev` and stores its data in the `postgres_data` volume. Do not reuse that password outside local development. Production has no database in the image: point `DATABASE_URL` at the Dokploy database service. Set optional integrations in the shell or a local Compose environment file before starting the stack.

## CI scope

CI runs lint, the dead-code check (`pnpm knip`), typecheck, unit tests, and i18n consistency checks on pushes and pull requests. The `integration` job runs `pnpm test:integration` against a PostgreSQL service, and the `checks` job also runs the deployment-script tests (`pnpm test:security`). To run integration tests locally, use a disposable test database. CI does not build Docker images. The image workflow runs CI first; a successful push to `main` publishes the combined image to GHCR and then triggers Dokploy's deploy webhook (repository secret `DOKPLOY_DEPLOY_WEBHOOK`). Day-to-day operations are in the [runbook](runbook.md).
