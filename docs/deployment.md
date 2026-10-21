# Deployment

## Dokploy

Morrow runs on one Dokploy server as three services in one Dokploy project:

- **PostgreSQL**: a Dokploy database service (version 17), with daily backups to R2. Set it up first; see the [runbook](runbook.md#postgres-and-backups).
- **Morrow and Electric**: one Dokploy **Docker Compose** service built from [`compose.dokploy.yml`](../compose.dokploy.yml). It pulls the published image; nothing is built on the server.
- **Cloudflare R2**: avatars, attachments and database backups. It is not a container.

Nothing publishes a host port. Both containers `expose` their port on `dokploy-network`, where Traefik and the database service also run. Traefik terminates TLS and routes the domain to `morrow:1337`. Electric gets no domain, and Morrow reaches it at `http://morrow-electric:3000`. Morrow applies database migrations at startup, and Electric starts only once Morrow is healthy, because those migrations create the publication Electric reads. There is no Redis.

### Compose service setup

1. **Create** a Compose service (type *Docker Compose*, not *Stack*) in the database's project. Source: this GitHub repository, branch `main`, compose path `./compose.dokploy.yml`. Turn **Autodeploy off**. A push would otherwise redeploy before CI has published the new image; the image workflow calls the deploy webhook once it has.
2. **Turn Isolated Deployments off** (Advanced). An isolated network cannot reach the database service, and the compose file already joins `dokploy-network`.
3. **Registry.** If the GHCR package is private, add `ghcr.io` under Settings → Registry, using a token with `read:packages`. If it is public, skip this.
4. **Environment.** Paste [`docker/dokploy.env.example`](../docker/dokploy.env.example) into the Environment tab and fill it in. Dokploy writes it to `.env` next to the compose file. Morrow loads all of it, and Electric takes `ELECTRIC_DATABASE_URL` and `ELECTRIC_SECRET`. `ELECTRIC_URL` and `NODE_ENV` are set in the compose file.
5. **Domain.** In the Domains tab, add the domain for service `morrow` on port `1337` with HTTPS (Let's Encrypt). If the DNS record is proxied through Cloudflare, set SSL/TLS to *Full (strict)*.
6. **Webhook.** Copy the deploy webhook from the Deployments tab into the GitHub secret `DOKPLOY_DEPLOY_WEBHOOK`.
7. **Deploy.** Do the [Electric one-time setup](runbook.md#electric-sync) first: Postgres arguments and the `electric` role. Then deploy. Use *Preview Compose* to see the labels Dokploy adds.

The morrow service has `pull_policy: always`, so each deploy pulls `MORROW_IMAGE_TAG` (default `latest`). To roll back, set the tag to an earlier `sha-…` tag and redeploy. A deploy recreates the Morrow container, so expect a few seconds of downtime while it migrates and starts. Electric is only recreated when its own configuration changes. Container logs rotate at 5 × 10 MB per service.

### Configuration

Configuration is declared once in the root [`.env.schema`](../.env.schema), which lists every variable, its type, whether it is required and whether it is a secret. The container validates it at startup with varlock and refuses to start, naming the problem, if a required value is missing or malformed. Secrets are redacted from logs.

Required in production:

- `DATABASE_URL`: the database service's internal connection string, with `?sslmode=disable` on the internal network.
- `AUTH_SECRET`: stable random secret of at least 32 characters; generate one with `openssl rand -hex 32` and keep it stable across restarts.
- `MORROW_CLIENT_URL`: public HTTPS origin, for example `https://morrow.example.com`.
- `RESEND_API_KEY` and `EMAIL_FROM`: sign-in codes and invitations are emailed, so production does not start without them.
- `ELECTRIC_SECRET`: shared by Morrow and Electric; Morrow sends it on every request to Electric. Generate one with `openssl rand -hex 32`.
- `ELECTRIC_DATABASE_URL`: the same database as the `electric` role, for Electric only.
- Storage (Cloudflare R2, below): `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` and `S3_PUBLIC_BASE_URL`, with `S3_REGION=auto`.

Your own email in `ADMIN_EMAILS` makes you an administrator once you sign in with that verified address.

`MORROW_API_URL` defaults to `${MORROW_CLIENT_URL}/api`: the API and web app share one origin, so there is no CORS or cookie-domain configuration.

- `TRUSTED_PROXIES` (recommended): the subnet of `dokploy-network`, which Traefik reaches Morrow through. Read it with `docker network inspect dokploy-network --format '{{(index .IPAM.Config 0).Subnet}}'`; it is commonly `10.0.1.0/24`. Without it Morrow treats the proxy address as every visitor, which collapses sign-in rate limits to one shared identity. Never use `0.0.0.0/0`.

### Electric (sync)

Morrow streams live data through [Electric](https://electric-sql.com), which reads the Postgres write-ahead log. It is required: Morrow does not start without `ELECTRIC_URL` and `ELECTRIC_SECRET`. The compose file pins the image by digest, the same one `compose.local.yml` uses, and keeps Electric's shape cache in the `electric_data` volume (`ELECTRIC_STORAGE_DIR=/var/lib/electric`), so a restart does not make every browser sync from scratch. Do not set `ELECTRIC_INSECURE`. The cache is rebuilt from Postgres, so it needs no backup.

The database service needs `wal_level=logical` and `max_slot_wal_keep_size=10GB`, and the `electric` role must exist before the first deploy. The steps are in the [runbook](runbook.md#electric-sync).

### Cloudflare R2

Use two buckets, each with its own API token scoped to that bucket (Object Read & Write):

- `morrow`, for app files. It gets a custom domain (`S3_PUBLIC_BASE_URL`) so avatars load from it, and a WAF rule on that domain that blocks `/assets/*` (details below). CORS policy:

  ```json
  [
    {
      "AllowedOrigins": ["https://morrow.example.com"],
      "AllowedMethods": ["PUT"],
      "AllowedHeaders": ["content-type", "content-length"],
      "MaxAgeSeconds": 3600
    }
  ]
  ```

- `morrow-backups`, for Dokploy's database backups. Give it no custom domain and no public access. Database dumps contain sessions and email addresses, so they must never sit behind the public domain of the app bucket.

The S3 endpoint for both is `https://<account-id>.r2.cloudflarestorage.com` with region `auto`. Add a lifecycle rule on `morrow` that aborts incomplete multipart uploads after one day.

Optional configuration (see `.env.schema` for all of it):

- Avatars are public objects served from the bucket's custom domain, `S3_PUBLIC_BASE_URL`. Keep cache headers immutable; each upload gets a new key.
- Attachments (images and files on tasks and comments) use the same bucket under `assets/`. The browser uploads straight to the bucket with a presigned URL, so the bucket needs a **CORS rule**: allowed origin `MORROW_CLIENT_URL`, method `PUT`, allowed headers `content-type` and `content-length`, max age `3600`. Files are private: Morrow serves them only through `/api/asset/<id>`, which checks the Workspace and redirects to a 60-second link. Their keys are unguessable, but the public domain would still serve one to anyone who knew it, so add a Cloudflare rule on that domain that blocks the path `/assets/*` (include `S3_KEY_PREFIX` first when you set one). Files up to 100 MB are accepted; there is no quota. A lifecycle rule that aborts incomplete multipart uploads after a day is worth adding.
- Turnstile: set `TURNSTILE_SECRET_KEY` (runtime) and `VITE_TURNSTILE_SITE_KEY` (build-time) together.
- Sentry: set `SENTRY_DSN` (API, runtime) and `VITE_SENTRY_DSN` (web, build-time) to enable error reporting. Sentry stays disabled when the DSN is empty.
- Sign-in providers and policy: GitHub and Google OAuth credentials, and `ADMIN_EMAILS` (comma-separated emails that become instance administrators once their address is verified) and `REGISTRATION_OPEN` (set `false` and restart to close sign-ups). `MAX_WORKSPACES_PER_USER` limits workspaces owned per user (default `3`; instance admins are exempt).

The image is published as `ghcr.io/apurvanpradhan/morrow:latest` and also tagged `sha-<7-character commit SHA>` (for example `sha-1a2b3c4`). Publication runs only after the CI workflow passes on that push; pin the SHA tag for reproducible deploys. Port `1337` serves the web app, the API (including the `/rpc` realtime event stream) and the MCP OAuth metadata through one origin; there is no separate web server.

## API surface

The web app calls oRPC procedures over `/rpc`; there is no REST or OpenAPI view. Better Auth serves `/api/auth/*` (sign-in, sessions, OTP, organization, and the OAuth provider endpoints MCP clients use); see the Better Auth documentation. MCP clients register at `/api/auth/oauth2/register`, discover the server through `/.well-known/oauth-protected-resource/api/mcp` and `/.well-known/oauth-authorization-server/api/auth`, and call `/api/mcp` with an OAuth access token.

## Local compose

`compose.local.yml` starts the app, a disposable Postgres service (with logical replication on) and Electric. It is for local use only; production uses `compose.dokploy.yml`. It exposes the app at `http://localhost:1337`, Postgres on port `5432` and Electric on `3010`:

```sh
docker compose -f compose.local.yml up --build
```

The local database uses the development-only password `morrow_local_dev` and stores its data in the `postgres_data` volume. Do not reuse that password outside local development. Production has no database in the image: point `DATABASE_URL` at the Dokploy database service. Set optional integrations in the shell or a local Compose environment file before starting the stack.

## CI scope

CI runs lint, the dead-code check (`pnpm knip`), typecheck, unit tests, and i18n consistency checks on pushes and pull requests. The `integration` job starts Postgres (with logical replication) and Electric through `docker compose`, because GitHub service containers cannot change the Postgres command, then runs `pnpm test:integration`, and the `checks` job also runs the deployment-script tests (`pnpm test:security`). The `e2e` job builds the image from the checkout and runs the Playwright tests against it, Postgres and Electric (see `tests/e2e/README.md`). To run integration tests locally, use a disposable test database. The image workflow runs CI first; a successful push to `main` publishes the combined image to GHCR and then triggers Dokploy's deploy webhook (repository secret `DOKPLOY_DEPLOY_WEBHOOK`). Day-to-day operations are in the [runbook](runbook.md).
