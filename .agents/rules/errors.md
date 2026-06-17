---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# Error Handling Rules

## Server actions never throw

Server actions always return `{ data: T } | { error: string }`. Throwing is reserved for
unrecoverable boot-time failures, such as environment variable validation failure in
`lib/config/env.ts` or a missing encryption key at startup. Everything else is caught and returned
as `{ error }`.

```ts
import { t } from "@/lib/i18n/server"

import { logger } from "@/lib/logger"

// Good - unexpected failure caught and returned; error translated server-side
try {
  const [row] = await database.insert(invoices).values(data).returning()

  if (!row) return { error: t("errors.somethingWentWrong") }

  return { data: row }
} catch (error) {
  logger.error(
    { action: "createInvoice", projectId: data.projectId, err: error },
    "Invoice insert failed"
  )

  return { error: t("errors.somethingWentWrong") }
}

// Bad - throwing from a server action sends a stack trace to the client in development
// and an opaque error in production with no user-friendly message
throw new Error("Database insert failed")
```

## Toast usage

| Situation                          | Toast level     |
| ---------------------------------- | --------------- |
| Failure the user caused or can fix | `toast.error`   |
| Validation warning                 | `toast.warning` |
| Successful action confirmation     | `toast.success` |

Never use `toast.info` to communicate an error or failure state.

```ts
// Good
toast.error("Invoice not found")
toast.success("Invoice sent")

// Bad - info toast for an error state
toast.info("Could not send invoice")
```

## Error message style

Error message translation values are complete sentences, sentence case, and have no terminal period.
Use plain language; never expose internal identifiers, error codes, or stack information in
user-facing strings.

```ts
// Good - translation values in en.tsx
"Invoice not found"
"Email address is already in use"
"Something went wrong"

// Bad - wrong case, wrong punctuation, or internal detail leaked
"invoice not found."
"DUPLICATE_KEY_ERROR: users_email_unique"
"TypeError: Cannot read property 'id' of undefined"
```

## Server-side logging

In application server-side code, use `logger.error` from `@/lib/logger`. Always include structured
context with `action`, relevant ids (`userId`, `invoiceId`, `projectId`, `targetEntityId`, etc.)
when they exist, and `err` for the raw error. Never log sensitive data: passwords, tokens, API keys,
encryption keys, backup codes, or full secret strings.

```ts
import { logger } from "@/lib/logger"

// Good
logger.error(
  { action: "sendInvoiceEmail", invoiceId: invoice.id, err: error },
  "Email provider failed"
)

// Bad - secret embedded in log output
logger.error({ action: "sendInvoiceEmail", smtpPass: settings.smtpPass, err: error }, "SMTP failed")
```

## Database errors

Raw database errors never reach the client. Map known constraint violations to user-friendly
strings. Return a generic `"Something went wrong"` for everything else and log the original error
server-side.

Common cases to handle explicitly:

- Unique violation on `users.email` maps to `t("errors.emailAlreadyInUse")`.
- Foreign key violation maps to `t("errors.relatedRecordNotFound")`.
- Everything else maps to `t("errors.somethingWentWrong")` plus `logger.error` with structured
  context.

Do not create a shared database error mapper until the same constraint handling repeats with the
same translation keys and same return semantics across several actions. Otherwise keep the mapping
close to the action so feature-specific copy stays clear.

## Route error boundaries

Every route segment under `app/` that can fail must have a co-located `error.tsx` file. The error
boundary receives the error and renders a user-friendly message; it does not display the raw error
object.

## Form error surfacing

Field-level errors are surfaced through `FieldError` from `@/components/ui` with
`errors={[fieldState.error]}` (already required by `forms.md`). Submit-level errors from the server
action are stored in a local state variable and rendered in a `FieldError` placed above the submit
button, not in a toast.
