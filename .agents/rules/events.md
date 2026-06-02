---
paths:
  - "features/**/events.ts"
  - "features/**/mutations.ts"
  - "lib/events/**"
---

# Event Bus Rules

## When to emit

Emit a domain event from a server action after all writes succeed and before returning `{ data }`.
Never emit before writes; a failed write must not trigger side effects.

```ts
// Good - emit after all writes succeed
await database.update(invoices).set({ status: "paid" }).where(eq(invoices.id, id))

await emit("invoice.paid", { invoiceId: id })

return { data: updated }

// Bad - emit before write; write may still fail
await emit("invoice.paid", { invoiceId: id })

await database.update(invoices).set({ status: "paid" }).where(eq(invoices.id, id))
```

## Event naming

Event names follow `<entity>.<past_tense_verb>`, lowercase, dot-separated. The entity is the domain
noun; the verb is what happened to it.

```ts
// Good
"invoice.paid"
"proposal.accepted"
"client.created"
"time.logged"

// Bad - present tense, wrong separator
"invoice.pay"
"invoice_paid"
"markInvoicePaid"
```

## Adding an event

Adding a new event requires two steps:

1. Extend `EventMap` in `lib/events/types.ts` with the event name and its payload type.
2. Call `emit()` in the relevant server action after all writes succeed.

The compiler rejects any `emit()` call whose event name or payload shape does not match the map.
Never use string literals for event names outside of `lib/events/types.ts`.

## Registering handlers

Handlers live in `features/<feature>/events.ts`. They register at module load time via `on()` from
`lib/events`. The file must be imported in the application bootstrap so that handlers register
before any request is handled.

```ts
// features/email/events.ts
import { on } from "@/lib/events"

import { sendPaymentReceiptEmail } from "./services/sendPaymentReceiptEmail"

on("invoice.paid", async ({ invoiceId }) => {
  await sendPaymentReceiptEmail(invoiceId)
})
```

## Handler rules

- Handlers are thin. They call a service or a query; no inline business logic.
- Handlers never throw. Wrap in try/catch, log the error with `logger.error`, and return. A failing
  handler must not break the action that emitted the event.
- Handlers do not call other `emit()`; cascading events create invisible chains that are hard to
  trace. If a handler needs to trigger further side effects, the original action emits both events.

```ts
// Good - thin, non-throwing handler
on("invoice.paid", async ({ invoiceId }) => {
  try {
    await sendPaymentReceiptEmail(invoiceId)
  } catch (error) {
    logger.error({ action: "email.invoice.paid", invoiceId, err: error }, "Receipt email failed")
  }
})

// Bad - business logic inline in handler
on("invoice.paid", async ({ invoiceId }) => {
  const invoice = await database.query.invoices.findFirst(...)

  if (invoice.totalCents > 100000) {
    // ... inline decision logic
  }
})
```

## What belongs in EventMap

Only events that cross feature boundaries. If the side effect is owned entirely by the same feature
as the emitter, call the service directly; no bus needed. The bus is for decoupling features, not
for wiring code within a single feature.

Do not use the event bus to hide ordinary same-feature orchestration or to compensate for a mutation
that has grown too much inline logic. Extract the logic to services first.
