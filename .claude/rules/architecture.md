---
paths:
  - "features/**/*.ts"
  - "features/**/*.tsx"
  - "app/**/*.ts"
  - "app/**/*.tsx"
  - "lib/**/*.ts"
---

# Architecture Rules

## Feature module shape

Each feature lives under `features/<feature>/` and is a closed module. One-line responsibility per
file:

- `components/` - React UI for this feature; exported via a barrel `index.ts`.
- `hooks/` - Feature-scoped hooks (see `hooks.md`).
- `services/` - Pure business logic; no framework or IO imports (see Purity rule below).
- `queries.ts` - Read operations via Drizzle; server-only.
- `mutations.ts` - Write operations (server actions); server-only.
- `schemas.ts` - Zod schemas and their inferred types (see `forms.md`).
- `types.ts` - Public types of the module not derivable from schemas.
- `events.ts` - Event subscriptions and emissions for this feature.
- `index.ts` - Public barrel; re-exports only what other features may consume.

Not every feature needs every file - add only what the feature requires.

## Boundary rule

`features/A` may only import from `features/B` via `features/B/index.ts`. Sibling files inside a
feature import by direct path to avoid circular dependencies.

This rule applies to code imports. Types from `database/schema` are the shared data substrate and
may be imported directly by any feature. This boundary is enforced by ESLint
(`eslint-plugin-boundaries` / `no-restricted-paths`).

```ts
// ✗ - imports directly from a sibling file inside another feature
import { proposalLineItemSchema } from "@/features/proposals/schemas"

// ✓ - imports via the feature's public barrel
import { type ProposalLineItem } from "@/features/proposals"

// ✓ - database schema types are shared substrate; direct import is fine
import { type Invoice } from "@/database/schema"
```

## Purity rule for `services/`

Every non-trivial calculation, state transition, validation, or transformation lives in
`features/<feature>/services/` as a pure function. These functions never import from `next/*`,
`react`, `drizzle-orm/*`, `@/database`, or any IO module.

Why: millisecond-level Vitest runs without mocking, refactor confidence when the ORM or framework
changes, and a clean extraction path to `packages/core` when the project becomes a monorepo.

```ts
// ✓ - pure: depends only on its arguments and other pure functions
export function calculateInvoiceTotal(lineItems: LineItem[]): InvoiceTotals {
  const subtotalCents = lineItems.reduce(
    (accumulator, item) => accumulator + item.quantity * item.unitPriceCents,
    0
  )
  const taxCents = lineItems.reduce(
    (accumulator, item) =>
      accumulator + Math.round(item.quantity * item.unitPriceCents * (item.taxRate / 100)),
    0
  )

  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents }
}

// ✗ - imports from Drizzle; no longer pure or trivially testable
import { eq } from "drizzle-orm"

import { database } from "@/database"
import { lineItems } from "@/database/schema"

export async function calculateInvoiceTotal(invoiceId: string) {
  const items = await database.query.lineItems.findMany({
    where: eq(lineItems.invoiceId, invoiceId)
  })
  // ...
}
```

## Work placement

| Work kind                                     | File                           |
| --------------------------------------------- | ------------------------------ |
| Read a record or list                         | `queries.ts`                   |
| Write, create, update, delete                 | `mutations.ts` (server action) |
| Business logic, calculation, state transition | `services/<name>.ts`           |
| Input shape and validation                    | `schemas.ts`                   |
| Public types consumed by other features       | `types.ts` or `index.ts`       |
| Cross-feature event wiring                    | `events.ts`                    |

## Thin orchestrators

Server actions in `mutations.ts` and read functions in `queries.ts` are thin orchestrators. They
validate input with Zod, call into `services/` for business logic, and use Drizzle for persistence.
They do not contain branching business logic.

```ts
// ✓ - server action delegates logic to a service
export async function markInvoicePaid(
  input: unknown
): Promise<{ data: Invoice } | { error: string }> {
  const parsed = markInvoicePaidSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const transition = canTransitionInvoiceStatus(parsed.data.currentStatus, "paid")

  if (!transition.allowed) return { error: transition.reason }

  const [updated] = await database
    .update(invoices)
    .set({ status: "paid", paidAt: new Date() })
    .where(eq(invoices.id, parsed.data.invoiceId))
    .returning()

  if (!updated) return { error: "Invoice not found" }

  return { data: updated }
}

// ✗ - orchestrator contains status-transition logic that belongs in services/
export async function markInvoicePaid(input: unknown) {
  const parsed = markInvoicePaidSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  if (parsed.data.currentStatus === "draft") return { error: "Cannot pay a draft invoice" }
  if (parsed.data.currentStatus === "paid") return { error: "Invoice is already paid" }
  if (parsed.data.currentStatus === "cancelled") return { error: "Cannot pay a cancelled invoice" }
  // ... more business rules leaking out of services/
}
```

## Zod at every boundary

Every server action, public endpoint, and settings read validates input with Zod `safeParse`.
Environment variables are validated at boot in `lib/env.ts` and the process exits on failure. See
`types.md` for the bans on `any` and non-null assertions that reinforce this at the type level.
