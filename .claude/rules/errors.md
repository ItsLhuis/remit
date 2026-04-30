---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# Error Handling Rules

## Server actions never throw

Server actions always return `{ data: T } | { error: string }`. Throwing is reserved for
unrecoverable boot-time failures - environment variable validation failure in `lib/env.ts` or a
missing encryption key at startup. Everything else is caught and returned as `{ error }`.

```ts
// ✓ - unexpected failure caught and returned
try {
  const [row] = await database.insert(invoices).values(data).returning()

  if (!row) return { error: "Something went wrong" }

  return { data: row }
} catch (error) {
  console.error("createInvoice: insert failed", { projectId: data.projectId, error })

  return { error: "Something went wrong" }
}

// ✗ - throwing from a server action sends a stack trace to the client in development
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
// ✓
toast.error("Invoice not found")
toast.success("Invoice sent")

// ✗ - info toast for an error state
toast.info("Could not send invoice")
```

## Error message style

Error messages are complete sentences, sentence case, and have no terminal period. Use plain
language; never expose internal identifiers, error codes, or stack information in user-facing
strings.

```ts
// ✓
"Invoice not found"
"Email address is already in use"
"Something went wrong"

// ✗ - wrong case, wrong punctuation, or internal detail leaked
"invoice not found."
"DUPLICATE_KEY_ERROR: users_email_unique"
"TypeError: Cannot read property 'id' of undefined"
```

## Server-side logging

Use `console.error` with a structured context object. Always include the action or function name and
the relevant entity ids. Never log sensitive data: passwords, tokens, API keys, encryption keys, or
full secret strings.

This will migrate to `pino` with structured JSON output per `docs/architecture/ARCHITECTURE.md`
(Observability). Write `console.error` now; the migration will be mechanical.

```ts
// ✓
console.error("sendInvoiceEmail: provider failed", {
  invoiceId: invoice.id,
  provider: settings.emailProvider,
  error
})

// ✗ - secret embedded in log output
console.error("SMTP failed", { smtpPass: settings.smtpPass, error })
```

## Database errors

Raw database errors never reach the client. Map known constraint violations to user-friendly
strings. Return a generic `"Something went wrong"` for everything else and log the original error
server-side.

Common cases to handle explicitly:

- Unique violation on `users.email` → `"Email address is already in use"`
- Foreign key violation → `"Related record not found"`
- Everything else → `"Something went wrong"` + `console.error` with context

## Route error boundaries

Every route segment under `app/` that can fail must have a co-located `error.tsx` file. The error
boundary receives the error and renders a user-friendly message - it does not display the raw error
object.

## Form error surfacing

Field-level errors are surfaced through `FieldError` from `@/components/ui` with
`errors={[fieldState.error]}` (already required by `forms.md`). Submit-level errors from the server
action are stored in a local state variable and rendered in a `FieldError` placed above the submit
button, not in a toast.
