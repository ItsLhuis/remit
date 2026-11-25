# AGENTS.md

Remit is an open-source, self-hostable business management app, today for independent freelancers.
It covers the money lifecycle from lead/client intake through projects, proposals, contracts, time,
expenses, invoices, payments, credit notes, reporting, and self-hosting operations. Every stage of
Lead -> Client -> Project -> Proposal/Contract -> Invoice is optional.

Stack: Next.js 16 App Router, React 19, TypeScript strict mode, Drizzle ORM (PostgreSQL),
better-auth (organization + TOTP plugins), Tailwind CSS v4, Zod, react-hook-form,
i18next/react-i18next/ICU, pino. Node >=26.13.1 <27, pnpm 12.21.0. Windows is a first-class
development platform.

## Commands

```bash
pnpm dev | build | start           # Next.js dev server (Turbopack), production build, start
pnpm dev:worker | start:worker     # apps/worker job consumer, from source (tsx) or from its build
pnpm services:up | down | logs     # Local Docker services; pnpm dev:setup also migrates
pnpm lint | lint:fix               # oxlint import-cycle pass + ESLint (cached), whole repository
pnpm typecheck                     # tsc --noEmit for the root, apps/web, apps/worker and packages/core
pnpm test                          # Vitest, the web, worker, core and repository projects (~2-3 min); pnpm exec vitest related --run <files>
pnpm test:integration              # Needs pnpm database:test:up and database:test:migrate
pnpm test:e2e                      # Playwright
pnpm --filter @remit/<web|worker> <script>  # One package's script; the root's app commands delegate
pnpm check | ci                    # lint+typecheck+test | + build
pnpm format | format:check         # Prettier
pnpm database:generate             # Drizzle migration from schema changes (never hand-edit output)
pnpm database:migrate              # Confirm the target environment first
pnpm remit:<backup|restore|reset-password|reset-data|seed-demo|rotate-encryption-key>
pnpm version:<patch|minor|major>   # Releases CHANGELOG.md Unreleased (refuses if empty)
```

## Directory map

A pnpm workspace (`apps/*`, `packages/*`) that today holds three private packages, `apps/web`
(`@remit/web`, the Next.js application), `apps/worker` (`@remit/worker`, the job worker) and
`packages/core` (`@remit/core`, pure helpers). The root keeps the repository tooling, the deployment
files, the docs and `openspec/`.

- `apps/web/app/` - App Router routes; groups `(auth)` (with `/setup`), `(dashboard)`, `(editor)`,
  `(public)`; token routes for invoices, proposals, contracts and the client portal.
- `apps/web/features/<name>/` - closed domain modules (`components`, `hooks` and `services` folders,
  `queries.ts`, `mutations.ts`, `schemas.ts`, `types.ts`, `events.ts`, `index.ts`, `server.ts`).
  Cross-feature imports only through public doors (`.agents/rules/architecture.md`).
- `apps/web/components/` - shared UI (`ui/`, `layout/`), each with an `index.ts` barrel.
- `apps/web/database/` - Drizzle schemas (`apps/web/database/schema/`); `apps/web/drizzle/` holds
  the generated migrations, hand-written SQL aside.
- `apps/web/lib/` - server and client utilities; `apps/web/lib/auth/session.ts` has
  `requireSession`/`requireRole`.
- `apps/web/hooks/`, `apps/web/providers/`; `tools/eslint-rules/` (custom `remit/*` lint rules).
- `apps/web/scripts/` - `remit:*` commands; `scripts/` - host and release scripts.
- `apps/worker/` - `@remit/worker`, the background job worker (`worker.ts`, `core/`). It reaches web
  code only through the `exports` map in `apps/web/package.json`.
- `packages/core/` - `@remit/core`, the pure helpers (money, dates, formatting, CSV, HTML escaping,
  URLs) imported through its `index.ts`; no framework, IO or app import
  (`.agents/rules/architecture.md`).
- `openspec/` - living capability specs, changes in flight, backlog and gap register.
- `docs/` - architecture map, operator runbooks, deployment guides.

## Hard rules

- NEVER read `.env` or `.env.*` (example/template env files are allowed).
- NEVER run `pnpm database:migrate` without confirming the target environment.
- No `tenantId` columns or row-level tenancy: Remit is single-instance; Hosted mode is per-instance
  isolation.
- Never edit generated migration output; hand-written SQL migrations only cover what Drizzle cannot
  express, state why in their header and survive a squash unchanged. No `any`, no non-null
  assertions, no unvalidated inputs, no plaintext secrets, no TODO/stub code on `main`.
- Server actions in `features/<feature>/mutations.ts` are the write path. API routes exist only for
  public anonymous token routes, webhooks, health/metrics and explicitly justified public APIs.
- Business logic lives in pure functions under `features/<feature>/services/` (no framework,
  Drizzle, React or IO imports).

## Owner decisions

Standing decisions of the owner. Only the owner changes them.

1. Git: agents commit locally, one verified logical step per commit, staging explicit paths only.
   Agents never push, merge, amend, rebase, reset, check out, switch, restore, clean, stash, tag,
   create branches or worktrees, bypass hooks, or run `git add -A`/`git add .`. The owner reviews
   and pushes. Procedure: `.agents/skills/git-commit/SKILL.md`.
2. Everything is pre-v1 until the owner declares v1. No migration paths or back-compat notes for
   unreleased changes.
3. The database migration history will be squashed before schema freeze; the owner schedules it.
4. Skills, agents and rules are general, never tied to one feature.
5. The owner keeps UI/UX, Figma mockups and the design system: UI changes stop at the design gate.
6. Everything in the repository is English.

## How work is done

Use the skills in `.agents/skills/` (Claude Code: `.claude/skills/`):

- `next-step` to resume or pick the next piece of work; `quick-change` for a small change that meets
  its criteria; otherwise `propose-change` → `plan-change` → `implement-task` → `finish-change`.
- `git-commit` for every commit; `write-spec` for `openspec/specs/**`; `write-skill` for skills and
  agents.
- Agents: `implementer`, `reviewer`, `researcher` (`.agents/agents/`).

Done means `pnpm lint`, `pnpm typecheck` and the tests covering the touched area pass, the spec says
what the code now does, and every touched file was checked against `.agents/rules/comments.md`
("Where comments belong"). Working principles: state assumptions; write the minimum that solves the
stated problem; touch only what the task requires and match the surrounding style; remove only what
your own change made unused; verify against the goal before claiming success. Repository files
describe the present state; history lives in git.

## Rules

Before writing or editing a file, read the rules that match it. Claude Code loads the matching rule
pointer automatically (`.claude/rules/`); others use this table. A rule counts as enforced only when
a lint rule at `error` backs it; the rest is reviewer guidance. `pnpm lint` does not fail on
warnings; the `warn` rules (`max-lines`, `max-params`, `sonarjs/*`) are advisory and no change may
add new ones.

| Files                                                                      | Rules                                                                             |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| any `.ts`/`.tsx`, in every package                                         | `code-style`, `comments`, `types`, `imports`, `errors`, `i18n`, `money-and-dates` |
| `apps/web/features/**`, `apps/web/app/**`, `apps/web/lib/**`               | `architecture`, `auth`                                                            |
| `packages/core/**`                                                         | `architecture`                                                                    |
| `.tsx` components                                                          | `components`, `accessibility`, `forms`                                            |
| `mutations.ts`, `*Mutations.ts`, `systemWrites.ts`                         | `actions`, `events`, `database`                                                   |
| `queries.ts`, `public*.ts`                                                 | `queries`, `database`                                                             |
| `apps/web/app/**/route.ts`                                                 | `routes`, `security`                                                              |
| public token routes, `apps/web/proxy.ts`, `apps/web/lib/auth/**`, settings | `security`, `auth`                                                                |
| `apps/web/hooks/**`, `apps/web/features/**/hooks/**`                       | `hooks`                                                                           |
| `apps/web/database/**`, `apps/web/drizzle/**`                              | `database`                                                                        |
| `events.ts`, `events/**`, `apps/web/lib/events/**`                         | `events`                                                                          |
| tests, `tests/**`, `apps/web/tests/**`, test configs                       | `testing`                                                                         |

Each rule is `.agents/rules/<name>.md`: [accessibility](.agents/rules/accessibility.md),
[actions](.agents/rules/actions.md), [architecture](.agents/rules/architecture.md),
[auth](.agents/rules/auth.md), [code-style](.agents/rules/code-style.md),
[comments](.agents/rules/comments.md), [components](.agents/rules/components.md),
[database](.agents/rules/database.md), [errors](.agents/rules/errors.md),
[events](.agents/rules/events.md), [forms](.agents/rules/forms.md), [hooks](.agents/rules/hooks.md),
[i18n](.agents/rules/i18n.md), [imports](.agents/rules/imports.md),
[money-and-dates](.agents/rules/money-and-dates.md), [queries](.agents/rules/queries.md),
[routes](.agents/rules/routes.md), [security](.agents/rules/security.md),
[testing](.agents/rules/testing.md), [types](.agents/rules/types.md).

Linting is split: `import/no-cycle` runs in oxlint (`.oxlintrc.json`, that one rule only: in ESLint
it cost ~315 s of ~375 s); every other rule is ESLint (`eslint.config.mjs`). Do not add rules to
oxlint without deciding deliberately which tool owns them.

## Gotchas

- A `remit:*` command: `apps/web/scripts/README.md`. The archive or its manifest:
  `apps/web/scripts/core/archive/README.md`.
- What an operator runs on install, upgrade or restore: its runbook in `docs/operations/`.
- `docs/operations/UPGRADE.md` stays put: `apps/web/features/health/services/releaseLinks.ts` builds
  its URL and `scripts/host/install.sh` prints it.

## References

- `docs/architecture/ARCHITECTURE.md` - the architecture map; plans align with it; the file a
  section names wins over it.
- `openspec/README.md` - the spec format; `openspec/backlog.md` - what is next and every known gap.
- `.agents/README.md` - where agent guidance lives and how the tool wrappers map to it.
