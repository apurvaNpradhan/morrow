FROM --platform=$BUILDPLATFORM node:24.19.0-alpine AS api-builder

RUN apk add --no-cache python3 make g++ && \
  corepack enable && \
  corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml vite.config.ts .env.schema ./
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/email/package.json ./packages/email/
COPY packages/permissions/package.json ./packages/permissions/
COPY packages/i18n/package.json ./packages/i18n/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile

COPY packages/typescript-config ./packages/typescript-config
COPY packages/email ./packages/email
COPY packages/permissions ./packages/permissions
COPY packages/i18n ./packages/i18n
COPY apps/api ./apps/api

WORKDIR /app/packages/email
RUN pnpm run build

WORKDIR /app/packages/permissions
RUN pnpm run build

RUN pnpm run build

WORKDIR /app/apps/api
RUN pnpm run build

# Assemble production dependencies on the build platform. API runtime
# dependencies are pure JavaScript, so the resulting node_modules is portable.
FROM --platform=$BUILDPLATFORM node:24.19.0-alpine AS api-runtime

WORKDIR /app

COPY --from=api-builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/.env.schema ./
COPY --from=api-builder /app/apps/api/package.json ./apps/api/
COPY --from=api-builder /app/packages/typescript-config/package.json ./packages/typescript-config/
COPY --from=api-builder /app/packages/email/package.json ./packages/email/
COPY --from=api-builder /app/packages/permissions/package.json ./packages/permissions/
COPY --from=api-builder /app/packages/i18n/package.json ./packages/i18n/

RUN sed -i 's/"prepare": "husky"/"prepare": ""/g' package.json && \
  corepack enable && \
  corepack prepare pnpm@10.32.1 --activate && \
  HUSKY=0 NODE_ENV=production pnpm install --prod --frozen-lockfile --no-optional

COPY --from=api-builder /app/apps/api/dist ./apps/api/dist
COPY --from=api-builder /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=api-builder /app/packages/email ./packages/email
COPY --from=api-builder /app/packages/permissions ./packages/permissions
COPY --from=api-builder /app/packages/i18n ./packages/i18n

FROM --platform=$BUILDPLATFORM node:24.19.0-alpine AS web-builder

RUN apk add --no-cache python3 make g++ && \
  corepack enable && \
  corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json vite.config.ts .env.schema ./
COPY apps/web/package.json ./apps/web/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/typescript-config ./packages/typescript-config
COPY packages/permissions ./packages/permissions
COPY packages/i18n ./packages/i18n
COPY apps/web ./apps/web

RUN pnpm install --frozen-lockfile

WORKDIR /app/packages/permissions
RUN pnpm run build

# Public, build-time settings (see .env.schema). The web app is static, so these
# are baked into the bundle; pass them as build arguments.
ARG VITE_API_URL=
ARG VITE_TURNSTILE_SITE_KEY=
ARG VITE_SENTRY_DSN=
ENV VITE_API_URL=$VITE_API_URL \
  VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY \
  VITE_SENTRY_DSN=$VITE_SENTRY_DSN

WORKDIR /app/apps/web
RUN pnpm run build && find dist -type f -name '*.map' -delete

FROM node:24.19.0-alpine AS runtime

RUN addgroup -g 1001 appuser && \
  adduser -u 1001 -G appuser -D appuser

WORKDIR /app

COPY --from=api-runtime --chown=appuser:appuser /app /app
COPY --from=web-builder --chown=appuser:appuser /app/apps/web/dist /app/apps/web/dist

RUN cd /app/apps/api && node -e "const fs=require('fs');for(const m of ['hono','pg','drizzle-orm','better-auth','varlock','@modelcontextprotocol/server','@orpc/server'])fs.accessSync('node_modules/'+m+'/package.json');for(const m of ['email','permissions'])fs.accessSync('node_modules/@morrow/'+m+'/dist/index.js');fs.accessSync('node_modules/@morrow/i18n/en-US.json')"

ENV NODE_ENV=production

USER appuser
WORKDIR /app/apps/api
EXPOSE 1337

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -Y off --no-verbose --tries=1 --spider http://127.0.0.1:1337/api/health || exit 1

# varlock validates the environment against /app/.env.schema, redacts secrets
# from logs, and refuses to start on a missing or malformed value. The API
# serves the built web app from /app/apps/web/dist on the same port.
CMD ["./node_modules/.bin/varlock", "run", "--", "node", "--enable-source-maps", "dist/index.js"]
