---
paths:
  - "features/**/mutations.ts"
  - "features/**/actions.ts"
  - "app/**/actions.ts"
---

# Server Action Rules

## File header and imports

Server action files begin with `"use server"` as the first line, followed by a blank line and the
imports. Preserve the repository's import rhythm: Next server utilities first, then translation,
auth/config/logger concerns, then database imports, then local schemas or helpers.

```ts
"use server"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"

import { logger } from "@/lib/logger"

import { database } from "@/database"
import { uploads } from "@/database/schema"

import { confirmAvatarUploadSchema } from "./schemas"
```

## Public action shape

Export server actions directly as named `async function` declarations. Keep private helper types and
helper functions below the public action when they only support that action.

```ts
export async function confirmAvatarUpload(
  input: unknown
): Promise<{ data: { storageKey: string } } | { error: string }> {
  // ...
}
```

Return type is `{ data: T } | { error: string }`. Actions do not throw expected user-facing errors
to the client.

## Validation and authorization order

Validate with the feature's Zod schema using `safeParse`. Return the first issue message on failure:

```ts
const parsed = confirmAvatarUploadSchema.safeParse(input)

if (!parsed.success) return { error: parsed.error.issues[0].message }
```

Authorization/session reads may appear before or after validation depending on what the action needs
first. Follow nearby actions in the same feature. Reused headers are named `requestHeaders`.

```ts
const requestHeaders = await headers()

const session = await auth.api.getSession({ headers: requestHeaders })

if (!session) return { error: t("errors.unauthorized") }
```

## Logic and error handling

Use straight-line action logic with early returns:

1. Read request/session context.
2. Validate input.
3. Destructure or normalize `parsed.data`.
4. Perform writes inside `try` when failures need logging.
5. Log unexpected failures with `logger.error` and structured context.
6. Revalidate paths after successful writes.
7. Return `{ data }` last.

Keep `try` blocks focused around the IO that can fail. Do not expose raw database, provider, or auth
errors to the client.

```ts
try {
  await database.insert(uploads).values({
    filename: parsed.data.filename,
    path: parsed.data.objectKey,
    mimeType: parsed.data.mimeType,
    sizeBytes: parsed.data.sizeBytes
  })
} catch (error) {
  logger.error(
    {
      action: "confirmAvatarUpload",
      userId: session.user.id,
      objectKey: parsed.data.objectKey,
      err: error
    },
    "Avatar upload confirmation failed"
  )

  return { error: t("settings.profile.errors.avatarUpdateFailed") }
}
```

## Revalidation

Call `revalidatePath` after all writes succeed and before the final success return. Keep multiple
revalidation calls as adjacent statements.

```ts
revalidatePath("/setup")
revalidatePath("/")

return { data: { success: true } }
```

## Audit logging and domain events

When an action is security-sensitive or emits domain state changes, keep audit/event work after the
write succeeds and before revalidation/final return. Use the existing event and audit helpers for
that feature. Do not add broad event plumbing just to satisfy a generic pattern.

## Naming

Action names are verb phrases that describe the user operation: `saveBusinessProfile`,
`changeEmailAddress`, `confirmAvatarUpload`. Client-side callers store the action return in `result`
and branch on `"error" in result` when the action uses the discriminated union shape.
