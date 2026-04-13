# CLAUDE.md

Remit is a self-hostable business management app for freelancers: Client → Project → Proposal →
Invoice. Stack: Next.js 16 App Router, React 19, TypeScript, Drizzle ORM (PostgreSQL), better-auth,
Tailwind CSS v4.

## Commands

```bash
pnpm dev                # Dev server (Turbopack)
pnpm build              # Production build
pnpm lint:fix           # ESLint auto-fix
pnpm format             # Prettier
pnpm typecheck          # TypeScript check (no emit)
pnpm database:generate  # Generate Drizzle migration from schema changes
pnpm database:migrate   # Apply pending migrations
pnpm database:studio    # Drizzle Studio UI
```

Node >=22.0.0. No tests configured yet.

## Directory map

- `app/` — Next.js App Router routes. Route groups: `(auth)` for login/setup, `(dashboard)` for the
  main app.
- `features/` — Domain feature modules. Each feature contains `components/` (with barrel `index.ts`)
  and `schemas.ts`. Import feature components externally via the barrel
  (`@/features/<name>/components`); internally use direct paths to avoid circular deps.
- `components/` — Shared UI and layout primitives. `ui/` exported via `components/ui/index.ts`;
  `layout/` via `components/layout/index.ts`.
- `database/` — Drizzle ORM. Schemas in `database/schema/` (one file per domain, barrel at
  `database/schema/index.ts`). Never edit files in `drizzle/migrations/` manually.
- `lib/` — Server and client utilities. `lib/auth.ts` — better-auth server config;
  `lib/authClient.ts` — client exports (`authClient`, `signOut`, `useSession`).
- `hooks/` — Shared React hooks.

## Hard rules

NEVER read `.env` or `.env.*`. NEVER run `pnpm database:migrate` without confirming the target
environment first. NEVER force-push `main`. Pre-push hook runs `pnpm typecheck` — all type errors
must be resolved before pushing.

## Rules

@.claude/rules/code-style.md @.claude/rules/components.md @.claude/rules/forms.md
@.claude/rules/database.md @.claude/rules/hooks.md @.claude/rules/types.md
