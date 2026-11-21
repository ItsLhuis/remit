# ─── Stage 1: base ───────────────────────────────────────────────────────────
FROM node:26.13.1-alpine3.24 AS base
RUN apk add --no-cache libc6-compat
# Node.js no longer bundles Corepack, so pnpm is installed at the exact `packageManager` version. Its
# install script swaps the Node.js launcher for the native binary, so it is the one script allowed.
RUN npm install --global --no-fund --no-audit --no-update-notifier --allow-scripts=pnpm pnpm@12.21.0
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ─── Stage 2: deps ───────────────────────────────────────────────────────────
# Every workspace package's manifest goes in before the install, or pnpm installs nothing for it and
# the frozen lockfile no longer matches the workspace.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
RUN pnpm i --frozen-lockfile

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
RUN pnpm i --prod --frozen-lockfile --ignore-scripts

# ─── Stage 3: builder ────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .

ENV NODE_ENV=production

# The image is built once and deployed anywhere, so nothing about a deployment enters the build: no
# build ARG, no address, no secret, and no NEXT_PUBLIC_* variable, which Next.js would freeze into
# the bundle. Next.js still evaluates server modules during `next build`, so validation
# is skipped only for the build command below. The runner stage validates real values from the
# runtime environment block in docker-compose.yml.

RUN REMIT_BUILD_ENV_VALIDATION=skip pnpm build

# The standalone output keeps the server chunks but not their source maps, which is what lets a
# reported error's frames name source files instead of minified chunks
# (apps/web/lib/errorTracking/sourceMaps.ts). The maps go in without their source text, and nothing
# uploads them anywhere.
RUN pnpm build:source-maps

# ─── Stage 4: runner ─────────────────────────────────────────────────────────
FROM node:26.13.1-alpine3.24 AS runner
RUN apk add --no-cache libc6-compat
RUN apk add --no-cache postgresql18-client
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm install --global --no-fund --no-audit --no-update-notifier --allow-scripts=pnpm pnpm@12.21.0
# pnpm only runs the bundled `remit:*` scripts here. The pinned version is the installed one, and
# the dependencies were installed at build time. Otherwise pnpm checks both before each run and
# writes the result into /app, which the runtime user cannot do.
ENV pnpm_config_pm_on_fail=ignore
ENV pnpm_config_verify_deps_before_run=false

# Create a non-root system user and group in a single layer.
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

# The standalone output mirrors the workspace: its dependencies at the root, the server under
# `apps/web/`. The application runs from `apps/web`, so `node server.js`, `scripts/dist/<cmd>.js` and
# `pnpm remit:<cmd>` resolve there, as docker-entrypoint.sh and the operator runbooks expect.
#
# All COPY instructions include --chown so files are owned by the runtime
# user from the start, not by root.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=prod-deps --chown=nextjs:nodejs /app/apps/web/node_modules ./apps/web/node_modules

WORKDIR /app/apps/web

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/drizzle/migrations ./drizzle/migrations
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/scripts/dist/migrate.js ./scripts/dist/migrate.js
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/scripts/dist/reset-password.js ./scripts/dist/reset-password.js
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/scripts/dist/backup.js ./scripts/dist/backup.js
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/scripts/dist/restore.js ./scripts/dist/restore.js
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/scripts/dist/rotate-encryption-key.js ./scripts/dist/rotate-encryption-key.js
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/scripts/dist/seed-demo.js ./scripts/dist/seed-demo.js
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/scripts/dist/reset-data.js ./scripts/dist/reset-data.js
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/scripts/dist/worker.js ./scripts/dist/worker.js

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Drop to non-root user for all runtime operations.
USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./docker-entrypoint.sh"]

# ─── Stage 5: worker ─────────────────────────────────────────────────────────
# The background job consumer, and the only image that carries Chromium. It extends the
# runner rather than duplicating it, so both processes run byte-identical application code.
#
# Kept a separate stage on purpose: Chromium and its font and library closure add hundreds of
# megabytes, and the web application never launches a browser — PDFs are rendered by a job, never in
# a request. Merging the two would put that weight on every web container and every image pull.
#
# `docker-compose.yml` must therefore build `app` with `target: runner`. Without it, Compose builds
# the last stage in this file and the web image silently gains Chromium again.
FROM runner AS worker

USER root
RUN apk add --no-cache chromium
USER nextjs

# The Alpine package installs the launcher under this name; `apps/web/lib/pdf/renderPdf.ts` refuses
# to render when it is unset rather than guessing a path.
ENV REMIT_CHROMIUM_PATH=/usr/bin/chromium-browser

ENTRYPOINT ["node", "scripts/dist/worker.js"]
