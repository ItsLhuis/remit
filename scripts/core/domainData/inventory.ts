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
  // What the trash surface does with the table: `restorable` rows are listed there and can be
  // un-deleted, `cascade` rows carry `deleted_at` but only ever as part of the document that owns
  // them, and `none` has no `deleted_at` at all. `retention` names which of the two configured
  // windows governs the purge of a restorable table, and is null for every other decision.
  trash: "restorable" | "cascade" | "none"
  retention: "trash" | "financial" | null
  reason: string
}

// The one classification of every table in `database/schema/index.ts`, carrying five independent
// decisions: what `pnpm remit:seed-demo` writes, what its `--reseed` replaces, what
// `pnpm remit:reset-data` removes, what the trash surface restores, and which retention window
// purges it. They genuinely differ — `contract_signatures` is never seeded yet must be cleared by a
// reseed, `tax_rates` is seeded and reseeded yet survives a reset because a rate an operator
// configured is instance configuration, and `line_items` carries `deleted_at` yet is never listed
// in the trash because it has no life apart from the document above it.
//
// The trash surface and the retention purge read this array from application code rather than
// keeping a list of their own. That import direction is the reverse of the usual one — scripts
// import features, not the other way round — and it is deliberate: a second classification that can
// disagree with this one is the failure this file exists to prevent, and the file itself is a plain
// const array with a type-only Drizzle import, so nothing operational travels with it.
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
    trash: "none",
    retention: null,
    reason: "runtime event feed for domain rows"
  },
  {
    key: "emailLogs",
    table: "email_logs",
    seed: "skip",
    reseed: "keep",
    reset: "delete",
    trash: "none",
    retention: null,
    reason: "delivery log for documents that were sent"
  },
  {
    key: "dataExports",
    table: "data_exports",
    seed: "skip",
    reseed: "keep",
    reset: "delete",
    trash: "none",
    retention: null,
    reason: "archive record of exported domain data"
  },
  {
    key: "attachments",
    table: "attachments",
    seed: "skip",
    reseed: "delete",
    reset: "delete",
    trash: "none",
    retention: null,
    reason: "user-uploaded files hanging off a client, project, invoice, or expense"
  },
  {
    key: "contractSignatures",
    table: "contract_signatures",
    seed: "skip",
    reseed: "delete",
    reset: "delete",
    trash: "none",
    retention: null,
    reason: "insert-only signature artifact of a contract"
  },
  {
    key: "proposalOtps",
    table: "proposal_otps",
    seed: "skip",
    reseed: "delete",
    reset: "delete",
    trash: "none",
    retention: null,
    reason: "public acceptance security artifact of a proposal"
  },
  {
    key: "lineItems",
    table: "line_items",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    trash: "cascade",
    retention: null,
    reason: "proposal, invoice, and credit-note child rows"
  },
  {
    key: "payments",
    table: "payments",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    trash: "restorable",
    retention: "financial",
    reason: "manual payment domain"
  },
  {
    key: "creditNotes",
    table: "credit_notes",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    trash: "restorable",
    retention: "financial",
    reason: "invoice correction domain"
  },
  {
    key: "contracts",
    table: "contracts",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    trash: "restorable",
    retention: "financial",
    reason: "contract workflow domain"
  },
  {
    key: "invoices",
    table: "invoices",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    trash: "restorable",
    retention: "financial",
    reason: "invoice workflow domain"
  },
  {
    key: "proposals",
    table: "proposals",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    trash: "restorable",
    retention: "trash",
    reason: "proposal workflow domain"
  },
  {
    key: "recurringInvoices",
    table: "recurring_invoices",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    trash: "restorable",
    retention: "trash",
    reason: "recurring billing domain"
  },
  {
    key: "expenses",
    table: "expenses",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    trash: "restorable",
    retention: "financial",
    reason: "expense tracking domain"
  },
  {
    key: "timeEntries",
    table: "time_entries",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    trash: "restorable",
    retention: "trash",
    reason: "time tracking domain"
  },
  {
    key: "tasks",
    table: "tasks",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    trash: "restorable",
    retention: "trash",
    reason: "project task domain"
  },
  {
    key: "projects",
    table: "projects",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    trash: "restorable",
    retention: "trash",
    reason: "core project domain"
  },
  {
    key: "leads",
    table: "leads",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    trash: "restorable",
    retention: "trash",
    reason: "lead pipeline domain"
  },
  {
    key: "clientContacts",
    table: "client_contacts",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    trash: "restorable",
    retention: "trash",
    reason: "sub-records of a client, deleted with the clients they belong to"
  },
  {
    key: "clients",
    table: "clients",
    seed: "seed",
    reseed: "delete",
    reset: "delete",
    trash: "restorable",
    retention: "trash",
    reason: "core client domain"
  },
  {
    key: "uploads",
    table: "uploads",
    seed: "skip",
    reseed: "keep",
    reset: "delete",
    trash: "none",
    retention: null,
    reason: "only the rows the deleted documents pointed at; the logo and template images stay"
  },
  {
    key: "taxRates",
    table: "tax_rates",
    seed: "seed",
    reseed: "delete",
    reset: "keep",
    trash: "restorable",
    retention: "trash",
    reason: "operator-configured rates that outlive the documents using them"
  },
  {
    key: "settings",
    table: "settings",
    seed: "seed",
    reseed: "keep",
    reset: "keep",
    trash: "none",
    retention: null,
    reason: "the instance itself: business profile, numbering, provider configuration"
  },
  {
    key: "templates",
    table: "templates",
    seed: "wait-for-feature",
    reseed: "keep",
    reset: "keep",
    trash: "restorable",
    retention: "trash",
    reason: "authored document configuration; block content is editor-owned"
  },
  {
    key: "auditLogs",
    table: "audit_logs",
    seed: "skip",
    reseed: "keep",
    reset: "keep",
    trash: "none",
    retention: null,
    reason: "insert-only operational trail; a reset writes to it and never from it"
  },
  {
    key: "users",
    table: "users",
    seed: "skip",
    reseed: "keep",
    reset: "keep",
    trash: "none",
    retention: null,
    reason: "Better Auth-owned"
  },
  {
    key: "accounts",
    table: "accounts",
    seed: "skip",
    reseed: "keep",
    reset: "keep",
    trash: "none",
    retention: null,
    reason: "Better Auth-owned"
  },
  {
    key: "sessions",
    table: "sessions",
    seed: "skip",
    reseed: "keep",
    reset: "keep",
    trash: "none",
    retention: null,
    reason: "Better Auth-owned"
  },
  {
    key: "verifications",
    table: "verifications",
    seed: "skip",
    reseed: "keep",
    reset: "keep",
    trash: "none",
    retention: null,
    reason: "Better Auth-owned"
  },
  {
    key: "twoFactors",
    table: "two_factors",
    seed: "skip",
    reseed: "keep",
    reset: "keep",
    trash: "none",
    retention: null,
    reason: "Better Auth-owned"
  },
  {
    key: "organizations",
    table: "organizations",
    seed: "skip",
    reseed: "keep",
    reset: "keep",
    trash: "none",
    retention: null,
    reason: "Better Auth-owned"
  },
  {
    key: "members",
    table: "members",
    seed: "skip",
    reseed: "keep",
    reset: "keep",
    trash: "none",
    retention: null,
    reason: "Better Auth-owned"
  },
  {
    key: "invitations",
    table: "invitations",
    seed: "skip",
    reseed: "keep",
    reset: "keep",
    trash: "none",
    retention: null,
    reason: "Better Auth-owned: an invitation nobody accepted yet still has to work afterwards"
  }
] as const satisfies readonly DomainTableDecision[]

type DomainTableEntry = (typeof DOMAIN_DATA_INVENTORY)[number]

export type RestorableTableName = Extract<DomainTableEntry, { trash: "restorable" }>["table"]

export type SeededTableName = Extract<DomainTableEntry, { seed: "seed" }>["table"]
export type ReseedCheckTableName = Exclude<SeededTableName, "settings">
export type ResetDeletedTableName = Extract<DomainTableEntry, { reset: "delete" }>["table"]
