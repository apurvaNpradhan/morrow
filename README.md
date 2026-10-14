# Morrow


A personal workspace platform, run as a single instance. Morrow is the core that future domains build on: accounts, workspaces, members, roles, activity, and an MCP endpoint for AI assistants.

- **Accounts:** sign up with an emailed code, Google or GitHub. Turnstile CAPTCHA, rate limiting, disposable-email rejection and a workspace limit protect the open sign-up; `REGISTRATION_OPEN=false` closes it. Administrators are the emails listed in `ADMIN_EMAILS`.
- **Workspaces:** invitations, members and editable roles.
- **Activity:** workspace and member changes are recorded and listed per workspace.
- **API and MCP:** oRPC procedures under `/rpc`, and an HTTP MCP endpoint authorized with OAuth.
- **One origin:** a single image serves the API and web app, backed by PostgreSQL (Dokploy database), R2 for files, no Redis.

## Develop

Needs Node.js 24.11+ (or 26+), pnpm 10.32.1 and Docker. `pnpm dev:services` starts a disposable PostgreSQL and a MinIO bucket for avatars (`compose.local.yml`) and applies migrations; `pnpm dev` runs it first.

1. Copy `.env.sample` to `.env` in the repository root and set `AUTH_SECRET` (`openssl rand -hex 32`, keep it stable) and your email in `ADMIN_EMAILS`. Every variable is declared in [`.env.schema`](.env.schema); `pnpm exec varlock load` validates your setup with secrets masked. A stale key in `.env` that the schema no longer declares (for example `DISCORD_CLIENT_ID`) fails validation: delete it.
2. `pnpm install && pnpm dev`, then open https://localhost:5443. Caddy serves the dev server over HTTP/2 (the sync long-polls need it) with a local certificate: accept the warning once, or trust `docker compose -p morrow -f compose.local.yml cp caddy:/data/caddy/pki/authorities/local/root.crt .`. The dev server proxies `/api` to the API on port 1337.

With no `RESEND_API_KEY` outside production, emails are printed to the API log: copy the sign-in code from there. Set `VITE_API_URL` in `.env` only to point the web app at an API hosted elsewhere. Run checks with `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:integration` (needs a disposable database whose name ends in `_test`).

## Deploy

Follow [docs/deployment.md](docs/deployment.md) (Dokploy).

## Layout

| Path | Contents |
| --- | --- |
| `apps/api` | Hono API, database, jobs |
| `apps/web` | React app |
| `packages/libs` | Typed API client and URL helpers |
| `packages/permissions` | Permission vocabulary and built-in roles |
| `packages/mcp` | Internal MCP tool registry |
| `packages/email` | Email templates |

Decisions are recorded in [docs/adr](docs/adr); domain terms in [CONTEXT.md](CONTEXT.md).

## License

Proprietary, all rights reserved, see [LICENSE](LICENSE). Morrow is derived from [Kaneo](https://github.com/usekaneo/kaneo) (MIT, copyright Andrej Acevski); that notice is retained in the license file.
