---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# Import Rules

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

## Typical ordering

Use this as a default, then let the nearest local precedent win:

1. React imports, after `"use client"` when present.
2. Next.js imports that are fundamental to the component or route.
3. External packages that form a cohesive concern.
4. Internal services/utilities, grouped by role rather than alphabetically.
5. Database imports when the file performs data access.
6. Feature imports.
7. Relative imports for sibling components, local schemas, local services, and local types.
8. Side-effect imports such as CSS at the end of the import block.

Ordering is contextual, not strictly alphabetical. For example, a form component commonly keeps the
resolver, `Controller`/`useForm`, and its schema together even though that mixes external and
relative imports:

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
