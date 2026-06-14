---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# Code Style Rules

## Canonical exemplar first, then nearest local file

"Local precedent" no longer means "the nearest file." Each file category has one canonical exemplar.
Match the exemplar for its category, then fall back to the nearest comparable file in the same
feature and layer for anything the exemplar does not cover. Where two files of the same role
disagree, the canonical exemplar wins, not the nearest neighbor.

| Category                         | Canonical exemplar                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `*Page` (server, foldered)       | `features/settings/business/components/BusinessSettingsPage/BusinessSettingsPage.tsx`    |
| Form component                   | `features/clients/components/ClientForm/ClientForm.tsx` (returns/structure) + `forms.md` |
| Dialog                           | `features/settings/security/components/TotpReconfigureDialog/`                           |
| List/table page                  | `features/clients/components/ClientsListPage/ClientsListPage.tsx`                        |
| `mutations.ts`                   | `features/settings/business/mutations.ts`                                                |
| `queries.ts`                     | `features/clients/queries.ts`                                                            |
| `schemas.ts`                     | `features/clients/schemas.ts`                                                            |
| `services/*.ts`                  | `features/clients/services/clientHealth.ts`                                              |
| `services/__tests__/*`           | `features/clients/services/__tests__/clientHealth.test.ts`                               |
| feature `index.ts` / `server.ts` | `features/clients/index.ts` / `features/clients/server.ts`                               |
| component barrel                 | any settings `components/index.ts` (`export * from "./X"`)                               |

Match the exemplar for: import grouping and blank lines, whether a component is a compact expression
body or a block with `return`, whether helpers sit before or after the component, barrel export
order, and how many blank lines separate hooks and derived values.

Barrels use `export * from "./X"` in component folders, alphabetized. Feature root `index.ts` may
use curated named groups (components first, then schemas, then types) and is client-safe;
server-only exports go in `server.ts`.

The canonical exemplar does not override architecture boundaries. Do not copy a local helper when
the helper is generic infrastructure and belongs in `lib/utils/`.

## File-level organization

Use directives first, then imports:

```ts
"use server"

import { revalidatePath } from "next/cache"
```

```tsx
"use client"

import { useState } from "react"
```

After imports, files usually follow this order:

1. File-private constants and variant definitions that support the public export.
2. File-private types for props, options, rows, configs, and result objects.
3. The main exported function/component when it is the file's public API.
4. Private helpers below the public API when they exist only to support that API.
5. Bottom named export blocks for components and UI primitives.

This ordering applies to non-component `.ts` files. In `.tsx` component files the rule inverts:
file-private `function` helpers go **above** the component, immediately after the imports — see
`components.md` ("File-private helpers in `.tsx`").

There are layer-specific exceptions:

- App route files export `metadata`, `dynamic`, HTTP handlers, or default page/layout components in
  the order expected by Next.js.
- Schema files export each `schema` immediately followed by its inferred `Values` type.
- Pure service files may export several small named functions directly, especially when each
  function is the public API.
- Large configuration files define constants and inline callback helpers first, then private helper
  functions after the exported config object.

## Helper discipline

Do not add local helpers for generic request, string, date, number, URL, or object normalization
when an equivalent exists under `lib/utils/`.

When a generic helper is needed in more than one feature, put it in a focused file under
`lib/utils/` and export it from `lib/utils/index.ts`.

When similar helpers differ in trimming behavior, null handling, return shape, translation keys,
database return columns, rollback behavior, or error messages, keep them local until a deliberate
shared contract exists.

Request metadata parsing is the canonical example: `x-forwarded-for` and `x-real-ip` parsing lives
in `getIpAddress(headers)` under `lib/utils/request.ts`, not in mutations or routes.

## React component body structure

Component bodies are grouped by concern, not by a rigid hook-type order. The common sequence is:

1. Translation hook first when present: `const { t } = useTranslation()`.
2. Router/path/session/context hooks near the top, in the order the component reads conceptually.
3. Local state for UI or server errors.
4. Form setup with `useForm`, followed immediately by
   `const { isSubmitting, isDirty, isValid } = form.formState` when needed.
5. Custom hooks and refs near the values they support.
6. Derived values and computed booleans after hooks.
7. Event handlers and submit handlers.
8. Effect or hotkey registration when it reads handlers/state.
9. Guard returns, then the JSX return.

Do not insert blank lines between every hook mechanically. Related state values can stay together:

```tsx
const [authError, setAuthError] = useState<string | null>(null)
const [requiresTwoFactor, setRequiresTwoFactor] = useState(false)
```

Separate different concerns with a blank line:

```tsx
const { t } = useTranslation()

const router = useRouter()

const form = useForm<LoginValues>({
  resolver: zodResolver(loginSchema),
  mode: "onSubmit",
  defaultValues: { email: "", password: "" }
})

const { isSubmitting, isDirty, isValid } = form.formState
```

Computed UI flags are declared after the hooks/data they depend on and before handlers:

```tsx
const isCollapsed = state === "collapsed"

const user = session?.user
const initials = user?.name ? getInitials(user.name) : "?"
```

## Function and logic structure

Prefer early returns, including compact one-line guards when the body is trivial:

```ts
if (!settings) return false
if (response.ok) return
```

Use braced guards when returning objects, doing multiple statements, or improving readability:

```ts
if (!session) {
  return NextResponse.json({ error: t("settings.profile.errors.unauthorized") }, { status: 401 })
}
```

Place a blank line after a guard before moving to the next concern. Keep tightly coupled statements
adjacent, especially value normalization followed by a return object.

Async flows use a straight-line shape:

1. Read request/session/context data.
2. Validate or narrow input.
3. Derive normalized values.
4. Perform IO inside `try` when failures need logging or user-safe errors.
5. Return early on known error states.
6. Revalidate or emit after successful writes.
7. Return the success object last.

`try` blocks are scoped around the IO that can fail. `catch` blocks log with structured context and
then return or throw a sanitized error. Logging appears immediately before the sanitized failure.

```ts
try {
  await database.insert(uploads).values({ filename, path, mimeType, sizeBytes })
} catch (error) {
  logger.error(
    { action: "confirmAvatarUpload", userId: session.user.id, objectKey, err: error },
    "Avatar upload confirmation failed"
  )

  return { error: t("settings.profile.errors.avatarUpdateFailed") }
}
```

## Formatting rhythm

The author favors short visual blocks. Use blank lines to separate concerns, but keep cohesive
statement clusters dense.

Use a blank line between:

- Import groups.
- Type aliases and runtime constants when they are distinct concepts.
- Hook groups with different roles.
- Guards and the next body section.
- Database reads, derived values, and writes.
- Logger calls and the following return.
- Hooks/derived-values/handlers and the `return` statement.

JSX `return (...)` trees contain **no blank lines**, regardless of how many logical sections the
markup has. Visual separation of sections is achieved by **component decomposition** (extract a
named sub-component per `components.md`), not by blank lines. Blank lines remain correct _between_
hooks/derived-values/handlers and the `return` statement; they are never used _inside_ the returned
element. The `BusinessSettingsPage` worked example below already demonstrates the no-blank rule.

Do not add blank lines inside compact object literals unless the file already groups fields by
section. Database schemas are an exception: large tables use blank lines and comments to separate
column groups.

JSX favors readable vertical structure for multi-prop components. Keep simple components compact:

```tsx
const BusinessSettingsPage = () => {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <header className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <Typography variant="h2">{t("settings.business.title")}</Typography>
      </header>
    </div>
  )
}
```

Use explicit `null` for conditional JSX branches when the surrounding file does:

```tsx
{
  isFingerprint ? <FingerprintCopyButton fingerprint={check.summary} /> : null
}
```

## Naming patterns

Use names that match the domain object or operation instead of abstract placeholders.

- Parsed validation results are named `parsed`.
- Server action return values are named `result` on the client.
- Request headers are named `requestHeaders` when they are reused.
- Database settings rows are commonly named `settingsRow` when `settings` would shadow a table or
  module name.
- Configuration objects use noun names such as `remoteStorageConfiguration`, `statuses`, or
  `routeLabels`.
- Booleans usually use `is`, `has`, `can`, `should`, or a clear noun phrase such as
  `passwordResetAvailable`.
- Internal UI handlers use `handle<Event>` except form submit handlers, which are commonly named
  `onSubmit` to pair with `form.handleSubmit(onSubmit)`.
- Props use `on<Event>` names: `onComplete`, `onSuccess`, `onLogout`, `onOpenChange`.
- Query functions use `get` for single values or computed read models and `list` for collections
  when that convention exists in the feature.
- Service functions are verbs or predicate-style functions: `evaluateEmailHealth`,
  `isEmailConfigured`, `formatBytes`, `resolveStorageUrl`.
- Generic utility functions are named by behavior and input, such as `getIpAddress(headers)`.

Avoid single-letter or vague names except for established local conventions such as `t`, `cn`,
`ctx`, `ref`, callback `prev`, and the structured log key `err`.

Avoid shortened names and abbreviations when a clear full word exists. Prefer `database` over `db`,
`environment` over `env`, `development` over `dev`, `production` over `prod`, and descriptive event
parameter names such as `event` over `e`. Only use abbreviations that are established domain terms,
external API names, or existing project conventions.

## Schemas

Zod schemas are runtime exports. Put the inferred type immediately after its schema:

```ts
export const totpVerifySchema = z.object({
  code: z
    .string()
    .length(6, t("totp.validation.codeLength"))
    .regex(/^\d{6}$/, t("totp.validation.codeDigits"))
})

export type TotpVerifyValues = z.infer<typeof totpVerifySchema>
```

Shared constants used by several schemas, such as password rules, appear before the dependent
schemas. Re-export bridge schemas at the top only when a feature intentionally exposes another
feature's schema through its own surface.

Do not extract shared schema fragments unless field semantics and validation messages are identical
or a deliberate schema factory preserves flow-specific translation keys.

## Barrels

Keep barrels boring. Use `export * from "./Thing"` in component folders. Use explicit grouped
exports in feature root barrels when exporting a curated public surface. Preserve the local order:
components first, then schemas/types/services with a blank line between sections when the barrel is
already grouped that way.

Never export server-only code from a client-safe `index.ts`. Use `server.ts` for server-only public
feature entrypoints.
