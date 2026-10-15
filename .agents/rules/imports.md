# Import Rules

Import order and grouping are the FORM layer (`code-style.md`, "Form, structure, and meaning"):
ESLint owns them and `pnpm lint:fix` settles them. The source of truth is `importOrderRule` in
`eslint.config.mjs` (`perfectionist/sort-imports`, `newlinesBetween: 1`): one paragraph per group,
same group adjacent, a blank line whenever the group changes. Groups run, in order: React → Next
core (`next/cache`, `next/headers`, `next/navigation`, other `next/*`, each its own paragraph) →
Node builtins → external packages (one paragraph per package origin; generated from `package.json`)
→ `@/lib/i18n` → `@/lib/auth` → `@/lib/audit` → `@/lib/events` → `@/lib/logger` → `@/lib/utils` →
other `@/lib/*` → `@/database` → `@/components/ui` → `@/components/layout` → other `@/components` →
`@/features/*` (one paragraph per feature, generated from `features/`) → `@/hooks` → `@/providers` →
other `@/` → parent → sibling/index. Do not hand-order imports; run the fixer.

## What the linter does not decide

- **The form triad.** `@hookform/resolvers/zod` and `react-hook-form` share one paragraph (the one
  hardcoded multi-origin group), kept beside the local schema import they serve.
- **Type imports** use inline modifiers in the same statement
  (`import { Button, type ButtonProps } from "@/components/ui"`), never a separate `import type`
  statement unless a generated file does so (`@typescript-eslint/consistent-type-imports`).
- **Feature boundaries.** Cross-feature imports go only through a public door:
  `@/features/<feature>` (client-safe), `@/features/<feature>/server` (server-only),
  `@/features/<feature>/systemWrites` (session-free job writes), `@/features/<feature>/services` (a
  pure rule, when the barrels would drag components or `"use server"` modules into the graph).
  Enforced by `featureBoundaryRule`; see `architecture.md` ("Boundary rule"). Nearby accidental
  precedent is not a reason to reach into another feature's private file. Sibling files inside a
  feature import by direct relative path. Types from `@/database/schema` are shared substrate and
  may be imported directly.
- **Root folders use their barrel.** Every shared root folder (`components/`, `lib/utils/`,
  `hooks/`, `providers/`, `features/*`) has an `index.ts` and consumers import through it
  (`import { useIsMobile } from "@/hooks"`), never by direct file path. Files inside the folder
  import each other by direct relative path (`./useLocalStorage`), never through their own barrel,
  to avoid a self-cycle.
- **Generic helpers** come from their utility barrel (`import { getIpAddress } from "@/lib/utils"`).
  Never import from a feature just to reuse generic request, string, date or number normalization;
  move such a helper to `lib/utils/`.
- **Barrels** are plain `export` lists. UI and component-folder barrels are alphabetical
  (`perfectionist/sort-exports`). Feature barrels put components first, then schemas, types and
  services, with a blank line between sections. A feature root `index.ts` is client-safe;
  server-only exports belong in `server.ts`.
