# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

## About

Remit is an open-source, self-hostable business management platform for freelancers and small
businesses built with Next.js 16, React 19, TypeScript, and Tailwind CSS v4. Core workflow: Client →
Project → Proposal → Invoice.

## Commands

```bash
pnpm dev          # Start dev server with Turbopack
pnpm build        # Production build
pnpm lint         # ESLint check
pnpm lint:fix     # ESLint auto-fix
pnpm format       # Prettier format all files
pnpm format:check # Check formatting without writing
pnpm typecheck    # TypeScript type check (no emit)
```

There are no tests configured yet. Node >=22.0.0 is required.

## Architecture

This is a Next.js App Router project in early stages — currently a scaffold with minimal pages.

**Directory structure:**

- `app/` — Next.js App Router pages and layouts. `layout.tsx` wraps everything in `ThemeProvider`.
- `components/ui/` — Reusable UI primitives (shadcn/ui style). Export via `components/ui/index.ts`.
- `providers/` — React context providers. `ThemeProvider` wraps `next-themes` and adds a `d` hotkey
  to toggle dark/light mode.
- `lib/utils.ts` — `cn()` utility (clsx + tailwind-merge).
- `hooks/` — Custom React hooks (currently empty).
- `scripts/` — Dev tooling (e.g., `bump-version.ts` for semver bumps via
  `pnpm version:patch/minor/major`).

**Styling:** Tailwind CSS v4 with CSS variables for theming. Colors use `oklch`. Design tokens are
defined in `app/globals.css` under `:root` and `.dark`. Dark mode uses the `dark` class strategy.

**Components:** shadcn/ui using `radix-nova` style. Components are built on `radix-ui` primitives
with `class-variance-authority` for variants. Use `Slot.Root` from `radix-ui` for `asChild` pattern.
Add new components with `pnpm shadcn add <component>`.

**Path aliases:** `@/*` maps to the project root (e.g., `@/components/ui`, `@/lib/utils`).

## Code Style

- No semicolons, double quotes, 2-space indent, 100 char print width (enforced by Prettier).
- Trailing commas disabled.
- Commits must follow Conventional Commits:
  `feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert`. Max header length 100 chars.
- Pre-commit hook runs ESLint + Prettier on staged files via lint-staged.
