export const DEFAULT_DEMO_SEED = 20260518
export const DEFAULT_DEMO_SEED_SIZE = "small"
export const DEMO_SEED_SIZES = ["small", "medium", "large"] as const
export const MAX_DEMO_SEED_CLIENTS = 1_000
export const MAX_DEMO_SEED_PROJECTS = 4_000
export const MAX_DEMO_SEED_INVOICES = 20_000

export const SEEDED_TABLES = [
  "settings",
  "tax_rates",
  "leads",
  "clients",
  "projects",
  "tasks",
  "time_entries",
  "expenses",
  "proposals",
  "invoices",
  "line_items",
  "payments",
  "credit_notes",
  "contracts",
  "recurring_invoices"
] as const

export const RESEED_CHECK_TABLES = SEEDED_TABLES.filter((table) => table !== "settings")

export const SEED_INVENTORY = [
  { table: "settings", decision: "seed", reason: "business profile and invoice defaults" },
  { table: "tax_rates", decision: "seed", reason: "real settings/document surface" },
  { table: "leads", decision: "seed", reason: "real lead pipeline domain" },
  { table: "clients", decision: "seed", reason: "core client domain" },
  { table: "projects", decision: "seed", reason: "core project domain" },
  { table: "tasks", decision: "seed", reason: "project task domain" },
  { table: "time_entries", decision: "seed", reason: "time tracking domain" },
  { table: "expenses", decision: "seed", reason: "expense tracking domain" },
  { table: "proposals", decision: "seed", reason: "proposal workflow domain" },
  { table: "invoices", decision: "seed", reason: "invoice workflow domain" },
  {
    table: "line_items",
    decision: "seed",
    reason: "proposal, invoice, and credit-note child rows"
  },
  { table: "payments", decision: "seed", reason: "manual payment domain" },
  { table: "credit_notes", decision: "seed", reason: "invoice correction domain" },
  { table: "contracts", decision: "seed", reason: "contract workflow domain" },
  { table: "recurring_invoices", decision: "seed", reason: "recurring billing domain" },
  { table: "activity_logs", decision: "skip", reason: "runtime event feed; seed emits no events" },
  { table: "audit_logs", decision: "skip", reason: "operational seed runs are not user actions" },
  {
    table: "users/accounts/sessions/verifications/two_factors",
    decision: "skip",
    reason: "Better Auth-owned"
  },
  { table: "organizations/members/invitations", decision: "skip", reason: "Better Auth-owned" },
  { table: "uploads", decision: "skip", reason: "storage internals; no files are generated" },
  { table: "email_logs", decision: "skip", reason: "runtime delivery log; no email is sent" },
  { table: "proposal_otps", decision: "skip", reason: "public acceptance security artifact" },
  { table: "contract_signatures", decision: "skip", reason: "legal signature artifact" },
  {
    table: "templates",
    decision: "wait-for-feature",
    reason: "template block content is editor-owned"
  }
] as const
