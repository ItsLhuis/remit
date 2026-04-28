---
paths:
  - "features/**/mutations.ts"
  - "features/**/actions.ts"
  - "app/**/actions.ts"
---

# Server Action Rules

## File header

Every server action file begins with `"use server"` as the first line.

## Input validation

Always validate input with the Zod schema from the feature's `schemas.ts` using `safeParse`. Never
use `parse` - it throws. On failure, return the first issue message:

```ts
const parsed = createInvoiceSchema.safeParse(input)
if (!parsed.success) return { error: parsed.error.issues[0].message }
```

## Return type

The return type is always a discriminated union `{ data: T } | { error: string }`. Actions never
throw to the client. All errors, including unexpected ones, are caught and returned as `{ error }`.

```ts
// ✓
export async function createInvoice(input: unknown): Promise<{ data: Invoice } | { error: string }>

// ✗ - void return type with a throw leaks a stack trace to the client in development
export async function createInvoice(input: unknown): Promise<void>
```

## Revalidation

After every successful mutation, call `revalidatePath` or `revalidateTag` for every route and cache
tag that displays the mutated data. Place revalidation calls after all writes succeed and before
returning `{ data }`.

## Audit logging

Actions that are security-sensitive write an audit log entry before returning. Security-sensitive
actions include: any auth change (password, TOTP, sessions), settings that touch SMTP, Stripe, or
payment information, any deletion or export, and public token rotations. See
`docs/architecture/ARCHITECTURE.md` (Security Architecture) for the `audit_log` schema and required
fields (`actorUserId`, `targetEntityType`, `targetEntityId`, `metadata`, `ipAddress`, `userAgent`).

## Domain events

Emit a domain event on the typed event bus for any state transition that other features may want to
react to. Emit after all writes succeed. Event names follow `<entity>.<past_tense_verb>`:

- `invoice.paid`, `invoice.sent`, `invoice.overdue`
- `proposal.accepted`, `proposal.rejected`
- `time.logged`, `expense.created`

```ts
await emit("invoice.created", { invoiceId: created.id })
```

## Error handling

Raw database error messages are never exposed to the client. Known constraint violations (unique
violation, foreign key violation) map to user-friendly strings. Every unexpected error is logged
server-side with structured context (action name, relevant entity ids) and returns a generic
`"Something went wrong"` to the caller. See `errors.md` for the full error handling convention.

## Naming

Action names are verb + noun, present indicative: `createInvoice`, `markAsPaid`, `convertToInvoice`,
`deleteProject`. See `code-style.md`, Naming section, for the broader naming conventions used
throughout the codebase.

## Canonical example

```ts
"use server"

import { revalidatePath } from "next/cache"

import { eq } from "drizzle-orm"

import { database } from "@/database"
import { invoices } from "@/database/schema"

import { createInvoiceSchema } from "@/features/invoicing/schemas"
import { calculateInvoiceTotal } from "@/features/invoicing/services/calculateInvoiceTotal"
import { generateInvoiceNumber } from "@/features/invoicing/services/generateInvoiceNumber"

import { emit } from "@/lib/events"

import { type Invoice } from "@/features/invoicing"

export async function createInvoice(
  input: unknown
): Promise<{ data: Invoice } | { error: string }> {
  const parsed = createInvoiceSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const totals = calculateInvoiceTotal(parsed.data.lineItems)
  const number = await generateInvoiceNumber()

  let created: Invoice

  try {
    const [row] = await database
      .insert(invoices)
      .values({ ...parsed.data, ...totals, number, status: "draft" })
      .returning()

    if (!row) return { error: "Something went wrong" }

    created = row
  } catch (error) {
    console.error("createInvoice: insert failed", { projectId: parsed.data.projectId, error })

    return { error: "Something went wrong" }
  }

  await emit("invoice.created", { invoiceId: created.id })

  revalidatePath("/invoices")
  revalidatePath(`/projects/${created.projectId}`)

  return { data: created }
}
```
