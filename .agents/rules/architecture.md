# Architecture Rules

## Pre-work modularity check

Before adding a feature, service, mutation, query, hook, component, schema or utility, stop at the
first rung that solves the task:

1. Does it need to exist at all? If the task does not require it, do not write it.
2. Does this codebase already have it (`lib/utils/`, `lib/`, `hooks/`, `components/ui/`, the
   relevant feature barrel)? Reuse it.
3. Does the standard library or a native platform feature (Next.js, React, the web platform,
   PostgreSQL, Drizzle, Zod) do it? Use it.
4. Can an installed dependency do it? Reuse it before adding one.
5. Can it be one line? Keep it one line.
6. Only then write the minimum that works.

Never trade away trust-boundary validation, error handling, data-loss safety, security or
accessibility for brevity. If you write it, place it in the narrowest correct layer after reading
the nearest comparable file in the same feature and layer.

## Feature module shape

Each feature lives under `features/<feature>/` and is a closed module. One responsibility per file;
add only the files the feature needs now.

- `components/` - React UI and module-private contracts only (see `components.md`).
- `hooks/` - feature-scoped hooks (see `hooks.md`).
- `services/` - pure business logic; no framework or IO imports.
- `engine/` - the canvas editor's pointer runtime (gesture machinery, its hooks, module stores and
  overlay components), which is one cohesive unit that belongs to none of the other folders
  ([ADR 0024](../../docs/architecture/adr/0024-template-editor-canvas.md)). Only
  `features/templates/` has one; do not copy it without an equally strong reason.
- `labels.ts` - domain value → translation key, icon name, badge variant.
- `queries.ts` - reads via Drizzle; server-only.
- `mutations.ts` - writes (server actions); server-only. Splits into `<concern>Mutations.ts` at the
  line ceiling (`actions.md`, "Splitting `mutations.ts`").
- `schemas.ts` - Zod schemas and their inferred types.
- `types.ts` - public types not derivable from schemas.
- `events.ts` - event subscriptions and emissions; a subscriber to many features splits into
  `events/` by emitting feature (`events.md`).
- `index.ts` - client-safe barrel: components, schemas, types, client-safe code only.
- `server.ts` - optional server-only barrel: queries and entrypoints that may import `@/database`,
  `next/headers`, auth server APIs or other IO.

## Boundary rule

`features/A` imports from `features/B` only through a public door:

- `features/B/index.ts` for client-safe code;
- `features/B/server.ts` for server-only code;
- `features/B/systemWrites.ts` for the session-free writes a background job calls (ADR-0023);
- `features/B/services` for a pure domain rule. A pure module reaches no component, `"use server"`
  module or other feature's server graph, so it can never close an import cycle and is safe in the
  browser, the server, the worker and a unit test. Use it when the rule is all you need — the root
  barrel re-exports components and `server.ts` reaches mutations, and either can close a cycle.
  `features/clients/publicQueries.ts` reads the contract display status this way, because
  `features/contracts` reaches `features/clients/server` through its own mutations.

Never export database/auth/server-only code from `index.ts`. Sibling files inside a feature import
by direct path. Never restate another feature's rule to avoid a cycle; import it through the
services door. Types from `database/schema` are shared substrate and may be imported directly.
Enforced by `no-restricted-imports` (`featureBoundaryRule` in `eslint.config.mjs`).

## Purity rule for `services/`

Every non-trivial calculation, state transition, validation or transformation lives in
`features/<feature>/services/` as a pure function. Services never import `next/*`, `react`,
`drizzle-orm/*`, `@/database`, `@/lib/auth`, `@/lib/logger`, storage, email or payment clients, or
any IO module (`pureServicesRule` in `eslint.config.mjs` enforces the framework and database part).
They receive all data as arguments and return all data; they do not read the session, headers,
environment, database, request state or global mutable state. Why: millisecond Vitest runs without
mocks, refactor confidence when the ORM or framework changes, and a clean extraction path to
`packages/core`.

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

Server actions and read functions validate input with Zod, call `services/` for business logic, and
use Drizzle for persistence. They contain no branching business logic: a status-transition check is
`canTransitionInvoiceStatus(current, "paid")` in a service, never a chain of `if (status === ...)`
returns in the action.

## Shared helper placement and abstraction threshold

Cross-feature infrastructure helpers (request metadata, string, date and number normalization,
URL-safe formatting, object filtering) belong in `lib/utils/`. Feature-specific write plans and
persistence details stay in their feature.

Extract shared logic only when the behaviour is identical, the call sites need the same inputs, the
return shape is stable and the error behaviour is the same. Do not extract when return columns,
no-op behaviour, translation keys or field semantics, or rollback/cleanup semantics differ, when
generic Drizzle typing makes call sites harder to read, or when the only shared part is incidental
setup. Standing cases: settings write guards (session, owner role, audit setup) and settings upsert
helpers stay local until a deliberate design exists; `getChangedFields` is shared only once value
unions and behaviour align; `emptyToNull` only once trimming and `string | null` input are decided;
upload cleanup only once log names, rollback and old/new cleanup semantics match; Zod fragments only
when messages and field semantics match; password rule refinements only through a schema factory
that preserves flow-specific translation keys and field names.

## Zod at every boundary

Every server action, public endpoint and settings read validates input with Zod `safeParse`
(`remit/validate-before-io` enforces it before IO in mutations, queries, public modules and routes).
Environment variables are validated at boot in `lib/config/env.ts` and the process exits on failure.
No data crosses a trust boundary unvalidated; see `types.md` for the bans on `any` and non-null
assertions.

## Adding an environment variable

Variables are defined once in the Zod schema in `lib/config/envSchema.ts` and read through the `env`
object from `lib/config/env.ts`; application code never reads `process.env` directly.

1. Add the variable to `lib/config/envSchema.ts`. Optional variables use `optionalEnvString` so
   blank values become `undefined`. Never use the `NEXT_PUBLIC_` prefix: Next.js freezes it into the
   bundle at build time, and a published image must run at any address (ADR-0040). A value the
   browser needs is read on the server and passed down.
2. Document it in `.env.example` with a safe placeholder, never a real secret.

Required secrets also follow `security.md`: validated here, never logged, never returned in a
response.
