# AGENTS.md

Remit is an open-source, self-hostable business management app, today for independent freelancers.
It covers the money lifecycle from lead/client intake through projects, proposals, contracts, time,
expenses, invoices, payments, credit notes, reporting, and self-hosting operations. Every stage of
Lead -> Client -> Project -> Proposal/Contract -> Invoice is optional.

Stack: Next.js 16 App Router, React 19, TypeScript strict mode, Drizzle ORM (PostgreSQL),
better-auth (organization + TOTP plugins), Tailwind CSS v4, Zod, react-hook-form,
i18next/react-i18next/ICU, pino. Node >=24.11.1 <25, pnpm 10.33.4. Windows is a first-class
development platform.

## Commands

```bash
pnpm dev | build | start           # Next.js dev server (Turbopack), production build, start
pnpm services:up | down | logs     # Local Docker services; pnpm dev:setup also migrates
pnpm lint | lint:fix               # oxlint import-cycle pass + ESLint (cached)
pnpm typecheck                     # tsc --noEmit
pnpm test                          # Vitest unit suite (~2-3 min); pnpm exec vitest related --run <files>
pnpm test:integration              # Needs pnpm database:test:up and database:test:migrate
pnpm test:e2e                      # Playwright
pnpm check | ci                    # lint+typecheck+test | + build
pnpm format | format:check         # Prettier
pnpm database:generate             # Drizzle migration from schema changes (never hand-edit output)
pnpm database:migrate              # Confirm the target environment first
pnpm remit:<backup|restore|reset-password|reset-data|seed-demo|rotate-encryption-key>
pnpm version:<patch|minor|major>   # Releases CHANGELOG.md Unreleased (refuses if empty)
```

## Directory map

- `app/` - App Router routes; groups `(auth)`, `(setup)`, `(dashboard)`; public token routes for
  invoices, proposals, contracts and the client portal.
- `features/<name>/` - closed domain modules (`components/`, `hooks/`, `services/`, `queries.ts`,
  `mutations.ts`, `schemas.ts`, `types.ts`, `events.ts`, `index.ts`, `server.ts`). Cross-feature
  imports only through public doors (`.agents/rules/architecture.md`).
- `components/` - shared UI (`ui/`, `layout/`), each with an `index.ts` barrel.
- `database/` - Drizzle schemas (`database/schema/`); `drizzle/migrations/` is generated.
- `lib/` - server and client utilities; `lib/auth/session.ts` has `requireSession`/`requireRole`.
- `hooks/`, `providers/`, `scripts/`, `tools/eslint-rules/` (custom `remit/*` lint rules).
- `openspec/` - living capability specs, changes in flight, backlog and gap register.
- `docs/architecture/` - `ARCHITECTURE.md`, `SCHEMA.md`, ADRs; `docs/delivery/` - sealed records.

## Hard rules

- NEVER read `.env` or `.env.*` (example/template env files are allowed).
- NEVER run `pnpm database:migrate` without confirming the target environment.
- No `tenantId` columns or row-level tenancy: Remit is single-instance; Hosted mode is per-instance
  isolation.
- No hand-edited migrations, no `any`, no non-null assertions, no unvalidated inputs, no plaintext
  secrets, no TODO/stub code on `main`.
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
4. Living, dateless capability specs in `openspec/` replace dated ADRs and sealed delivery records:
   add no new ADR or delivery record; existing ones stay until migrated.
5. Skills, agents and rules are general, never tied to one feature.
6. The owner keeps UI/UX, Figma mockups and the design system: UI changes stop at the design gate.
7. Everything in the repository is English.

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
your own change made unused; verify against the goal before claiming success.

## Rules

Before writing or editing a file, read the rules that match it. Claude Code loads a pointer to the
matching rule automatically (`.claude/rules/`); other agents use this table. A rule counts as
enforced only when a lint rule at `error` backs it; the rest is reviewer guidance. `pnpm lint` does
not fail on warnings; the `warn` rules (`max-lines`, `max-params`, `sonarjs/*`) are advisory and no
change may add new warnings to them.

| Files                                                    | Rules                                                                             |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| any `.ts`/`.tsx`                                         | `code-style`, `comments`, `types`, `imports`, `errors`, `i18n`, `money-and-dates` |
| `features/**`, `app/**`, `lib/**`                        | `architecture`, `auth`                                                            |
| `.tsx` components                                        | `components`, `accessibility`, `forms`                                            |
| `mutations.ts`, `*Mutations.ts`, `systemWrites.ts`       | `actions`, `events`, `database`                                                   |
| `queries.ts`, `public*.ts`                               | `queries`, `database`                                                             |
| `app/**/route.ts`                                        | `routes`, `security`                                                              |
| public token routes, `proxy.ts`, `lib/auth/**`, settings | `security`, `auth`                                                                |
| `hooks/**`, `features/**/hooks/**`                       | `hooks`                                                                           |
| `database/**`, `drizzle/**`                              | `database`                                                                        |
| `events.ts`, `events/**`, `lib/events/**`                | `events`                                                                          |
| tests, `tests/**`, test configs                          | `testing`                                                                         |

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

Linting is split: `import/no-cycle` runs in oxlint (`.oxlintrc.json`, that one rule only, because in
ESLint it cost ~315 s of a ~375 s run); every other rule is ESLint (`eslint.config.mjs`). Do not add
rules to oxlint without deciding deliberately which tool owns them.

## References

- `docs/architecture/ARCHITECTURE.md` - the technical reference; plans must align with it.
- `openspec/README.md` - the spec format; `openspec/backlog.md` - what is next and every known gap.
- `.agents/README.md` - where agent guidance lives and how the tool wrappers map to it.
