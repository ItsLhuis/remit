# DR-0001: Application foundation, containers and health

- **Status:** Shipped
- **Date:** 2026-06-01
- **Verdict:** Complete
- **Decisions:** ADR-0011, ADR-0020
- **Supersedes:** —
- **Reconstructed:** yes

## What

The Next.js application, its Postgres and object-store services, the container image that runs
migrations before the server, and the health surfaces an operator checks.

## Why

Remit is self-hosted first, so the deployment artefact is part of the product rather than a
consequence of it. A freelancer who cannot tell whether their instance is healthy — whether the
database is reachable, whether migrations applied, whether the backup destination answers — has no
way to trust it with the records that run their business.

## Scope

Included: the single Next.js App Router application, the multi-stage `Dockerfile`, the production
Compose stack and the separate development, CI and test Compose files, the container entrypoint that
applies pending migrations before starting the server, the anonymous `/api/health` liveness
endpoint, and the authenticated system health dashboard at `/settings/system` covering database
connectivity, migration state, email, storage and Stripe reachability, backup destination and last
result, disk and inode usage, and the encryption key fingerprint.

Excluded: a monorepo layout, deliberately, per ADR-0011 — the application stays a single build
artefact until a second artefact needs its own. Also excluded is any host-side orchestration inside
the app container: image pulls and Compose restarts are host-side per ADR-0020, and the app
container never receives the Docker socket.

## How

`docker-entrypoint.sh` runs the compiled `scripts/dist/migrate.js` and only then `node server.js`,
so a container that starts is a container whose schema is current. `scripts/migrate.ts` is
deliberately not a `remit:*` package script: it is an entrypoint concern, not an operator command,
and `docs/architecture/operations/CLI-CONTRACT.md` records it in its own section for that reason.

The two health surfaces answer different questions and are deliberately not one. `/api/health` is
anonymous and returns only `{ ok, version }`, because anything richer would be an unauthenticated
disclosure of an instance's internal state to whoever can reach the port. The dashboard is behind a
session and is where the detail lives.

Each check is a private function in `features/health/queries.ts` returning the same
`HealthCheckResult` shape, and `getHealthChecks` composes them, so one probe reporting a failure
degrades that row rather than the dashboard. The pure scoring of those results lives in
`features/health/services/evaluateHealth.ts`, which is why it can be unit-tested without a database.

## Evidence

- `Dockerfile`, `docker-entrypoint.sh`, `docker-compose.yml`, `docker-compose.dev.yml`,
  `docker-compose.ci.yml`, `docker-compose.test.yml`
- `scripts/migrate.ts`, `tsup.scripts.config.ts`
- `app/api/health/route.ts`, `features/health/queries.ts`,
  `features/health/services/evaluateHealth.ts`, `features/health/components/HealthSettingsPage/`
- `docs/architecture/operations/CLI-CONTRACT.md` — the `scripts/migrate.ts` section
- `.github/workflows/ci.yml`, `.github/workflows/docker.yml`, `.github/workflows/e2e.yml`

## Verification

`tests/e2e/health.spec.ts` asserts the public endpoint's `{ ok, version }` shape against a running
container. `features/health/services/__tests__/evaluateHealth.test.ts` covers the scoring of check
results. CI runs lint, typecheck, the unit suite and a production build on every push, with the
integration suite against a Dockerized Postgres and Redis.

Not covered by an automated test: the entrypoint's migrate-then-serve ordering, which is exercised
only by the E2E workflow starting a real image, and the disk and inode readings, which depend on the
host filesystem.

## Known gaps

`scripts/install.sh` does not exist; `README.md` and `docs/architecture/ARCHITECTURE.md` describe a
one-command install as planned work. There is no `docs/deploy/` with platform-specific guides.
`/api/metrics` is reserved in the architecture and has no route.
