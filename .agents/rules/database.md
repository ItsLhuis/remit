---
paths:
  - "database/**/*.ts"
  - "drizzle/**"
---

# Database Rules

## Schema file organization

- Create one schema file per domain in `database/schema/` and export it from
  `database/schema/index.ts`.
- Database schema files import Drizzle column builders first, then Drizzle helpers such as
  `relations` or `sql`, then relative enum/helper/table imports.
- Define table constants before relation constants.
- Large domain tables group columns with blank lines and short section comments when the domain has
  clear sections, such as business profile, locale, invoicing, payments, email, reminders, and
  backups.
- Keep table option arrays dense and ordered by purpose: indexes first, then checks/constraints.

## Columns and tables

- Table names are snake_case.
- TypeScript column properties are camelCase and map to snake_case database column names.
- Use `uuid(...).primaryKey().defaultRandom()` for new domain table IDs unless the table is owned by
  an external library schema that requires a different shape.
- Use `timestamp(..., { withTimezone: true, mode: "date" })` for timestamp columns.
- Spread `timestamps` from `@/database/schema/helpers` on normal domain tables instead of redefining
  `createdAt` and `updatedAt`.
- Use `softDelete` only for domains that actually support soft deletion.
- Do not add `tenantId` columns or row-level tenancy.

## Foreign keys

Foreign key `onDelete` behavior follows the relationship semantics, not a single global default:

- Use `{ onDelete: "cascade" }` for owned child rows that should disappear with the parent, such as
  auth sessions/accounts tied to users.
- Use `{ onDelete: "set null" }` for optional business references that should preserve the record,
  such as invoices pointing to clients, projects, proposals, recurring invoices, templates, or
  uploads.
- Match the nearest existing table in the same domain before choosing behavior.

## Indexes and checks

Every foreign key used in joins should have an index declared in the table options array unless the
local schema has a deliberate reason not to. Frequent `WHERE` and `ORDER BY` columns should also be
indexed.

Use named checks for domain invariants and keep check names prefixed with `chk_<table>_...`:

```ts
check("chk_invoices_view_count", sql`${table.viewCount} >= 0`)
```

## Money

Monetary values are stored as `bigint` representing the smallest currency unit, usually cents. Do
not use floating point columns for money.

The ISO 4217 currency code lives on the parent entity when values share a currency. Format display
values with `Intl.NumberFormat` at the application boundary.

## Migrations

After any schema change, run `pnpm database:generate` to create a migration file. Never edit
generated migration SQL manually. Do not run `pnpm database:migrate` without confirming the target
environment first.

## Database access

Import the database instance as `database` from `@/database`. Feature code does not instantiate
Drizzle or `postgres` directly.

Database access belongs in:

- `features/<feature>/queries.ts` for reads.
- `features/<feature>/mutations.ts` for writes.
- Explicit operational scripts under `scripts/` when the operation is not part of the web app.

Do not move Drizzle operations into `features/<feature>/services/`. Services stay pure and receive
database rows as ordinary typed input.

## Reusable persistence helpers

Do not create generic upsert/update helpers just because several settings mutations look similar.
Only extract persistence helpers when return columns, no-op behavior, error mapping, audit behavior,
and transaction semantics are identical.

If a helper requires broad generic Drizzle typing that obscures the write, keep the write local and
extract only the truly generic non-IO pieces to `lib/utils/` or a pure service.
