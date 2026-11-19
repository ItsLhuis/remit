# monorepo-layout

## Product position

The owner accepted the monorepo (FR1) and made the move the first change before Layer 0. Every Layer
0 change after it writes new code: the rounding primitive and currency table (`money-precision`),
the country-neutrality check on `packages/core` (`country-neutrality-check`), the job queues and the
command layer. Each would land at a root path and then move again. Moving first means each one
starts where it will stay. The move is also cheapest now: no external contributors, no released
layout (owner decision 2), and an empty `openspec/changes/`.

Who gains: contributors and agents get one place for country-neutral pure logic (`packages/core`),
which N2 can check, and a worker with its own entry and build. Operators see no difference: the same
images, Compose services and `remit:*` commands.

R13-12 left one thing unknown: whether Next.js standalone output works when the build runs from a
workspace root (R13 section 2.14). The Next.js documentation says the tracing root defaults to the
project directory. Files outside it are left out unless `outputFileTracingRoot` points at the
workspace root, and `server.js` is then written under `.next/standalone/<path from root>/`, so
`.next/standalone/apps/web/server.js` here. That changes the paths in the runner image.

## Scope

- In:
  - `pnpm-workspace.yaml` lists `apps/*` and `packages/*`. Three packages: `apps/web`
    (`@remit/web`), `apps/worker` (`@remit/worker`), `packages/core` (`@remit/core`); all are
    `private`.
  - Move the application into `apps/web` with history kept by `git mv`: `app/`, `features/`,
    `components/`, `lib/`, `hooks/`, `providers/`, `database/`, `drizzle/`, `public/`, `proxy.ts`,
    `instrumentation.ts`, the app's own configs (Next.js, PostCSS, Drizzle, Playwright, Vitest,
    `components.json`), the `remit:*` CLI under `scripts/` and `scripts/core/`, and the app's tests.
    The `@/*` alias keeps its meaning inside `apps/web`, so imports inside the app do not change.
    Question 3 lists what stays at the root.
  - Move the worker process into `apps/worker`: `scripts/worker.ts`, `scripts/core/worker/` and its
    tests, with its own tsup build. How it reaches the job handlers is question 1.
  - Create `packages/core` with the purity rule applied to the whole package (no framework, React,
    Drizzle, IO, environment or `apps/*` import, enforced by lint), its own `tsconfig`, a Vitest
    project, and the first content from question 2.
  - Standalone output proven from the workspace root (R13-12): `outputFileTracingRoot`, plus
    `turbopack.root` if the build needs it, set to the root. The Dockerfile builds from the root and
    runs `apps/web/server.js`, and both image targets (`runner`, `worker`) build and start. This
    proof is the first task, so a failure stops the change before the worker and core work (question
    5).
  - The root commands in `AGENTS.md` (`pnpm dev`, `build`, `lint`, `typecheck`, `test`,
    `test:integration`, `test:e2e`, `database:*`, `remit:*`, `version:*`) keep their names and pass
    to the right package through pnpm filters. No task runner (R13-12).
  - Repoint every path-coupled file: the Dockerfile, `docker-entrypoint.sh`, Compose build contexts,
    the CI, image, e2e and install workflows, `tsconfig`, ESLint and oxlint globs, `lint-staged`,
    `scripts/host/*`, `tests/docs/*` (packaging, rules, links), `AGENTS.md` (directory map, rule
    table globs), the `paths:` globs in `.claude/rules/*`, the `.agents/rules/*` path mentions
    (including the `packages/core` extraction line in `architecture.md`), `scripts/README.md`,
    `docs/architecture/ARCHITECTURE.md` and the operator docs that name repository paths.
  - Correct `openspec/backlog.md` Next entry 1 to the three packages (done with this proposal).
- Out:
  - `packages/i18n` (created by `i18n-json-catalogs`), `packages/fiscal-packs` (created by the first
    change that ships pack data), and every other folder in R13 section 2.14 (`apps/control-plane`,
    `apps/mobile`, `apps/docs`, `packages/db`, `packages/sdk`, `packages/config`): each is created
    when its own deliverable starts (FR1).
  - Moving feature `services/` into `packages/core` beyond question 2's answer.
  - Any behaviour change, any schema or migration change, and any dependency upgrade.
  - Licence fields in `package.json` files (`scope-text-amendments`).
  - A task runner, remote build caching, separate image names and new Compose services.

## Capabilities touched

- none. The two capability specs (`authentication-audit`, `two-factor-authentication`) describe
  behaviour that does not change; their code anchors are repointed if they name moved paths.

## Spec impact

- Added: none
- Modified: none (spec anchors repointed only)
- Removed: none
- Unchanged behaviour that must survive:
  - The whole application and worker: every route, job, event subscriber and CLI command.
  - Image names `ghcr.io/itslhuis/remit/app` and its worker target, Compose service names, the
    runner's non-root user, `/app/data`, and port 3000.
  - The operator contract: `docker compose exec app pnpm remit:<command>` and
    `docker compose run ... --entrypoint node app scripts/dist/<command>.js` work as documented, and
    migrations run on container start.
  - `docs/operations/UPGRADE.md` stays at its path (`releaseLinks.ts`, `install.sh`).
  - Every root command named in `AGENTS.md`, on Windows and Linux.
  - Error-report source maps for server chunks (`pnpm build:source-maps`, `sourceMaps.ts`).

## Size and verification

About 2,150 of 2,301 tracked files move. The `plan-change` task list cuts the move into individually
verified commits. Every task ends with `pnpm lint`, `pnpm typecheck` and `pnpm test` green from the
root. The change ends with: `pnpm build` from the root; `docker build` of both targets from the
root; `docker compose up` with `/api/health` 200; the worker rendering an invoice PDF;
`docker compose exec app pnpm remit:backup --yes`; and `pnpm test:integration` and `pnpm test:e2e`
against the moved app.

## Open questions

1. **How does `apps/worker` reach the job handlers, the database and `lib/`?** The worker today
   imports `features/*/jobs`, `features/*/events`, `lib/jobs/worker`, `lib/config/env`,
   `lib/errorTracking` and `@/database` (`scripts/core/worker/loadWorkerFeatureModules.ts`). FR1
   allows no `packages/db` or server package now.
   - A. `apps/worker` depends on `@remit/web` (`workspace:*`). `apps/web` declares an `exports` map
     that names only the modules the worker loads. The app-to-app edge is recorded as a known limit
     in the architecture map until `job-queues`/`command-layer-outbox` or a `packages/db` change
     removes it.
   - B. Create `packages/db` and a server package now, which amends FR1.
   - C. The worker entry stays in `apps/web`, and `apps/worker` holds only its build and image
     stage.
   - Recommended: **A**. It keeps FR1's three packages, gives the worker its own source and build,
     and makes the edge explicit and narrow. B pulls part of a later layout forward without the
     change that designs it. C makes `apps/worker` a folder with nothing to own.

2. **What does `packages/core` hold when it is created?** An empty package is stub code (hard rule).
   - A. The framework-free helpers in `lib/utils/` that feature services already import (`money`,
     `datetime`, `format`, `string`, `csv`, `locale`, `html`, `url`, each confirmed free of IO when
     moved). `cn`, `dataTable`, `exportTableToCsv`, `request`, `response` and `searchParams` stay in
     `apps/web`. Feature services stay in `features/<name>/services/` and move into core later,
     starting with the Layer 0 changes that rewrite them (`money-precision` first).
   - B. All 174 non-test files under `features/*/services/` now. They import their feature's
     `types.ts`/`schemas.ts` and other features through public doors, so this is a redesign of the
     feature boundary, not a move.
   - Recommended: **A**. It proves the package wiring (TypeScript resolution, Next.js transpiling,
     the tsup bundle, Vitest, the lint boundary) with real code in a small diff. It also gives
     `country-neutrality-check` and `money-precision` a home.

3. **What stays at the root, and how is tooling shared?**
   - Recommended: the root keeps the workspace and repository tooling. That is ESLint, oxlint,
     Prettier, commitlint, husky, `lint-staged`, a `tsconfig.base.json` that each package extends,
     the release scripts (`bump-version`, `check-changelog`) and `tests/docs/`. The root also keeps
     the deployment files: `Dockerfile`, `docker-compose*.yml`, `docker-entrypoint.sh`, `deploy/`,
     `scripts/host/`. Docs, `openspec/`, `.agents/` and `CHANGELOG.md` stay too. One root
     `eslint.config.mjs` and one Vitest configuration with a project per package; no
     `packages/config` (FR1).
   - Alternative: a config per package from the start. It costs more files now and saves nothing
     until a package needs different rules.

4. **How are the images built?**
   - Recommended: one root `Dockerfile` built from the workspace root. The `worker` stage still
     extends the web `runner`, so both run byte-identical code and only the worker carries Chromium.
     Image names, targets and Compose services stay the same.
   - Alternative: an independent worker image built with `pnpm deploy --filter @remit/worker`, as
     R13 section 2.14 sketches ("each image builds one app"). This only works once the worker no
     longer needs web code (question 1), so it waits for that change.

5. **What happens if the standalone proof fails from the workspace root?**
   - Recommended: the change stops at that task and returns to the owner with the evidence, as
     R13-12 states ("would change if"). Agents do not work around it, for example by building
     `apps/web` as a non-workspace root or copying `node_modules` by hand.

## Gate 1

pending
