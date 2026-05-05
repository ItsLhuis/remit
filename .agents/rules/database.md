---
paths:
  - "database/**/*.ts"
  - "drizzle/**"
---

# Database Rules

- Create one schema file per domain in `database/schema/`. Export it from
  `database/schema/index.ts`.
- Spread `timestamps` from `@/database/schema/helpers` on every domain table - never redefine
  `createdAt`/`updatedAt`.
- All foreign keys use `{ onDelete: "cascade" }`.
- Use `uuid` primary keys with `.defaultRandom()` for new domain tables.
- All `timestamp` columns use `{ withTimezone: true, mode: "date" }`.
- Table names: snake_case. Column names: camelCase in TypeScript mapped to snake_case strings.
- After any schema change: run `pnpm database:generate` to create a migration file. Never edit
  generated migration SQL.
- Import the database instance as `database` from `@/database` - never instantiate `drizzle` or
  `postgres` in feature code.

## Indexes

Every foreign key column that is used in a join must have a covering index declared in the table
options object using Drizzle's `index().on(...)`. Every column that appears in a `WHERE` or
`ORDER BY` clause of a frequent query must also have an index. Composite indexes must match the
column order of the query that motivated them.

```ts
// ✓ - FK used in joins has a covering index; filtered column indexed separately
export const timeEntries = pgTable(
  "time_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    billable: boolean("billable").notNull().default(true),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull(),
    ...timestamps
  },
  (table) => [
    index("time_entries_project_id_idx").on(table.projectId),
    index("time_entries_started_at_idx").on(table.startedAt)
  ]
)

// ✗ - FK defined but no index; table scans on every join
export const timeEntries = pgTable("time_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  ...timestamps
})
```

## Money

Monetary values are stored as `bigint` representing the smallest currency unit (cents for EUR/USD).
Never use `numeric`, `real`, or `double precision` for money columns - floating-point representation
causes rounding errors in financial calculations.

The ISO 4217 currency code (three uppercase letters, e.g. `"EUR"`, `"USD"`) lives on the parent
entity, not on each individual money column. When displaying a value, format it using
`Intl.NumberFormat` with the entity's currency.

```ts
// ✓ - amount stored as bigint cents; currency on the parent entity
export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
  subtotalCents: bigint("subtotal_cents", { mode: "number" }).notNull(),
  taxCents: bigint("tax_cents", { mode: "number" }).notNull(),
  totalCents: bigint("total_cents", { mode: "number" }).notNull(),
  ...timestamps,
})

// Display - format with the entity's currency
new Intl.NumberFormat("pt-PT", { style: "currency", currency: invoice.currency }).format(
  invoice.totalCents / 100
)

// ✗ - numeric stores a float; rounding errors accumulate across calculations
totalAmount: numeric("total_amount", { precision: 10, scale: 2 }),
```
