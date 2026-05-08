# ─── Stage 1: base ───────────────────────────────────────────────────────────
FROM node:24.11.1-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ─── Stage 2: deps ───────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm i --frozen-lockfile

FROM deps AS prod-deps
RUN pnpm prune --prod

# ─── Stage 3: builder ────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production

# NEXT_PUBLIC_* variables are the only legitimate build-time ARGs because
# Next.js statically embeds them into the client bundle at build time.
#
# Secrets such as DATABASE_URL and BETTER_AUTH_SECRET must NEVER be build
# ARGs - they are visible in plain text via `docker history` and are baked
# into intermediate image layers. They are injected at runtime instead,
# via the `environment` block in docker-compose.yml.
#
# A placeholder DATABASE_URL is provided here solely to satisfy any
# static analysis or module-level imports during the Next.js build.
# No real database connection is made at build time.
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_STORAGE_BASE_URL
ENV NEXT_PUBLIC_STORAGE_BASE_URL=$NEXT_PUBLIC_STORAGE_BASE_URL
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder

RUN corepack enable pnpm && pnpm build

# ─── Stage 4: runner ─────────────────────────────────────────────────────────
FROM node:24.11.1-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable pnpm

# Create a non-root system user and group in a single layer.
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

# All COPY instructions include --chown so files are owned by the runtime
# user from the start, not by root.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules

COPY --from=builder --chown=nextjs:nodejs /app/drizzle/migrations ./drizzle/migrations
COPY --from=builder --chown=nextjs:nodejs /app/scripts/dist/migrate.js ./scripts/dist/migrate.js
COPY --from=builder --chown=nextjs:nodejs /app/scripts/dist/reset-password.js ./scripts/dist/reset-password.js

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Drop to non-root user for all runtime operations.
USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./docker-entrypoint.sh"]
