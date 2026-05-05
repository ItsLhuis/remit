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
pnpm build              # Production build
pnpm start              # Start production server after build
pnpm lint               # ESLint check
pnpm lint:fix           # ESLint auto-fix
pnpm format             # Prettier
pnpm format:check       # Prettier check
pnpm typecheck          # TypeScript check (no emit)
pnpm database:generate  # Generate Drizzle migration from schema changes
pnpm database:migrate   # Apply pending migrations
pnpm database:studio    # Drizzle Studio UI
pnpm version:patch      # Bump app version patch
pnpm version:minor      # Bump app version minor
pnpm version:major      # Bump app version major
```

Node >=22.0.0. Package manager: pnpm. No test scripts are configured in `package.json` yet, even
though the architecture document defines the intended future test strategy.

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
- [.agents/rules/code-style.md](.agents/rules/code-style.md)
- [.agents/rules/components.md](.agents/rules/components.md)
- [.agents/rules/database.md](.agents/rules/database.md)
- [.agents/rules/errors.md](.agents/rules/errors.md)
- [.agents/rules/forms.md](.agents/rules/forms.md)
- [.agents/rules/hooks.md](.agents/rules/hooks.md)
- [.agents/rules/imports.md](.agents/rules/imports.md)
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
