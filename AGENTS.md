# AGENTS.md

Remit is an open-source, self-hostable business management app for independent freelancers. It
covers the money lifecycle from lead/client intake through projects, proposals, contracts, time,
expenses, invoices, payments, credit notes, reporting, and self-hosting operations. The core
workflow is Lead -> Client -> Project -> Proposal/Contract -> Invoice, but every stage is optional.

Stack: Next.js 16 App Router, React 19, TypeScript strict mode, Drizzle ORM (PostgreSQL),
better-auth with the organization and TOTP plugins, Tailwind CSS v4, Zod, react-hook-form,
i18next/react-i18next/ICU, and pino.

## Commands

```bash
pnpm dev                # Dev server (Turbopack)
pnpm dev:setup          # Start dev services and apply migrations
pnpm build              # Production build
pnpm build:scripts      # Build operational scripts into scripts/dist
pnpm start              # Start production server after build
pnpm services:up        # Start local development Docker services
pnpm services:down      # Stop local development Docker services
pnpm services:logs      # Follow local development service logs
pnpm services:restart   # Restart local development Docker services
pnpm lint               # ESLint check
pnpm lint:fix           # ESLint auto-fix
pnpm format             # Prettier
pnpm format:check       # Prettier check
pnpm typecheck          # TypeScript check (no emit)
pnpm check              # Lint, typecheck, and unit tests
pnpm ci                 # Lint, typecheck, unit tests, and production build
pnpm test               # Vitest unit suite
pnpm test:watch         # Vitest watch mode
pnpm test:coverage      # Vitest unit suite with coverage
pnpm test:integration   # Vitest integration suite against test Postgres
pnpm test:e2e           # Playwright end-to-end suite
pnpm test:e2e:ui        # Playwright UI mode
pnpm database:generate     # Generate Drizzle migration from schema changes
pnpm database:migrate      # Apply pending migrations
pnpm database:studio       # Drizzle Studio UI
pnpm database:test:up      # Start Dockerized test Postgres
pnpm database:test:down    # Stop and remove Dockerized test Postgres volume
pnpm database:test:migrate # Apply migrations to the test database
pnpm remit:reset-password  # Interactive password reset recovery CLI
pnpm remit:seed-demo       # Seed deterministic demo data
pnpm remit:backup          # Write encrypted backup archive
pnpm remit:restore         # Restore from encrypted backup archive
pnpm remit:rotate-encryption-key # Rotate Remit encryption key
pnpm version:patch         # Bump app version patch
pnpm version:minor         # Bump app version minor
pnpm version:major         # Bump app version major
```

Node >=24.11.1 <25. Package manager: pnpm 10.33.4. Test scripts are configured in `package.json`:
Vitest covers unit and integration tests, Playwright covers E2E flows, and `docker-compose.test.yml`
provides the Postgres service used by integration tests.

## Directory Map

- `app/` - Next.js App Router routes. Route groups include `(auth)`, `(setup)`, and `(dashboard)`.
  Public/anonymous routes include tokenized invoice, proposal, contract, and client portal surfaces.
- `features/` - Closed domain feature modules. Typical files include `components/`, `hooks/`,
  `services/`, `queries.ts`, `mutations.ts`, `schemas.ts`, `types.ts`, `events.ts`, and `index.ts`.
  Import across features only through the feature barrel (`@/features/<name>`). Feature UI
  components are exported through `components/index.ts` when intended for external use.
- `components/` - Shared UI and layout primitives. `ui/` exported via `components/ui/index.ts`;
  `layout/` via `components/layout/index.ts`. Check existing primitives before adding new UI.
- `database/` - Drizzle ORM. Schemas in `database/schema/` (one file per domain, barrel at
  `database/schema/index.ts`). Never edit files in `drizzle/migrations/` manually.
- `lib/` - Server and client utilities. `lib/auth.ts` - better-auth server config;
  `lib/authClient.ts` - client exports (`authClient`, `signOut`, `useSession`).
- `hooks/` - Shared React hooks.
- `providers/` - App-level React providers.
- `scripts/` - Repository automation scripts, including version bump helpers.

## Hard Rules

NEVER read `.env` or `.env.*` files (exception: `.env.example` and other example/template env files
are allowed). NEVER run `pnpm database:migrate` without confirming the target environment first.
NEVER force-push `main`. Pre-push hook runs `pnpm typecheck` - all type errors must be resolved
before pushing.

Do not add `tenantId` columns or row-level tenancy. Remit is structurally single-instance; Hosted
mode is per-instance isolation. Do not hand-edit generated migration files. Do not introduce `any`,
non-null assertions, unvalidated inputs, plaintext secrets, or incomplete TODO/stub code on main.

Server actions in `features/<feature>/mutations.ts` are the canonical write path. API routes are for
public anonymous token routes, webhooks, health/metrics, and future explicitly justified public API
surfaces only. Business logic belongs in pure named functions under `features/<feature>/services/`
with no framework, Drizzle, React, or IO imports.

The ESLint config (`eslint.config.mjs`) is the mechanical floor for `.agents/rules/`: import order,
type-import style, feature boundaries, service purity, accessibility, and hardcoded-string bans are
enforced there. Treat a rule as enforced only when a lint rule backs it; prose in `.agents/rules/`
without a corresponding lint rule is reviewer guidance, not an automated gate. Some lint categories
run at `warn` while an existing backlog is burned down — `jsx-a11y/*`,
`@typescript-eslint/switch-exhaustiveness-check`, and `@typescript-eslint/no-deprecated`; they are
promoted to `error` as each backlog reaches zero, and no change may add new warnings in those
categories.

## Engineering Practices

Working principles behind the detailed `.agents/rules/`, adapted from the
[Karpathy-inspired Claude Code guidelines](https://github.com/multica-ai/andrej-karpathy-skills).

- **Think before coding.** State assumptions and surface tradeoffs; do not silently pick one
  interpretation when several are defensible. When two organizations are equally valid, choose the
  one the canonical exemplar already uses (see [code-style.md](.agents/rules/code-style.md)).
- **Simplicity first.** Write the minimum code that solves the stated problem - no speculative
  features, no abstraction for single-use code, no configurability nobody asked for, no error
  handling for states that cannot occur. Ask whether a senior engineer would call it
  overcomplicated; if so, simplify.
- **Surgical changes.** Touch only what the task requires. Do not refactor working code or reformat
  adjacent lines, and match existing style even when you would write it differently. Remove only the
  imports and variables your own change made unused; report other dead code instead of deleting it.
  Every changed line should trace to the request.
- **Goal-driven execution.** Turn the task into a verifiable goal, then loop until `pnpm lint`,
  `pnpm typecheck`, and the tests covering the touched areas pass. Verify against the goal rather
  than declaring the work done.
- **Separate form, structure, and meaning.** FORM (import order, padding, type-imports) is owned by
  ESLint - run `pnpm lint --fix` and do not hand-tune it. STRUCTURE (declaration and body-section
  order) is deterministic and followed exactly. MEANING (semantic blank lines) is the small
  residual: mirror the nearest canonical exemplar, never invent a new rhythm. See
  [code-style.md](.agents/rules/code-style.md).
- **One responsibility per file.** Mirror the canonical exemplar for the file's category, validate
  every boundary with Zod, and keep `services/` pure (see
  [architecture.md](.agents/rules/architecture.md)).

## Architecture Reference

`docs/architecture/ARCHITECTURE.md` is the canonical technical reference for Remit. It documents
what the system is, the design philosophy, the domain model, module boundaries, security
architecture, and every significant architectural decision. Implementation plans and feature
decisions must align with the principles and decisions recorded there.

## Shared Rules

Detailed shared project rules live canonically in `.agents/rules/`:

- [.agents/rules/accessibility.md](.agents/rules/accessibility.md)
- [.agents/rules/actions.md](.agents/rules/actions.md)
- [.agents/rules/architecture.md](.agents/rules/architecture.md)
- [.agents/rules/auth.md](.agents/rules/auth.md)
- [.agents/rules/code-style.md](.agents/rules/code-style.md)
- [.agents/rules/components.md](.agents/rules/components.md)
- [.agents/rules/database.md](.agents/rules/database.md)
- [.agents/rules/errors.md](.agents/rules/errors.md)
- [.agents/rules/events.md](.agents/rules/events.md)
- [.agents/rules/forms.md](.agents/rules/forms.md)
- [.agents/rules/hooks.md](.agents/rules/hooks.md)
- [.agents/rules/i18n.md](.agents/rules/i18n.md)
- [.agents/rules/imports.md](.agents/rules/imports.md)
- [.agents/rules/money-and-dates.md](.agents/rules/money-and-dates.md)
- [.agents/rules/queries.md](.agents/rules/queries.md)
- [.agents/rules/routes.md](.agents/rules/routes.md)
- [.agents/rules/security.md](.agents/rules/security.md)
- [.agents/rules/testing.md](.agents/rules/testing.md)
- [.agents/rules/types.md](.agents/rules/types.md)

## Portable Workflows

Reusable workflows live in `.agents/skills/`. Use
[.agents/skills/git-commit/SKILL.md](.agents/skills/git-commit/SKILL.md) for repository commit and
commit-message work.

## Tool-Specific Files

- `CLAUDE.md` imports this file for Claude Code and keeps Claude-specific bootstrapping minimal.
- `.claude/` contains Claude-specific settings and command wrappers.
- `.codex/` contains Codex-specific configuration and command policy.
