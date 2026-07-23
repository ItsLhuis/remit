---
paths:
  - "features/**/*.ts"
  - "features/**/*.tsx"
  - "app/**/*.ts"
  - "app/**/*.tsx"
  - "lib/**/*.ts"
---

# Architecture Rules

## Pre-work modularity check

Before adding a feature, service, mutation, query, hook, component, schema, or utility, climb down
this ladder and stop at the first rung that solves the task — the cheapest code is the code you do
not write:

1. Does this need to exist at all? If the task does not require it, do not write it (YAGNI).
2. Does the standard library already do it? Use it.
3. Is there a native platform feature (Next.js, React, the web platform, PostgreSQL, Drizzle, Zod)
   that already does it? Use it.
4. Can an already-installed dependency do it? Reuse it before reaching for a new one.
5. Can it be one line? Keep it one line.
6. Only then write the minimum that works.

Lazy is not negligent: never trade away trust-boundary validation, error handling, data-loss safety,
security, or accessibility for brevity. Inputs are always validated with Zod; see
[security.md](security.md), [errors.md](errors.md), and [accessibility.md](accessibility.md).

If you do write it, place it correctly:

1. Inspect the nearest comparable file in the same feature and layer.
2. Search for an existing helper in `lib/utils/`, `lib/`, `hooks/`, `components/ui/`, and the
   relevant feature barrel.
3. Decide whether the code is domain logic, IO orchestration, UI composition, validation, or generic
   infrastructure.
4. Put the code in the narrowest correct layer.
5. Do not create a new abstraction unless the repeated behavior is identical enough to share safely.

The restructuring report identified generic request metadata parsing as the kind of helper that must
not live inside feature mutations. Similar future helpers for request, string, date, number, URL, or
object normalization belong in `lib/utils/`.

## Feature module shape

Each feature lives under `features/<feature>/` and is a closed module. One-line responsibility per
file:

- `components/` - React UI for this feature; exported via a barrel `index.ts`. Admits components and
  module-private contracts only (see `components.md`).
- `hooks/` - Feature-scoped hooks (see `hooks.md`).
- `services/` - Pure business logic; no framework or IO imports.
- `engine/` - The canvas editor's pointer runtime: its gesture machinery, the React hooks that drive
  it, its module-level stores, and the overlay components it owns. It exists because that runtime is
  one cohesive unit ([ADR 0024](../../docs/architecture/adr/0024-template-editor-canvas.md)) that
  splits across `services/`, `hooks/`, and `components/` without belonging to any of them. It is not
  a general-purpose kind: `features/templates/` is the only feature that has one, and another
  feature should not copy it without an equally strong reason.
- `labels.ts` - Maps domain values to translation keys, icon names, and badge variants.
- `queries.ts` - Read operations via Drizzle; server-only.
- `mutations.ts` - Write operations (server actions); server-only.
- `schemas.ts` - Zod schemas and their inferred types.
- `types.ts` - Public types of the module not derivable from schemas.
- `events.ts` - Event subscriptions and emissions for this feature.
- `index.ts` - Public client-safe barrel; re-exports only components, schemas, types, and other code
  safe for client graphs.
- `server.ts` - Optional public server-only barrel; re-exports queries and other server-only
  entrypoints that may import `@/database`, `next/headers`, auth server APIs, or other IO/server
  modules.

Not every feature needs every file. Add only what the feature requires now.

## Boundary rule

`features/A` may only import from `features/B` via `features/B/index.ts` for client-safe code, or
`features/B/server.ts` for server-only code. Never export database/auth/server-only code from
`index.ts`. Sibling files inside a feature import by direct path to avoid circular dependencies.

This rule applies to code imports. Types from `database/schema` are the shared data substrate and
may be imported directly by any feature. This boundary is enforced by ESLint
(`eslint-plugin-boundaries` / `no-restricted-paths`).

```ts
// Bad - imports directly from a sibling file inside another feature
import { proposalLineItemSchema } from "@/features/proposals/schemas"

// Good - imports via the feature's public barrel
import { type ProposalLineItem } from "@/features/proposals"

// Good - database schema types are shared substrate; direct import is fine
import { type Invoice } from "@/database/schema"
```

## Purity rule for `services/`

Every non-trivial calculation, state transition, validation, or transformation lives in
`features/<feature>/services/` as a pure function. These functions never import from `next/*`,
`react`, `drizzle-orm/*`, `@/database`, `next/headers`, `@/lib/auth`, `@/lib/logger`, storage
clients, email clients, payment SDKs, or any IO module.

Services receive all data as arguments and return all data as return values. They do not read the
session, headers, environment, database, request state, or global mutable state.

Why: millisecond-level Vitest runs without mocking, refactor confidence when the ORM or framework
changes, and a clean extraction path to `packages/core` when the project becomes a monorepo.

```ts
// Good - pure: depends only on its arguments and other pure functions
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

// Bad - imports from Drizzle and the database; no longer pure or trivially testable
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
| Generic request/string/date/number helper     | `lib/utils/<name>.ts`          |
| Shared UI primitive                           | `components/ui/<Name>.tsx`     |

## Thin orchestrators

Server actions in `mutations.ts` and read functions in `queries.ts` are thin orchestrators. They
validate input with Zod, call into `services/` for business logic, and use Drizzle for persistence.
They do not contain branching business logic.

```ts
// Good - server action delegates logic to a service
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

// Bad - orchestrator contains status-transition logic that belongs in services/
export async function markInvoicePaid(input: unknown) {
  const parsed = markInvoicePaidSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  if (parsed.data.currentStatus === "draft") return { error: "Cannot pay a draft invoice" }
  if (parsed.data.currentStatus === "paid") return { error: "Invoice is already paid" }
  if (parsed.data.currentStatus === "cancelled") return { error: "Cannot pay a cancelled invoice" }
}
```

## Shared helper placement

Cross-feature infrastructure helpers belong in `lib/`, usually under `lib/utils/`. Feature-specific
write plans and persistence details stay inside their feature until signatures and behavior are
identical.

Use `lib/utils/` for generic helpers such as:

- Request metadata parsing.
- String normalization.
- Date normalization.
- Number normalization.
- URL-safe formatting.
- Object filtering.

Do not add local helpers for generic request, string, date, or number normalization when an
equivalent exists under `lib/utils/`.

## Abstraction threshold

Extract shared logic only when the behavior is identical, the call sites need the same inputs, the
return shape is stable, and the error behavior is the same.

Do not extract when:

- Return columns differ.
- No-op behavior differs.
- Translation keys or field semantics differ.
- Rollback or cleanup semantics differ.
- Generic Drizzle typing makes call sites harder to read.
- The only shared part is incidental setup around otherwise different operations.

Specific guidance from the restructuring report:

- Settings write guards repeat session, owner-role, and audit setup, but should not be generalized
  until the helper design is deliberate and signatures are stable.
- Settings upsert helpers are similar but differ in return columns, no-op behavior, and error
  messages; do not force a generic helper yet.
- `getChangedFields` can be shared only if comparable value unions and behavior are aligned.
- `emptyToNull` can be shared only after deciding whether trimming and `string | null` inputs are
  part of the canonical contract.
- Upload cleanup patterns can be shared only if log names, rollback behavior, and old/new cleanup
  semantics match.
- Zod fragments can be shared only when validation messages and field semantics match.
- Password rule refinements can be extracted only through a schema factory that preserves
  flow-specific translation keys and field names.

## Zod at every boundary

Every server action, public endpoint, and settings read validates input with Zod `safeParse`.
Environment variables are validated at boot in `lib/config/env.ts` and the process exits on failure.
See `types.md` for the bans on `any` and non-null assertions that reinforce this at the type level.

No data crosses a trust boundary unvalidated.

## Adding an environment variable

Environment variables are defined once in the Zod schema in `lib/config/env.ts` and consumed through
the exported `env` object. Application code reads `env`; it does not read `process.env` directly.

1. Add the variable to the schema in `lib/config/env.ts`. Client-exposed variables use the
   `NEXT_PUBLIC_` prefix; optional variables use the `optionalEnvString` helper so blank values
   become `undefined`.
2. Document it in `.env.example` with a safe placeholder value, never a real secret.

Required secrets additionally follow `security.md`: validated here, never logged, and never returned
in a response.
