# Code Style Rules

## Canonical exemplar first, then nearest local file

Each file category has one canonical exemplar. Match it, then fall back to the nearest comparable
file in the same feature and layer for anything it does not cover. Where two files of the same role
disagree, the exemplar wins, not the nearest neighbour. The exemplar never overrides architecture
boundaries: a generic helper still belongs in `lib/utils/`.

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
| component barrel                 | `features/settings/business/components/index.ts` (`export * from "./X"`)                 |

Match the exemplar for: whether a component is an expression body or a block with `return`, whether
helpers sit before or after the component, and how many blank lines separate hooks and derived
values.

## Form, structure, and meaning

- **Form** — import order and grouping, the blank line after a directive or import group,
  type-import style, barrel export order, no blank lines inside a JSX return, `.tsx` helper
  placement. ESLint owns all of it (`perfectionist/sort-imports`, `perfectionist/sort-exports`,
  `padding-line-between-statements`, `@typescript-eslint/consistent-type-imports`,
  `remit/no-blank-lines-in-jsx-return`, `remit/helper-placement`). Run `pnpm lint:fix`; never
  hand-tune it.
- **Structure** — declaration order and body-section order, below. Deterministic: classify each
  statement by its syntax and place it in its section. It is recursive: it governs the top level of
  a file and the body of every function, callback and `try` block. Not lint-enforced on purpose: the
  exemplars legitimately interleave hooks and derived values by data dependency, which an AST rule
  cannot tell from disorder.
- **Meaning** — blank lines between concerns: see "The blank-line law". The only judgment left is
  which statements form one cohesive group; mirror the nearest exemplar, never invent a rhythm.

## File-level organization

Directives first, then imports. After imports, a non-component `.ts` file follows:

1. File-private constants and variant definitions.
2. File-private types (props, options, rows, configs, results).
3. The main exported function or component.
4. Private helpers below the public API.
5. Bottom named export blocks for components and UI primitives.

In `.tsx` component files the rule inverts: file-private `function` helpers go above the component
(`components.md`, "File-private helpers in `.tsx`"). Exceptions: app route files follow Next.js
export order; schema files export each schema immediately followed by its inferred type; pure
service files may export several small named functions; large configuration files define constants
and inline callbacks first, private helpers after the exported config.

## React component body structure

Classify each top-level statement and place it in its section, in this order:

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

The order is non-decreasing except for three sanctioned nuances (the exemplar breaks ties):

- A hook whose result feeds another hook precedes its consumer (`ClientForm` declares its `useMemo`
  default values before `useForm`).
- Statements serving one concern stay adjacent (`ClientsListPage` keeps `useTransition` beside the
  `useClientListState(startTransition)` call it feeds).
- Derived values and handlers that depend on a guard may follow that guard. A hook never follows a
  guard return — that is a conditional-hook bug, enforced by `react-hooks/rules-of-hooks`.

## Body-section order by file category

| Category              | Body-section sequence                                                                                                                                                                    | Authority                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| component `.tsx`      | the 10-section table above; file-private `function` helpers above the component                                                                                                          | this file + `components.md`           |
| `mutations.ts` action | read request/session → validate (`safeParse`, early return) → normalize `parsed.data` → service calls → writes in a scoped `try` → audit + events → revalidate → `return { data }`       | `actions.md`                          |
| `queries.ts` read     | validate untrusted input (`safeParse`, early empty return) → reads (independent ones in `Promise.all`) → map via `to<Model>` → return; `where`/`order-by` helpers below the public reads | `queries.md`                          |
| `services/*.ts`       | pure functions; config/result types before the function that uses them; private helpers below the public function                                                                        | `architecture.md`                     |
| `schemas.ts`          | shared constants first → each `schema` immediately followed by its `z.infer` type                                                                                                        | this file ("Schemas")                 |
| generic `.ts`         | file-private constants → file-private types → public function/export → private helpers below                                                                                             | this file ("File-level organization") |

## Intra-function structure

Same-role functions anywhere in the repo — submit handlers, `to<Model>` mappers, service predicates,
`where` builders, event handlers — share the same internal order and blank-line rhythm, derived from
the general rule, never from a per-function catalogue. A function body orders as: guard returns →
read/derive inputs → normalize values → IO inside a scoped `try` → post-write side effects (audit,
events, revalidate) → final return. A pure function collapses to derive → compute → return.

## Function and logic structure

- Prefer early returns; one-line guards when the body is trivial (`if (!settings) return false`),
  braced guards when returning objects or doing several statements.
- Async flows are straight-line: read context → validate/narrow → derive → IO in `try` → early
  return on known errors → revalidate/emit after writes → return success last.
- `try` blocks wrap only the IO that can fail. `catch` logs with structured context immediately
  before returning or throwing a sanitized error.

## The blank-line law

- Exactly one blank line between adjacent statements of different sections (different concerns).
- No blank line between statements of one cohesive group: related `useState` for one feature, a
  normalization feeding the `return` beneath it, stacked one-line guards.
- Never more than one consecutive blank line.

It applies at every nesting level. Insert one blank line between: import groups; distinct type
aliases and runtime constants; hook groups with different roles; a guard and the next section;
reads, derived values and writes; a logger call and the following return; the hooks/derived/handlers
block and the `return`. JSX `return (...)` trees contain no blank lines — separate sections by
extracting named sub-components (`components.md`). Compact object literals get no internal blank
lines, except large database schema tables grouped by section.

This is deliberately not a blanket `padding-line-between-statements` rule: that would force blank
lines between the sanctioned stacked guards and break compact expression bodies.

Use explicit `null` for conditional JSX branches when the surrounding file does.

## Naming patterns

- Parsed validation results: `parsed`. Client-side action results: `result`. Reused request headers:
  `requestHeaders`. Settings rows that would shadow a module: `settingsRow`.
- Configuration objects use nouns (`remoteStorageConfiguration`, `statuses`, `routeLabels`).
- Booleans use `is`, `has`, `can`, `should`, or a clear noun phrase (`passwordResetAvailable`).
- Internal UI handlers are `handle<Event>`; form submit handlers are `onSubmit`
  (`form.handleSubmit(onSubmit)`); props are `on<Event>` (`onComplete`, `onOpenChange`).
- Queries use `get` for a single value or computed read model and `list` for collections.
- Services are verbs or predicates (`evaluateEmailHealth`, `isEmailConfigured`, `formatBytes`).
- Generic utilities are named by behaviour and input (`getIpAddress(headers)`).
- No single-letter or vague names except established conventions (`t`, `cn`, `ctx`, `ref`, `prev`,
  the log key `err`). No abbreviation where a full word exists: `database` not `db`, `environment`
  not `env`, `development` not `dev`, `event` not `e` — unless it is an external API name or an
  existing project convention.

## Schemas

Put the inferred type immediately after its schema:

```ts
export const totpVerifySchema = z.object({
  code: z.string().length(6, t("totp.validation.codeLength"))
})

export type TotpVerifyValues = z.infer<typeof totpVerifySchema>
```

Export a schema, inferred type or schema constant only when something outside the file consumes it;
the fix for an unused export is to unexport or delete it, never to suppress the warning. Shared
constants used by several schemas come first. Re-export a bridge schema at the top only when a
feature intentionally exposes another feature's schema. Do not extract shared schema fragments
unless field semantics and validation messages are identical, or a deliberate schema factory
preserves flow-specific translation keys.

## Helper discipline

Do not add local helpers for generic request, string, date, number, URL or object normalization when
an equivalent exists under `lib/utils/` (request metadata parsing is `getIpAddress(headers)` in
`lib/utils/request.ts`). A generic helper needed by more than one feature goes in a focused file
under `lib/utils/`, exported from `lib/utils/index.ts`. Helpers that differ in trimming, null
handling, return shape, translation keys, return columns, rollback or error messages stay local
until a deliberate shared contract exists.

## Barrels

Component folders use `export * from "./Thing"`, alphabetized (lint-enforced). A feature root
`index.ts` may export curated named groups — components, then schemas, then types, with a blank line
between groups — and is client-safe; server-only exports go in `server.ts`.
