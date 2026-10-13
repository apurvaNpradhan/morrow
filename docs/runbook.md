# Runbook

Morrow is one image on one Dokploy server. This page is the short list of things to do by hand. Configuration reference: [deployment.md](deployment.md).

## Deploy

Merging to `main` runs CI, then the **Build and push image** workflow publishes `ghcr.io/apurvanpradhan/morrow:latest` and `:sha-<short sha>`, then its `deploy` job calls Dokploy's deploy webhook.

One-time setup:

1. In Dokploy, create the application from the image, attach the domain on container port `1337`, and set the environment (see deployment.md).
2. In the application's **Deployments** tab copy the deploy webhook URL.
3. In GitHub, add it as the repository secret `DOKPLOY_DEPLOY_WEBHOOK`. Without it the deploy job skips.

Migrations run when the container starts; the app refuses to start if one fails, so Dokploy keeps the previous container serving.

## Roll back

Set the application's image tag to the previous `sha-…` tag (the Deployments tab lists them) and redeploy. A rollback does not undo migrations, so only roll back across a migration when the older code still works with the newer schema; otherwise restore a backup first.

## Postgres and backups

Postgres is a separate Dokploy database service. Configure in Dokploy:

1. **Destinations** → add the Cloudflare R2 bucket (`S3_ENDPOINT` of the form `https://<account>.r2.cloudflarestorage.com`, region `auto`) with a token scoped to that bucket.
2. The database service → **Backups** → schedule `0 3 * * *` (daily) to that destination, retention **14**.

Avatars live in the public R2 bucket (`S3_PUBLIC_BASE_URL`), not in Postgres, so these database backups do not cover them. A lost avatar is recoverable by uploading a new one; enable bucket versioning only if that is not enough.

## Restore drill

Run this after setting up backups, and again after any change to how backups are produced.

1. Download the newest backup from the R2 bucket.
2. `scripts/ops/restore-drill.sh <file>`: restores it into a throwaway `postgres:17-alpine` container and checks that the core tables are present. It handles gzipped SQL and `pg_dump` custom archives, and removes the container when it finishes.
3. Record the date and result in `.scratch/personal-instance-orpc-verticals/progress.md`.

To restore for real: stop the Morrow application, restore the backup into the database service from Dokploy's backup screen (or `pg_restore` / `psql` against its connection string), then start the application. Sessions in the backup become valid again, so a restore taken before a secret rotation brings the old sessions back.

## Background jobs

Jobs run in the API process on pg-boss, in the `pgboss` schema of the same
database; the database role must be able to create that schema on first start.
Finished jobs (completed or failed) are kept 7 days. To inspect trouble:

```sql
select name, state, count(*) from pgboss.job group by 1, 2 order by 1, 2;
select name, retry_count, output from pgboss.job where state = 'failed' order by created_on desc limit 20;
```

A job that ran out of retries logs `jobs.exhausted` with its queue and sends a
Sentry message. Fix the cause, then re-run it with
`select pgboss.retry(...)`-style tooling or by enqueueing the subject again.
Cron monitors in Sentry (`storage-cleanup`, `draft-upload-cleanup`) show a
schedule that stopped or ran degraded.

## Rotate secrets

Change values in the application's environment in Dokploy, then redeploy.

| Secret | Effect of changing it |
| --- | --- |
| `AUTH_SECRET` | Every session and signed cookie stops working; everyone signs in again. |
| `RESEND_API_KEY` | Takes effect on restart. Sign-in codes cannot be sent until it is valid. |
| `TURNSTILE_SECRET_KEY` / `VITE_TURNSTILE_SITE_KEY` | The site key is baked into the image at build time (GitHub variable `VITE_TURNSTILE_SITE_KEY`); rebuild to change it. |
| Google / GitHub OAuth secrets | Takes effect on restart. |
| `DATABASE_URL` | Change in step with the database service's password. |

## Close sign-ups

Set `REGISTRATION_OPEN=false` and redeploy. Invited addresses can still join.
