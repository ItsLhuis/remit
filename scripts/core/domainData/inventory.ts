import { type PgTable } from "drizzle-orm/pg-core"

type Schema = typeof import("@/database/schema")

// Only the exports of `@/database/schema` that are real tables, so an entry below names its table
// through the schema barrel instead of repeating the SQL name as an unchecked string.
type SchemaTableKey = {
  [Key in keyof Schema]: Schema[Key] extends PgTable ? Key : never
}[keyof Schema]

export type DomainTableDecision = {
  key: SchemaTableKey
  table: string
  seed: "seed" | "skip" | "wait-for-feature"
  reseed: "delete" | "keep"
  reset: "delete" | "keep"
  reason: string
}

// The one classification of every table in `database/schema/index.ts`, carrying three independent
// decisions: what `pnpm remit:seed-demo` writes, what its `--reseed` replaces, and what
// `pnpm remit:reset-data` removes. The three genuinely differ — `contract_signatures` is never
// seeded yet must be cleared by a reseed, and `tax_rates` is seeded and reseeded yet survives a
// reset because a rate an operator configured is instance configuration.
//
// The array order is the FK-safe delete order, and `deleteDomainRows` walks it directly: children
// before parents, `uploads` last. Reordering it changes what both commands do. Tables neither
// command deletes are listed after the deletable ones, where their position cannot matter.
//
// A table missing from here fails `__tests__/inventory.test.ts`, which is the only thing standing
// between a new table and a reset that silently leaves its rows behind.
export const DOMAIN_DATA_INVENTORY = [
  {
    key: "activityLogs",
    table: "activity_logs",
    seed: "skip",
    reseed: "keep",
    reset: "delete",
    reason: "runtime event feed for domain rows"
  },
  {
    key: "emailLogs",
    table: "email_logs",
    seed: "skip",
    reseed: "keep",
    reset: "delete",
    reason: "delivery log for documents that were sent"
  },
  {
    key: "dataExports",
    table: "data_exports",
    seed: "skip",
    reseed: "keep",
    reset: "delete",
    reason: "archive record of exported domain data"
  },
  {
    key: "contractSignatures",
    table: "contract_signatures",
    seed: "skip",
    reseed: "delete",
    reset: "delete",
    reason: "insert-only signature artifact of a contract"
  },
  {
    key: "proposalOtps",
    table: "proposal_otps",
    seed: "skip",
    reseed: "delete",
    reset: "delete",
    reason: "public acceptance security artifact of a proposal"
  },
  {
    key: "lineItems",
    table: "line_items",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    reason: "proposal, invoice, and credit-note child rows"
  },
  {
    key: "payments",
    table: "payments",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    reason: "manual payment domain"
  },
  {
    key: "creditNotes",
    table: "credit_notes",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    reason: "invoice correction domain"
  },
  {
    key: "contracts",
    table: "contracts",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    reason: "contract workflow domain"
  },
  {
    key: "invoices",
    table: "invoices",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    reason: "invoice workflow domain"
  },
  {
    key: "proposals",
    table: "proposals",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    reason: "proposal workflow domain"
  },
  {
    key: "recurringInvoices",
    table: "recurring_invoices",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    reason: "recurring billing domain"
  },
  {
    key: "expenses",
    table: "expenses",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    reason: "expense tracking domain"
  },
  {
    key: "timeEntries",
    table: "time_entries",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    reason: "time tracking domain"
  },
  {
    key: "tasks",
    table: "tasks",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    reason: "project task domain"
  },
  {
    key: "projects",
    table: "projects",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    reason: "core project domain"
  },
  {
    key: "leads",
    table: "leads",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    reason: "lead pipeline domain"
  },
  {
    key: "clientContacts",
    table: "client_contacts",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    reason: "sub-records of a client, deleted with the clients they belong to"
  },
  {
    key: "clients",
    table: "clients",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    reason: "core client domain"
  },
  {
    key: "uploads",
    table: "uploads",
    seed: "skip",
    reseed: "keep",
    reset: "delete",
    reason: "only the rows the deleted documents pointed at; the logo and template images stay"
  },
  {
    key: "taxRates",
    table: "tax_rates",
    seed: "seed",
    reseed: "delete",
    reset: "keep",
    reason: "operator-configured rates that outlive the documents using them"
  },
  {
    key: "settings",
    table: "settings",
    seed: "seed",
    reseed: "keep",
    reset: "keep",
    reason: "the instance itself: business profile, numbering, provider configuration"
  },
  {
    key: "templates",
    table: "templates",
    seed: "wait-for-feature",
    reseed: "keep",
    reset: "keep",
    reason: "authored document configuration; block content is editor-owned"
  },
  {
    key: "auditLogs",
    table: "audit_logs",
    seed: "skip",
    reseed: "keep",
    reset: "keep",
    reason: "insert-only operational trail; a reset writes to it and never from it"
  },
  {
    key: "users",
    table: "users",
    seed: "skip",
    reseed: "keep",
    reset: "keep",
    reason: "Better Auth-owned"
  },
  {
    key: "accounts",
    table: "accounts",
    seed: "skip",
    reseed: "keep",
    reset: "keep",
    reason: "Better Auth-owned"
  },
  {
    key: "sessions",
    table: "sessions",
    seed: "skip",
    reseed: "keep",
    reset: "keep",
    reason: "Better Auth-owned"
  },
  {
    key: "verifications",
    table: "verifications",
    seed: "skip",
    reseed: "keep",
    reset: "keep",
    reason: "Better Auth-owned"
  },
  {
    key: "twoFactors",
    table: "two_factors",
    seed: "skip",
    reseed: "keep",
    reset: "keep",
    reason: "Better Auth-owned"
  },
  {
    key: "organizations",
    table: "organizations",
    seed: "skip",
    reseed: "keep",
    reset: "keep",
    reason: "Better Auth-owned"
  },
  {
    key: "members",
    table: "members",
    seed: "skip",
    reseed: "keep",
    reset: "keep",
    reason: "Better Auth-owned"
  },
  {
    key: "invitations",
    table: "invitations",
    seed: "skip",
    reseed: "keep",
    reset: "keep",
    reason: "Better Auth-owned: an invitation nobody accepted yet still has to work afterwards"
  }
] as const satisfies readonly DomainTableDecision[]

type DomainTableEntry = (typeof DOMAIN_DATA_INVENTORY)[number]

export type SeededTableName = Extract<DomainTableEntry, { seed: "seed" }>["table"]
export type ReseedCheckTableName = Exclude<SeededTableName, "settings">
export type ResetDeletedTableName = Extract<DomainTableEntry, { reset: "delete" }>["table"]
