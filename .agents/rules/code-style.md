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
| API route                        | `app/api/upload/[type]/route.ts`                                                         |
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

## Form, structure, and meaning

Code organization splits into three layers. Knowing which layer a question belongs to tells you who
owns the answer, so different models converge on the same output.

- **Form** - import order and grouping, the blank line after a directive or import group,
  type-import style, barrel export order, blank lines inside a JSX return, and `.tsx` helper
  placement. ESLint owns this; `eslint.config.mjs` is the source of truth and `pnpm lint --fix`
  settles it. Do not hand-tune what the formatter sets.
- **Structure** - declaration order (see "File-level organization") and the body-section order
  below. This is deterministic: classify each statement by its syntax and place it in its section,
  so two models given the same file produce the same order. It is **recursive**: it governs the
  top-level body of a file _and_ the body of every function, callback, and `try` block inside it, so
  same-role functions across the repo are organized identically (see "Intra-function structure").
  Only `.tsx` helper placement is lint-backed (`remit/helper-placement`); the section order itself
  is convention you follow exactly. It is not lint-enforced on purpose - the canonical exemplars
  legitimately interleave hooks and derived values by data dependency and cohesion (the two nuances
  below), which an AST rule cannot tell apart from real disorder without flagging the exemplars
  themselves.
- **Meaning** - the blank lines between concerns. Most of this is now a deterministic rule, not
  judgment: see "The blank-line law". The only residual judgment is _which statements form one
  cohesive group_; for that, mirror the nearest canonical exemplar and never invent a new rhythm
  (see "Formatting rhythm").

## React component body structure

Component bodies are grouped by concern, not by a rigid hook-type order, but the section sequence is
deterministic: classify each top-level statement by its syntax and place it in the matching section.

| #   | Section                          | How to classify the statement                                             |
| --- | -------------------------------- | ------------------------------------------------------------------------- |
| 1   | Translation                      | `const { t } = useTranslation()`                                          |
| 2   | Router / session / path / params | `useRouter`, `usePathname`, `useParams`, `useSearchParams`, session hooks |
| 3   | Local state                      | `useState` / `useTransition`; related state stays adjacent                |
| 4   | Form setup                       | `useForm(...)`, then the `form.formState` destructure                     |
| 5   | Other hooks / refs               | any remaining `use*` call or `useRef`                                     |
| 6   | Derived values                   | a `const` that is neither a hook call nor assigned a function             |
| 7   | Handlers                         | a `const` assigned an arrow function, or a `function`                     |
| 8   | Effects / hotkeys                | `useEffect`, hotkey registration, other registration effects              |
| 9   | Guard returns                    | `if (...) return ...` before the JSX                                      |
| 10  | JSX return                       | `return ( ... )`                                                          |

Three nuances override a statement's table position; the canonical exemplar is the tiebreaker:

- When one hook's result is an argument to another, the producer precedes the consumer even when the
  table would order them the other way. `ClientForm` declares its `useMemo` default values before
  `useForm` because the form consumes them.
- Statements serving one concern stay adjacent. `ClientsListPage` places `useTransition` next to the
  `useClientListState(startTransition)` call it feeds rather than with the other state.
- A value derived only after an early guard return may follow that guard. Idiomatic React guards
  first (`if (!data) return null`) and then computes values that depend on the guard having passed
  (`const name = data.name`); such **derived values and handlers** legitimately appear after a guard
  return even though the table lists guards (9) after them (6, 7). A **hook** (sections 1-5, 8) must
  never follow a guard return — that is a conditional-hook bug, and it is the one part of this
  ordering that _is_ mechanically enforced, by `react-hooks/rules-of-hooks`.

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

The default reading of the table is non-decreasing: a statement does not appear in a section that
precedes a section already seen. The three nuances above are the only sanctioned exceptions, driven
by data dependency, cohesion, or guard-dependent computation - which is exactly why this is applied
by hand and in review rather than by a lint rule. The order _inside_ a handler and the blank lines
between statements are governed separately, by "Intra-function structure" and the blank-line law
below.

## Body-section order by file category

Deterministic section order is not a component-only rule. Every file category has a fixed body
sequence: classify each top-level statement by its syntax, place it in the matching section, and let
the blank-line law govern the spacing between sections. Where a rule file already specifies the
sequence, that file is authoritative; this table is the index.

| Category              | Body-section sequence                                                                                                                                                                    | Authority                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| component `.tsx`      | the 10-section table above; file-private `function` helpers sit above the component                                                                                                      | this file + `components.md`           |
| `mutations.ts` action | read request/session → validate (`safeParse`, early return) → normalize `parsed.data` → service calls → writes in a scoped `try` → audit + events → revalidate → `return { data }`       | `actions.md`                          |
| `queries.ts` read     | validate untrusted input (`safeParse`, early empty return) → reads (independent ones in `Promise.all`) → map via `to<Model>` → return; `where`/`order-by` helpers below the public reads | `queries.md`                          |
| `services/*.ts`       | pure functions, inputs typed and no IO; config/result types before the function that uses them; private helpers below the public function                                                | `architecture.md`                     |
| `schemas.ts`          | shared constants first → each `schema` immediately followed by its `z.infer` type                                                                                                        | this file ("Schemas")                 |
| generic `.ts`         | file-private constants → file-private types → public function/export → private helpers below                                                                                             | this file ("File-level organization") |

## Intra-function structure

The body-section discipline recurses: the rules above order the _top-level_ statements of a file,
and the rules here order the statements _inside_ each function, callback, and `try` block. Imagine
rewriting the file from scratch - the inside of a function is organized as deliberately as the file
around it.

**Same-role functions are organized identically.** Two functions that play the same role anywhere in
the repo - a form submit handler, a `to<Model>` mapper, a service predicate, a `where`-clause
builder, an event handler - share the same internal section order and the same blank-line rhythm, so
a reader finds the same piece of logic in the same place in every file. Derive that order from the
statement-classification rules, never from a per-function catalogue: there is no "the submit-handler
rule", only the general rule applied to a submit handler.

A function body classifies into the same kind of sections as a file body, in this order: guard
returns → read/derive inputs → normalize values → IO inside a scoped `try` → post-write side effects
(audit, events, revalidate) → the final return. The async-flow shape below is this list for an IO
function; a pure function collapses to derive → compute → return.

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

## The blank-line law

The author favors short visual blocks. The spacing between statements is a deterministic rule, not a
free choice:

- **Exactly one blank line between two adjacent statements of different sections** (different
  concern).
- **No blank line between statements of the same cohesive group** (one concern). A cohesive group is
  statements serving a single concern: related `useState` for one feature (e.g. all the filters of
  one list), a value normalization immediately feeding the `return` beneath it, stacked one-line
  guard returns.
- **Never more than one consecutive blank line.** Prettier collapses extras, so two or more blank
  lines in a row is always a defect to remove.

The law applies at every nesting level - the top-level body and the inside of every function,
callback, and `try` block (see "Intra-function structure"). The only judgment it leaves is _which
statements belong to one cohesive group_; resolve that by mirroring the nearest canonical exemplar,
never by inventing a new rhythm.

Why it is not a blanket lint rule: a `padding-line-between-statements` rule would force a blank line
between the sanctioned stacked one-line guards and break compact expression bodies, so it is
deliberately not configured. The lint-enforced slice is narrower and exact - no blank lines inside a
JSX return (`remit/no-blank-lines-in-jsx-return`, auto-fixable) and the blank line after a
`"use server"` / `"use client"` directive. Everything else in this law is applied by hand and
checked in review, but it is a rule with a right answer, not a preference.

Concretely, insert one blank line between: import groups; type aliases and runtime constants when
they are distinct concepts; hook groups with different roles; a guard and the next body section;
database reads, derived values, and writes; a logger call and the following return; and the
hooks/derived-values/handlers block and the `return` statement.

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

Export a schema, its inferred type, or a schema constant only when something consumes it. One used
only inside its own file — a base schema that another schema `.extend()`s, or a `MAX_LENGTH`
constant referenced only by the schema it bounds — stays unexported; add the `export` when a
consumer outside the file imports it. Do not export an inferred type that nothing uses: the fix for
an unused export is to unexport it (or delete an unused type), never to suppress the warning.

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
