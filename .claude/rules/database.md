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
