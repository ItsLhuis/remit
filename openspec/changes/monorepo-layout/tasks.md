# monorepo-layout — tasks

Each task is one commit whose body contains `Change: monorepo-layout, task <n>`. Tick the box in the
same commit. A ticked box is a claim; `next-step` checks it against `git log`.

Every task ends with `pnpm lint`, `pnpm typecheck` and `pnpm test` green from the repository root,
and no task changes behaviour, the schema, a migration or a dependency version (proposal, Out).

- [x] 1. Move the web application into `apps/web` and prove standalone output from the root
  - Do: List `apps/*` and `packages/*` in `pnpm-workspace.yaml`. Create `apps/web/package.json`
    (`@remit/web`, `private`) carrying the application's runtime dependencies; the root
    `package.json` keeps the repository tooling (decision 3). Move with `git mv`, so history
    follows: `app/`, `features/`, `components/`, `lib/`, `hooks/`, `providers/`, `database/`,
    `drizzle/`, `public/`, `__tests__/`, `tests/` except `tests/docs/`, `proxy.ts`,
    `instrumentation.ts`, `next-env.d.ts`, `next.config.mjs`, `postcss.config.mjs`,
    `drizzle.config.ts`, `drizzle.test.config.ts`, `playwright.config.ts`,
    `vitest.integration.config.ts`, `components.json`, `tsup.scripts.config.ts`, the `remit:*`
    entries and `migrate.ts`, `worker.ts`, `ship-server-source-maps.ts` and
    `generate-encryption-key.ts` under `scripts/`, `scripts/core/` except the modules only the
    release scripts use, and `scripts/README.md`. The worker stays inside `apps/web` until task 4.
    Add a root `tsconfig.base.json` that `apps/web/tsconfig.json` extends, with `@/*` resolving to
    `apps/web`. Set `outputFileTracingRoot` (and `turbopack.root` only if the build needs it) to the
    workspace root. Turn the root `vitest.config.ts` into one configuration with a project per
    package (the two `apps/web` environment projects and `tests/docs`). Repoint every file a command
    or test reads: the root scripts (same names, delegating with `pnpm --filter @remit/web`), the
    Dockerfile (builds from the root, copies every workspace `package.json` into the install stages,
    runs `apps/web/server.js`), `docker-entrypoint.sh`, the Compose files, `deploy/`,
    `scripts/host/*`, the CI, image, e2e and install workflows, `pnpm typecheck` (it checks every
    package), ESLint, oxlint and `lint-staged` globs, `.fallowrc.json`, `.prettierignore`,
    `.dockerignore`, `.gitignore`, the `tests/docs/*` readers, and every repository path that
    `tests/docs` checks (guidance file paths, Markdown links, comment citations, spec anchors,
    `code-style.md` exemplars). The release version keeps one source: `version:*` writes the file
    that `@/package.json` resolves to, or the readers move to the root file. Keep the runtime
    contract: `/app/data`, port 3000, the non-root user, `docker compose exec app pnpm remit:<cmd>`,
    `docker compose run --entrypoint node app scripts/dist/<cmd>.js`, migrations on container start,
    and the server source maps from `pnpm build:source-maps`.
  - Stop condition (decision 5): if `pnpm build` from the root does not produce a standalone server
    that starts in the `runner` image, do not commit and do not work around it (no non-workspace
    build of `apps/web`, no hand-copied `node_modules`). Report the command, its output and the
    Next.js version to the owner.
  - Done when: `pnpm build` from the root writes `apps/web/.next/standalone/apps/web/server.js`;
    `docker build --target runner .` and `docker build --target worker .` succeed from the root;
    `docker compose up` answers `/api/health` with 200 and the worker container stays up;
    `docker compose exec app pnpm remit:backup --yes` writes an archive; `pnpm test:integration` and
    `pnpm test:e2e` pass; the only files left at the root are the ones decision 3 names.
  - Verify: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, then
    `docker build --target runner -t remit-app:monorepo . && docker build --target worker -t remit-worker:monorepo .`,
    `docker compose up -d --build`, `curl -fsS http://localhost:3000/api/health`,
    `docker compose exec -T app pnpm remit:backup --yes`,
    `pnpm database:test:up && pnpm database:test:migrate && pnpm test:integration`, `pnpm test:e2e`

- [ ] 2. Give each package its own Vitest config and make the TypeScript base neutral
  - Do: Create `apps/web/vitest.config.ts` with `defineProject`, named `web`, holding the `@/*`
    alias to `apps/web` and the node and happy-dom environment projects as its nested projects, with
    the comment that keeps their `include` and `exclude` exact complements. Reduce the root
    `vitest.config.ts` to `projects: ["apps/*", "packages/*"]` plus the `repository` project,
    keeping only the options Vitest reads from the root alone: `maxWorkers` and the `coverage` block
    with its include, exclude and thresholds (decision 3). Remove `dom`, `dom.iterable`, `jsx` and
    `allowJs` from `tsconfig.base.json` and add them to `apps/web/tsconfig.json`. Move `happy-dom`
    from the root `devDependencies` to those of `apps/web`, keeping its version range.
  - Done when: `pnpm test` runs the same test files as before, split across the two `web` projects
    and `repository`; the root `vitest.config.ts` names no `apps/web` path outside `coverage`;
    `tsconfig.base.json` sets no `dom` library, `jsx` or `allowJs`; `happy-dom` is declared only in
    `apps/web/package.json`; `pnpm test:coverage` still enforces the services threshold.
  - Verify: `pnpm lint && pnpm typecheck && pnpm test`, `pnpm test:coverage`, and
    `pnpm exec vitest list --filesOnly` lists the same files before and after the task

- [ ] 3. Repoint rule loading and the agent guidance to the new layout
  - Do: Rewrite the `paths:` globs in every `.claude/rules/*.md` pointer and the Files column of the
    rule table in `AGENTS.md` to the `apps/web/...` locations, and add `packages/core/**` and
    `apps/worker/**` where a rule applies to them (`code-style`, `comments`, `types`, `imports`,
    `errors`, `testing`, and `architecture` for `packages/core`). Update the `AGENTS.md` directory
    map and Commands block to the three packages, and the matching path mentions in
    `.agents/rules/*`, `.agents/skills/*`, `.agents/agents/*`, `.agents/README.md` and `.codex/`
    that tasks 1 and 2 did not have to change. In `.agents/rules/architecture.md`, replace the line
    that names `packages/core` as a future extraction with what the package holds and its purity
    rule.
  - Done when: no rule pointer glob or rule-table row names a root `app/`, `features/`, `lib/`,
    `components/`, `hooks/`, `providers/`, `database/` or `drizzle/` path; a file under
    `apps/web/features/` and one under `packages/core/` each match the rules the table lists for
    them.
  - Verify: `pnpm lint && pnpm typecheck && pnpm test`, and
    `git grep -nE '^\s+- "(app|features|lib|components|hooks|providers|database|drizzle)/' -- .claude/rules`
    prints nothing

- [ ] 4. Move the worker process into `apps/worker`
  - Do: Create `apps/worker/package.json` (`@remit/worker`, `private`, depending on
    `@remit/web: workspace:*`) and its `tsconfig.json`. Move `worker.ts` and `core/worker/` with its
    tests into `apps/worker` with `git mv`. Give `apps/web/package.json` an `exports` map that names
    only the modules `loadWorkerFeatureModules` and the worker entry load (decision 1), and import
    them through `@remit/web/...`. Give the worker its own tsup build that bundles the `@remit/web`
    modules, and drop the `worker` entry from the `apps/web` tsup config. Keep `pnpm dev:worker` and
    `pnpm start:worker` working from the root. Point the Dockerfile `worker` stage at the new bundle
    while it still extends `runner` (decision 4), give the worker its own `vitest.config.ts`, which
    the root `apps/*` glob picks up, add the package to the root `pnpm typecheck`, and update
    `tests/docs/packaging.test.ts` to the bundles each package builds. Record the app-to-app edge as
    a known limit in `docs/architecture/ARCHITECTURE.md`, naming `job-queues`,
    `command-layer-outbox` or a `packages/db` change as what removes it.
  - Done when: `apps/worker` imports nothing from `apps/web` outside the `exports` map (a deep
    import fails `pnpm typecheck`); the job-catalog test runs from `apps/worker`; the `worker` image
    starts and renders an invoice PDF.
  - Verify: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, then
    `docker compose up -d --build`, trigger an invoice PDF render in the running app and confirm the
    worker log shows the render job completing, and
    `docker compose exec -T app pnpm remit:backup --yes`

- [ ] 5. Create `packages/core` with the pure `lib/utils` helpers
  - Do: Create `packages/core` (`@remit/core`, `private`) with a `tsconfig.json` that extends the
    base without overriding `lib` and is covered by the root `pnpm typecheck`, its own
    `vitest.config.ts`, which the root `packages/*` glob picks up, and an `index.ts` door; add
    `packages/core/**` to the root `coverage` include, since Vitest reads coverage only from the
    root. Move with `git mv` `money`, `datetime`, `format`, `string`, `locale`, `html` and `url`
    from `apps/web/lib/utils/` with their tests, and from `csv.ts` move `escapeCsvValue` and
    `serializeCsv`; `downloadCsv` touches `document`, so it stays in `apps/web/lib/utils` (decision
    2: confirmed free of IO when moved). Callers import the moved helpers from `@remit/core`;
    `@/lib/utils` keeps only the web-only helpers and does not re-export core. Add the ESLint block
    that applies the purity rule to `packages/core/**` (no `next`, `react`, `drizzle-orm`,
    `postgres`, `node:*` IO modules, `@/` or `@remit/web` import, and no `process` or `document`
    global), a `@remit/core` import group, `transpilePackages: ["@remit/core"]` in `next.config.mjs`
    if the build needs it, and the core paths in `tests/docs/sanitization.test.ts`. The tsup bundles
    inline `@remit/core`.
  - Done when: the moved helpers' tests run in the `packages/core` project; nothing under
    `apps/web/lib/utils` defines a moved helper; ESLint rejects a framework or IO import in
    `packages/core`; `pnpm test:coverage` reports the `packages/core` files; `pnpm build` and both
    images still build.
  - Verify: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`,
    `printf 'import "react"\n' | pnpm exec eslint --stdin --stdin-filename packages/core/probe.ts`
    exits non-zero, and `docker build --target runner . && docker build --target worker .`

- [ ] 6. Repoint the architecture map, operator docs and remaining path mentions
  - Do: Update `docs/architecture/ARCHITECTURE.md` (directory map, the three packages, where pure
    logic lives), `apps/web/scripts/README.md`, the operator runbooks in `docs/operations/` and the
    deployment guides that name repository paths, `README.md`, and any remaining prose mention of a
    moved path found by the grep below. `docs/operations/UPGRADE.md` keeps its path.
  - Done when: no Markdown file outside `openspec/changes/` names a moved path at its old location.
  - Verify: `pnpm lint && pnpm typecheck && pnpm test`, and
    `git grep -nwE '(features|lib|components|hooks|providers|database|drizzle|app)/[A-Za-z]+' -- '*.md' ':!openspec/changes' ':!apps' ':!CHANGELOG.md'`
    shows no hit that names a moved path at its old location
