---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# Import Rules

Import order and grouping are the FORM layer described in `code-style.md` ("Form, structure, and
meaning"): ESLint owns them and `pnpm lint --fix` settles them. This file documents what the
formatter enforces and the few judgment calls it leaves.

## Import rhythm

Imports follow the local file's visual rhythm more than a universal package-category sort. Before
adding imports, inspect the nearest comparable file in the same folder or feature and mirror its
header shape.

The dominant style is one conceptual group per paragraph, separated by a blank line. A group may be
a single import. Keep imports adjacent only when they form one local context:

- Multiple imports from the same ecosystem, such as `@hookform/resolvers/zod`, `react-hook-form`,
  and the local form schema.
- Database imports, such as `database` and the schema tables used by the query or mutation.
- UI primitive imports from `@/components/ui`.
- Sibling components from the same folder.
- Related relative schema/helper imports from the same feature layer.

Do not collapse unrelated internal imports into one large `@/` block. In this codebase,
`@/lib/i18n`, `@/lib/auth`, `@/lib/logger`, `@/database`, `@/lib/utils`, hooks, UI, and feature
imports are often visually separated because they play different roles.

## Group order

Imports follow this group order, each group its own paragraph separated by a blank line:

1. `"use server"` / `"use client"` directive.
2. React (`react`), after the directive.
3. Next core (`next/cache`, `next/headers`, `next/navigation`, `next/server`) — each its own
   paragraph.
4. Node builtins (`node:crypto`, `node:path`, `fs`, …) as one paragraph, separated from external npm
   packages.
5. External npm packages, **one paragraph per package origin** — the scope for `@scope/x`, the bare
   package name otherwise. Same-origin imports stay together (`@aws-sdk/client-s3` +
   `@aws-sdk/s3-request-presigner`); different origins are separated by a blank line. The form triad
   (`@hookform/resolvers/zod` + `react-hook-form`) is the one sanctioned multi-origin paragraph.
6. `@/lib/i18n` (translation).
7. `@/lib/auth`, `@/lib/audit`, `@/lib/events`, `@/lib/logger` — each role its own paragraph.
8. `@/lib/utils`.
9. `@/database` + `@/database/schema` (adjacent).
10. `@/components/ui`, then `@/components/layout`, then other `@/components`.
11. `@/features/*` (cross-feature public/server barrels), **one paragraph per feature** —
    same-feature imports stay together (`@/features/clients` root barrel +
    `@/features/clients/server`); different features are separated by a blank line.
12. `@/hooks`, then `@/providers` — each its own paragraph.
13. Other `@/` internal imports (e.g. `@/package.json`) as their own paragraph.
14. Relative imports: parent (`../*`), then sibling/index (`./events`, `./queries`, `./schemas`,
    `./types`) last.

## Same group adjacent, different group separated

The mechanical rule behind the order: imports from the **same group sit together with no blank line
between them**; the moment the group changes, **exactly one blank line** separates them. A group may
be a single import. This is enforced by `perfectionist/sort-imports` (`newlinesBetween: 1`), which
collapses blank lines inside a group and inserts one between groups — both directions are
auto-fixable.

Concretely: Node builtins and external npm packages are different "sides" and never share a
paragraph (`node:crypto` is not lumped with `@aws-sdk/*` or `chalk`); two different external origins
such as `@tanstack/react-hotkeys` and `next-themes` each get their own paragraph, while same-origin
imports such as `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` stay together; two
different features such as `@/features/clients/server` and `@/features/projects/server` each get
their own paragraph, while a feature's root barrel and its `/server` barrel stay together;
`@/features/*` and a bare `@/` import such as `@/package.json` are different groups and carry a
blank line between them.

The per-origin external groups are generated from `package.json` in `eslint.config.mjs`, and the
per-feature groups are generated from the `features/` directory, so a new dependency or feature is
separated automatically with no config edit. The form triad is the single hardcoded exception that
keeps `@hookform/resolvers/*` and `react-hook-form` in one paragraph.

Where two files of the same role disagree, the canonical exemplar (`code-style.md`) wins, not the
nearest neighbor. The only sanctioned adjacency exception is the form triad
(`@hookform/resolvers/zod` + `react-hook-form` + the local schema kept together), which mixes
external and relative imports on purpose:

```tsx
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { loginSchema, type LoginValues } from "../../schemas"
```

Server modules often keep server primitives, translation/auth/logging, then database, then shared
utilities, then local feature code:

```ts
import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"

import { logger } from "@/lib/logger"

import { database } from "@/database"
import { settings } from "@/database/schema"

import { getIpAddress } from "@/lib/utils"

import { changeEmailSchema } from "./schemas"
```

## Internal import separation

Separated internal imports are intentional when the roles differ:

```ts
import { useTranslation } from "@/lib/i18n"

import { authClient } from "@/lib/auth/client"
```

Keep internal imports adjacent when they are one layer or one consumer-facing surface:

```ts
import { SidebarInset, SidebarProvider } from "@/components/ui"

import { AppHeader, AppSidebar } from "@/components/layout"
```

```ts
import { database } from "@/database"
import { settings } from "@/database/schema"
```

## Type imports

Use inline `type` modifiers in the same import statement. Do not create a separate
`import type { ... }` statement unless a tool-generated file already does so and local precedent
requires it.

```ts
import { type ReactNode } from "react"
import { Button, type ButtonProps } from "@/components/ui"
```

## Feature boundaries

Sibling files inside the same feature may import by direct relative path or direct feature-local
path, following the surrounding files.

Cross-feature imports use:

- `@/features/<feature>` for client-safe public exports.
- `@/features/<feature>/server` for server-only public exports.

```ts
import { isEmailConfigured } from "@/features/settings"
import { getInvoiceForEmail } from "@/features/invoicing/server"
```

Do not reach into another feature's private component/service/schema/query/mutation file unless the
architecture has been deliberately changed. Nearby accidental precedent is not enough to copy a
private cross-feature import.

Database schema types remain shared substrate and may be imported directly from `@/database/schema`.

## Shared utilities

Generic utilities are imported from their public utility barrel when one exists:

```ts
import { getIpAddress } from "@/lib/utils"
```

Do not import from a feature just to reuse generic request, string, date, or number normalization.
If that helper is generic, move it to `lib/utils/`.

## Barrel files

Barrels are simple `export` lists with no extra spacing inside a contiguous section. UI barrels are
alphabetical. Feature barrels often put component exports first, then schema/types/service exports,
with a blank line between sections. Small folder barrels usually export the folder's public entry
component only.

Feature root `index.ts` is client-safe. Server-only exports belong in `server.ts`.

## Root utility folders use a barrel

Every shared root folder carries an `index.ts` barrel and is imported through it, with no
exceptions. `hooks/` and `providers/` follow the same rule as `components/`, `lib/utils/`, and
`features/*`: barrel present, consumers import through it.

```ts
// Good - import through the folder barrel
import { useScroll } from "@/hooks"

import { AppearanceProvider } from "@/providers"

// Bad - direct file path bypasses the barrel
import { useScroll } from "@/hooks/useScroll"
```

The barrel uses `export * from "./X"`, alphabetized. Sibling files inside the folder import each
other by direct relative path (`./useLocalStorage`), never through their own barrel, to avoid a
self-cycle.
