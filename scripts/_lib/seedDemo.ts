import { createHash } from "node:crypto"

import { faker } from "@faker-js/faker"

export const DEFAULT_DEMO_SEED = 20260518
export const DEFAULT_DEMO_SEED_SIZE = "small"
export const DEMO_SEED_SIZES = ["small", "medium", "large"] as const
export const MAX_DEMO_SEED_CLIENTS = 1_000
export const MAX_DEMO_SEED_PROJECTS = 4_000
export const MAX_DEMO_SEED_INVOICES = 20_000

const DAY_MS = 24 * 60 * 60 * 1000
const BASE_YEAR = 2026
const CUSTOM_PROJECTS_PER_CLIENT = 4
const CUSTOM_INVOICES_PER_PROJECT = 5

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

export type SeededTableName = (typeof SEEDED_TABLES)[number]
export type ReseedCheckTableName = (typeof RESEED_CHECK_TABLES)[number]
export type DemoSeedSize = (typeof DEMO_SEED_SIZES)[number]

export type SeedDemoCliOptions = {
  countOverrides: DemoSeedCountOverrides
  dryRun: boolean
  help: boolean
  reseed: boolean
  seed: number
  size: DemoSeedSize
  yes: boolean
}

export type SeedDemoRowCounts = Record<SeededTableName, number>
export type ReseedTableCounts = Record<ReseedCheckTableName, number>
export type DemoSeedCountOverrides = {
  clients?: number
  projects?: number
  invoices?: number
}

export type DemoSettingsRow = {
  id: string
  businessName: string
  businessEmail: string
  businessPhone: string
  businessWebsite: string
  businessTaxId: string
  businessAddressLine1: string
  businessCity: string
  businessPostalCode: string
  businessCountry: string
  defaultCurrency: string
  defaultLocale: string
  defaultTimezone: string
  paymentTermsDays: number
  proposalValidityDays: number
  defaultNotesInvoice: string
  defaultNotesProposal: string
  invoicePrefix: string
  proposalPrefix: string
  creditNotePrefix: string
  nextInvoiceNumber: number
  nextProposalNumber: number
  nextCreditNoteNumber: number
  numberPaddingWidth: number
  emailFromName: string
  emailFromAddress: string
  reminderBeforeDueDays: number[]
  reminderAfterDueDays: number[]
  backupDestination: "local"
  backupCadence: "daily"
  backupRetentionDaily: number
  backupRetentionWeekly: number
  backupRetentionMonthly: number
  createdAt: Date
  updatedAt: Date
}

export type DemoClientRow = {
  id: string
  name: string
  email: string
  phone: string
  website: string
  taxId: string
  addressLine1: string
  city: string
  state: string | null
  postalCode: string
  country: string
  currency: string
  locale: string
  createdAt: Date
  updatedAt: Date
}

export type DemoProjectRow = {
  id: string
  clientId: string
  name: string
  description: string
  status: "active" | "completed" | "on_hold" | "cancelled"
  currency: string
  budgetCents: number
  hourlyRateCents: number
  startDate: Date
  endDate: Date | null
  createdAt: Date
  updatedAt: Date
}

export type DemoTaskRow = {
  id: string
  projectId: string
  title: string
  description: string
  status: "todo" | "doing" | "done"
  priority: "low" | "normal" | "high" | "urgent"
  dueAt: Date | null
  completedAt: Date | null
  position: number
  hourlyRateCents: number
  createdAt: Date
  updatedAt: Date
}

export type DemoTimeEntryRow = {
  id: string
  projectId: string
  taskId: string | null
  userId: string
  startedAt: Date
  endedAt: Date
  durationSeconds: number
  billable: boolean
  hourlyRateSnapshotCents: number
  description: string
  source: "manual"
  createdAt: Date
  updatedAt: Date
}

export type DemoExpenseRow = {
  id: string
  projectId: string
  clientId: string
  amountCents: number
  currency: string
  category: string
  description: string
  spentAt: Date
  rebillable: boolean
  markupPercentage: string | null
  createdAt: Date
  updatedAt: Date
}

export type DemoLeadRow = {
  id: string
  firstName: string
  lastName: string
  company: string
  email: string
  phone: string
  source: string
  status: "new" | "contacted" | "qualified" | "proposal_sent" | "won" | "lost"
  notes: string
  convertedAt: Date | null
  convertedToClientId: string | null
  lostReason: string | null
  createdAt: Date
  updatedAt: Date
}

export type DemoTaxRateRow = {
  id: string
  name: string
  percentage: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export type DemoProposalRow = {
  id: string
  projectId: string
  number: string
  status: "draft" | "sent" | "accepted" | "rejected"
  currency: string
  subtotalCents: number
  discountAmountTotalCents: number
  taxAmountCents: number
  totalCents: number
  validUntil: Date
  notes: string
  publicToken: string
  viewCount: number
  issuedAt: Date | null
  lockedAt: Date | null
  respondedAt: Date | null
  respondedIp: string | null
  rejectionReason: string | null
  createdAt: Date
  updatedAt: Date
}

export type DemoInvoiceRow = {
  id: string
  projectId: string | null
  clientId: string
  proposalId: string | null
  number: string
  status: "draft" | "sent" | "paid"
  currency: string
  subtotalCents: number
  discountAmountTotalCents: number
  taxAmountCents: number
  totalCents: number
  amountPaidCents: number
  issueDate: Date
  dueDate: Date
  paidAt: Date | null
  notes: string
  publicToken: string
  viewCount: number
  createdAt: Date
  updatedAt: Date
}

export type DemoLineItemRow = {
  id: string
  proposalId: string | null
  invoiceId: string | null
  creditNoteId: string | null
  taxRateId: string
  position: number
  description: string
  unit: string
  quantity: string
  unitPriceCents: number
  taxPercentageSnapshot: string
  subtotalCents: number
  taxAmountCents: number
  totalCents: number
  sourceTimeEntryId: string | null
  sourceExpenseId: string | null
  createdAt: Date
  updatedAt: Date
}

export type DemoPaymentRow = {
  id: string
  invoiceId: string
  method: "bank_transfer" | "stripe" | "cash" | "other"
  amountCents: number
  currency: string
  paidAt: Date
  reference: string
  notes: string
  createdAt: Date
  updatedAt: Date
}

export type DemoCreditNoteRow = {
  id: string
  invoiceId: string
  number: string
  reason: string
  currency: string
  subtotalCents: number
  taxAmountCents: number
  totalCents: number
  issuedAt: Date
  createdAt: Date
  updatedAt: Date
}

export type DemoContractRow = {
  id: string
  projectId: string
  clientId: string
  proposalId: string | null
  number: string
  title: string
  status: "draft" | "sent" | "signed" | "expired" | "terminated"
  blocks: { type: string; text: string }[]
  publicToken: string
  issuedAt: Date | null
  effectiveFrom: Date
  effectiveUntil: Date | null
  createdAt: Date
  updatedAt: Date
}

export type DemoRecurringInvoiceRow = {
  id: string
  clientId: string
  projectId: string | null
  name: string
  status: "active" | "paused" | "completed" | "cancelled"
  cadence: "weekly" | "monthly" | "quarterly" | "yearly"
  cadenceDay: number
  nextRunAt: Date
  lastRunAt: Date | null
  occurrencesGenerated: number
  autoSend: boolean
  currency: string
  lineItemsBlueprint: { description: string; quantity: string; unitPriceCents: number }[]
  includedHours: number | null
  overageRateCents: number | null
  notes: string
  createdAt: Date
  updatedAt: Date
}

export type DemoSeedPlan = {
  seed: number
  size: DemoSeedSize | "custom"
  presetSize: DemoSeedSize
  baseDate: Date
  settings: DemoSettingsRow
  taxRates: DemoTaxRateRow[]
  leads: DemoLeadRow[]
  clients: DemoClientRow[]
  projects: DemoProjectRow[]
  tasks: DemoTaskRow[]
  timeEntries: DemoTimeEntryRow[]
  expenses: DemoExpenseRow[]
  proposals: DemoProposalRow[]
  invoices: DemoInvoiceRow[]
  lineItems: DemoLineItemRow[]
  payments: DemoPaymentRow[]
  creditNotes: DemoCreditNoteRow[]
  contracts: DemoContractRow[]
  recurringInvoices: DemoRecurringInvoiceRow[]
  counts: SeedDemoRowCounts
}

type ParseArgsResult = { data: SeedDemoCliOptions } | { error: string }

type DemoSeedSizeProfile = {
  clientCount: number
  projectCount: number
  tasksPerProject: number
  timeEntriesPerProject: number
  leadCount: number
  proposalCount: number
  invoiceCount: number
  creditNoteCount: number
  contractCount: number
  recurringInvoiceCount: number
}

const demoSeedSizeProfiles: Record<DemoSeedSize, DemoSeedSizeProfile> = {
  small: {
    clientCount: 6,
    projectCount: 11,
    tasksPerProject: 2,
    timeEntriesPerProject: 2,
    leadCount: 6,
    proposalCount: 5,
    invoiceCount: 6,
    creditNoteCount: 1,
    contractCount: 2,
    recurringInvoiceCount: 2
  },
  medium: {
    clientCount: 12,
    projectCount: 22,
    tasksPerProject: 2,
    timeEntriesPerProject: 2,
    leadCount: 12,
    proposalCount: 10,
    invoiceCount: 12,
    creditNoteCount: 2,
    contractCount: 4,
    recurringInvoiceCount: 4
  },
  large: {
    clientCount: 24,
    projectCount: 44,
    tasksPerProject: 2,
    timeEntriesPerProject: 2,
    leadCount: 24,
    proposalCount: 20,
    invoiceCount: 24,
    creditNoteCount: 4,
    contractCount: 8,
    recurringInvoiceCount: 8
  }
}

type MarketProfile = {
  country: string
  currency: string
  locale: string
  city: string
  state: string | null
  postalCodeFormat: "us" | "pt" | "gb" | "de" | "fr"
  phonePrefix: string
  taxId: string
}

const marketProfiles: MarketProfile[] = [
  {
    country: "US",
    currency: "USD",
    locale: "en-US",
    city: "San Francisco",
    state: "CA",
    postalCodeFormat: "us",
    phonePrefix: "+1 415",
    taxId: "US"
  },
  {
    country: "PT",
    currency: "EUR",
    locale: "pt-PT",
    city: "Lisbon",
    state: null,
    postalCodeFormat: "pt",
    phonePrefix: "+351 21",
    taxId: "PT"
  },
  {
    country: "GB",
    currency: "GBP",
    locale: "en-GB",
    city: "London",
    state: null,
    postalCodeFormat: "gb",
    phonePrefix: "+44 20",
    taxId: "GB"
  },
  {
    country: "DE",
    currency: "EUR",
    locale: "de-DE",
    city: "Berlin",
    state: null,
    postalCodeFormat: "de",
    phonePrefix: "+49 30",
    taxId: "DE"
  },
  {
    country: "FR",
    currency: "EUR",
    locale: "fr-FR",
    city: "Paris",
    state: null,
    postalCodeFormat: "fr",
    phonePrefix: "+33 1",
    taxId: "FR"
  },
  {
    country: "US",
    currency: "USD",
    locale: "en-US",
    city: "New York",
    state: "NY",
    postalCodeFormat: "us",
    phonePrefix: "+1 212",
    taxId: "US"
  }
]

export function parseSeedDemoArgs(argv: string[]): ParseArgsResult {
  const options: SeedDemoCliOptions = {
    countOverrides: {},
    dryRun: false,
    help: false,
    reseed: false,
    seed: DEFAULT_DEMO_SEED,
    size: DEFAULT_DEMO_SEED_SIZE,
    yes: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--dry-run") {
      options.dryRun = true
      continue
    }

    if (arg === "--help") {
      options.help = true
      continue
    }

    if (arg === "--reseed") {
      options.reseed = true
      continue
    }

    if (arg === "--size") {
      const next = argv[index + 1]

      if (!next) return { error: `--size requires one of: ${DEMO_SEED_SIZES.join(", ")}.` }

      const numericSize = Number(next)

      if (Number.isInteger(numericSize)) {
        const parsedCount = parseBoundedCount({
          label: "--size",
          maximum: MAX_DEMO_SEED_CLIENTS,
          minimum: 1,
          value: next
        })

        if ("error" in parsedCount) return parsedCount

        options.countOverrides.clients = parsedCount.data
        index += 1
        continue
      }

      if (!isDemoSeedSize(next)) {
        return {
          error: `--size must be one of ${DEMO_SEED_SIZES.join(", ")} or a client count from 1 to ${MAX_DEMO_SEED_CLIENTS}.`
        }
      }

      options.size = next
      index += 1
      continue
    }

    if (arg === "--clients") {
      const parsedCount = parseCountOption(argv, index, {
        label: "--clients",
        maximum: MAX_DEMO_SEED_CLIENTS,
        minimum: 1
      })

      if ("error" in parsedCount) return parsedCount

      options.countOverrides.clients = parsedCount.data
      index += 1
      continue
    }

    if (arg === "--projects") {
      const parsedCount = parseCountOption(argv, index, {
        label: "--projects",
        maximum: MAX_DEMO_SEED_PROJECTS,
        minimum: 1
      })

      if ("error" in parsedCount) return parsedCount

      options.countOverrides.projects = parsedCount.data
      index += 1
      continue
    }

    if (arg === "--invoices") {
      const parsedCount = parseCountOption(argv, index, {
        label: "--invoices",
        maximum: MAX_DEMO_SEED_INVOICES,
        minimum: 0
      })

      if ("error" in parsedCount) return parsedCount

      options.countOverrides.invoices = parsedCount.data
      index += 1
      continue
    }

    if (arg === "--yes") {
      options.yes = true
      continue
    }

    if (arg === "--seed") {
      const next = argv[index + 1]

      if (!next) return { error: "--seed requires a number." }

      const seed = Number(next)

      if (!Number.isInteger(seed) || seed < 0) {
        return { error: "--seed must be a non-negative integer." }
      }

      options.seed = seed
      index += 1
      continue
    }

    return { error: `Unknown option: ${arg}` }
  }

  return { data: options }
}

export function buildDemoSeedPlan(
  seed: number,
  ownerUserId: string,
  size: DemoSeedSize = DEFAULT_DEMO_SEED_SIZE,
  countOverrides: DemoSeedCountOverrides = {}
): DemoSeedPlan {
  const baseDate = getBaseDate(seed)
  const profile = buildSeedSizeProfile(size, countOverrides)
  const planSize: DemoSeedPlan["size"] = hasSeedCountOverrides(countOverrides) ? "custom" : size

  faker.seed(seed)
  faker.setDefaultRefDate(baseDate)

  const createdAt = timestamp(baseDate, -45)
  const updatedAt = timestamp(baseDate, -2)

  const settings = buildSettings(seed, createdAt, updatedAt, profile)
  const taxRates = buildTaxRates(seed, createdAt, updatedAt)
  const clients = buildClients(seed, createdAt, updatedAt, profile)
  const projects = buildProjects(seed, clients, baseDate, createdAt, updatedAt, profile)
  const tasks = buildTasks(seed, projects, baseDate, createdAt, updatedAt, profile)
  const timeEntries = buildTimeEntries(
    seed,
    ownerUserId,
    projects,
    tasks,
    baseDate,
    createdAt,
    updatedAt,
    profile
  )
  const expenses = buildExpenses(seed, clients, projects, baseDate, createdAt, updatedAt)
  const leads = buildLeads(seed, clients, baseDate, createdAt, updatedAt, profile)
  const proposals = buildProposals(seed, projects, baseDate, createdAt, updatedAt, profile)
  const invoices = buildInvoices(
    seed,
    clients,
    projects,
    proposals,
    baseDate,
    createdAt,
    updatedAt,
    profile
  )
  const creditNotes = buildCreditNotes(seed, invoices, baseDate, createdAt, updatedAt, profile)
  const lineItems = buildLineItems(
    seed,
    taxRates,
    proposals,
    invoices,
    creditNotes,
    timeEntries,
    expenses,
    createdAt,
    updatedAt
  )
  const payments = buildPayments(seed, invoices, baseDate, createdAt, updatedAt)
  const contracts = buildContracts(
    seed,
    clients,
    projects,
    proposals,
    baseDate,
    createdAt,
    updatedAt,
    profile
  )
  const recurringInvoices = buildRecurringInvoices(
    seed,
    clients,
    projects,
    baseDate,
    createdAt,
    updatedAt,
    profile
  )

  return {
    seed,
    size: planSize,
    presetSize: size,
    baseDate,
    settings,
    taxRates,
    leads,
    clients,
    projects,
    tasks,
    timeEntries,
    expenses,
    proposals,
    invoices,
    lineItems,
    payments,
    creditNotes,
    contracts,
    recurringInvoices,
    counts: {
      settings: 1,
      tax_rates: taxRates.length,
      leads: leads.length,
      clients: clients.length,
      projects: projects.length,
      tasks: tasks.length,
      time_entries: timeEntries.length,
      expenses: expenses.length,
      proposals: proposals.length,
      invoices: invoices.length,
      line_items: lineItems.length,
      payments: payments.length,
      credit_notes: creditNotes.length,
      contracts: contracts.length,
      recurring_invoices: recurringInvoices.length
    }
  }
}

export function hasExistingSeedableRows(counts: ReseedTableCounts): boolean {
  return Object.values(counts).some((value) => value > 0)
}

type CountOptionConfig = {
  label: string
  maximum: number
  minimum: number
}

type CountParseResult = { data: number } | { error: string }

function parseCountOption(
  argv: string[],
  index: number,
  config: CountOptionConfig
): CountParseResult {
  const next = argv[index + 1]

  if (!next) {
    return { error: `${config.label} requires a number.` }
  }

  return parseBoundedCount({ ...config, value: next })
}

function parseBoundedCount(config: CountOptionConfig & { value: string }): CountParseResult {
  const count = Number(config.value)

  if (!Number.isInteger(count) || count < config.minimum || count > config.maximum) {
    return {
      error: `${config.label} must be an integer from ${config.minimum} to ${config.maximum}.`
    }
  }

  return { data: count }
}

function isDemoSeedSize(value: string): value is DemoSeedSize {
  return DEMO_SEED_SIZES.includes(value as DemoSeedSize)
}

function buildSeedSizeProfile(
  size: DemoSeedSize,
  countOverrides: DemoSeedCountOverrides
): DemoSeedSizeProfile {
  const base = demoSeedSizeProfiles[size]
  const clientCount = countOverrides.clients ?? base.clientCount
  const projectCount =
    countOverrides.projects ??
    (countOverrides.clients
      ? Math.min(clientCount * CUSTOM_PROJECTS_PER_CLIENT, MAX_DEMO_SEED_PROJECTS)
      : base.projectCount)
  const invoiceCount =
    countOverrides.invoices ??
    (countOverrides.clients || countOverrides.projects
      ? Math.min(projectCount * CUSTOM_INVOICES_PER_PROJECT, MAX_DEMO_SEED_INVOICES)
      : base.invoiceCount)

  return {
    clientCount,
    projectCount,
    tasksPerProject: base.tasksPerProject,
    timeEntriesPerProject: base.timeEntriesPerProject,
    leadCount: Math.max(base.leadCount, clientCount),
    proposalCount: Math.min(
      Math.max(base.proposalCount, Math.ceil(projectCount * 0.45)),
      projectCount
    ),
    invoiceCount,
    creditNoteCount: Math.min(
      Math.max(base.creditNoteCount, Math.ceil(invoiceCount / 6)),
      invoiceCount
    ),
    contractCount: Math.min(Math.max(base.contractCount, Math.ceil(clientCount / 3)), projectCount),
    recurringInvoiceCount: Math.min(
      Math.max(base.recurringInvoiceCount, Math.ceil(clientCount / 3)),
      clientCount
    )
  }
}

function hasSeedCountOverrides(countOverrides: DemoSeedCountOverrides): boolean {
  return Object.values(countOverrides).some((value) => value !== undefined)
}

function buildSettings(
  seed: number,
  createdAt: Date,
  updatedAt: Date,
  profile: DemoSeedSizeProfile
): DemoSettingsRow {
  return {
    id: deterministicUuid(seed, "settings", 0),
    businessName: "Remit Demo Studio",
    businessEmail: "hello@remit-demo.example",
    businessPhone: "+351 21 555 0101",
    businessWebsite: "https://remit-demo.example",
    businessTaxId: "PT-515204883",
    businessAddressLine1: "Avenida da Liberdade 110",
    businessCity: "Lisbon",
    businessPostalCode: "1250-146",
    businessCountry: "PT",
    defaultCurrency: "EUR",
    defaultLocale: "en",
    defaultTimezone: "Europe/Lisbon",
    paymentTermsDays: 30,
    proposalValidityDays: 21,
    defaultNotesInvoice: "Thank you for your business. Payment is due by the date shown above.",
    defaultNotesProposal: "This proposal is valid for 21 days and can be adjusted after review.",
    invoicePrefix: "INV-",
    proposalPrefix: "PROP-",
    creditNotePrefix: "CN-",
    nextInvoiceNumber: profile.invoiceCount + 1,
    nextProposalNumber: profile.proposalCount + 1,
    nextCreditNoteNumber: profile.creditNoteCount + 1,
    numberPaddingWidth: 4,
    emailFromName: "Remit Demo Studio",
    emailFromAddress: "hello@remit-demo.example",
    reminderBeforeDueDays: [3, 0],
    reminderAfterDueDays: [7, 14, 30],
    backupDestination: "local",
    backupCadence: "daily",
    backupRetentionDaily: 7,
    backupRetentionWeekly: 4,
    backupRetentionMonthly: 12,
    createdAt,
    updatedAt
  }
}

function buildTaxRates(seed: number, createdAt: Date, updatedAt: Date): DemoTaxRateRow[] {
  return [
    {
      id: deterministicUuid(seed, "tax-rate", 0),
      name: "Standard VAT",
      percentage: "23.00",
      isDefault: true,
      createdAt,
      updatedAt
    },
    {
      id: deterministicUuid(seed, "tax-rate", 1),
      name: "Reduced VAT",
      percentage: "6.00",
      isDefault: false,
      createdAt,
      updatedAt
    },
    {
      id: deterministicUuid(seed, "tax-rate", 2),
      name: "Zero rated",
      percentage: "0.00",
      isDefault: false,
      createdAt,
      updatedAt
    }
  ]
}

function buildClients(
  seed: number,
  createdAt: Date,
  updatedAt: Date,
  profile: DemoSeedSizeProfile
): DemoClientRow[] {
  return Array.from({ length: profile.clientCount }, (_, index) => {
    const market = marketProfileAt(index)
    const name = faker.company.name()
    const slug = faker.helpers.slugify(name).toLowerCase()

    return {
      id: deterministicUuid(seed, "client", index),
      name,
      email:
        profile.clientCount > marketProfiles.length
          ? `billing-${String(index + 1).padStart(4, "0")}@${slug}.example`
          : `billing@${slug}.example`,
      phone: `${market.phonePrefix} 555 ${String(1000 + faker.number.int({ min: 0, max: 8999 })).padStart(4, "0")}`,
      website: `https://${slug}.example`,
      taxId: `${market.taxId}-${faker.string.numeric(market.taxId === "US" ? 9 : 8)}`,
      addressLine1: faker.location.streetAddress(),
      city: market.city,
      state: market.state,
      postalCode: postalCodeForMarket(market.postalCodeFormat),
      country: market.country,
      currency: market.currency,
      locale: market.locale,
      createdAt: timestamp(createdAt, index),
      updatedAt
    }
  })
}

function marketProfileAt(index: number): MarketProfile {
  const market = marketProfiles[index % marketProfiles.length]

  if (!market) {
    throw new Error("Demo seed market profile inventory is empty.")
  }

  return market
}

function buildProjects(
  seed: number,
  clients: DemoClientRow[],
  baseDate: Date,
  createdAt: Date,
  updatedAt: Date,
  profile: DemoSeedSizeProfile
): DemoProjectRow[] {
  const statuses: DemoProjectRow["status"][] = [
    "active",
    "active",
    "completed",
    "on_hold",
    "cancelled"
  ]
  const rows: DemoProjectRow[] = []
  let clientIndex = 0

  while (rows.length < profile.projectCount) {
    const client = clients[clientIndex % clients.length]

    if (!client) break

    const rowIndex = rows.length
    const status = statuses[rowIndex % statuses.length]
    const startDate = dateOnly(baseDate, -150 + rowIndex * 12)
    const endDate =
      status === "completed" || status === "cancelled" ? dateOnly(startDate, 56) : null

    rows.push({
      id: deterministicUuid(seed, "project", rowIndex),
      clientId: client.id,
      name: projectName(client.name, rowIndex),
      description: faker.company.catchPhrase(),
      status,
      currency: client.currency,
      budgetCents: 450_000 + rowIndex * 85_000,
      hourlyRateCents: 9_500 + (rowIndex % 4) * 1_500,
      startDate,
      endDate,
      createdAt: timestamp(createdAt, rowIndex),
      updatedAt
    })
    clientIndex += 1
  }

  return rows
}

function buildTasks(
  seed: number,
  projects: DemoProjectRow[],
  baseDate: Date,
  createdAt: Date,
  updatedAt: Date,
  profile: DemoSeedSizeProfile
): DemoTaskRow[] {
  const titles = [
    "Discovery workshop",
    "Wireframe review",
    "Implementation sprint",
    "Launch checklist"
  ]
  const statuses: DemoTaskRow["status"][] = ["done", "doing", "todo", "todo"]
  const priorities: DemoTaskRow["priority"][] = ["normal", "high", "normal", "low"]

  return projects.flatMap((project, projectIndex) =>
    Array.from({ length: profile.tasksPerProject }, (_, taskIndex) => {
      const rowIndex = projectIndex * profile.tasksPerProject + taskIndex
      const status = statuses[(projectIndex + taskIndex) % statuses.length]

      return {
        id: deterministicUuid(seed, "task", rowIndex),
        projectId: project.id,
        title: titles[(projectIndex + taskIndex) % titles.length] ?? "Project task",
        description: faker.lorem.sentence({ min: 6, max: 10 }),
        status,
        priority: priorities[(projectIndex + taskIndex) % priorities.length] ?? "normal",
        dueAt: status === "done" ? null : timestamp(baseDate, 5 + rowIndex),
        completedAt: status === "done" ? timestamp(baseDate, -12 + rowIndex) : null,
        position: taskIndex,
        hourlyRateCents: project.hourlyRateCents,
        createdAt: timestamp(createdAt, rowIndex),
        updatedAt
      }
    })
  )
}

function buildTimeEntries(
  seed: number,
  ownerUserId: string,
  projects: DemoProjectRow[],
  tasks: DemoTaskRow[],
  baseDate: Date,
  createdAt: Date,
  updatedAt: Date,
  profile: DemoSeedSizeProfile
): DemoTimeEntryRow[] {
  return projects.flatMap((project, projectIndex) =>
    Array.from({ length: profile.timeEntriesPerProject }, (_, entryIndex) => {
      const rowIndex = projectIndex * profile.timeEntriesPerProject + entryIndex
      const durationSeconds = (2 + ((projectIndex + entryIndex) % 4)) * 3_600
      const startedAt = timestamp(baseDate, -30 + rowIndex, 9 + entryIndex)
      const task = tasks.find((candidate) => candidate.projectId === project.id) ?? null

      return {
        id: deterministicUuid(seed, "time-entry", rowIndex),
        projectId: project.id,
        taskId: entryIndex === 0 ? (task?.id ?? null) : null,
        userId: ownerUserId,
        startedAt,
        endedAt: new Date(startedAt.getTime() + durationSeconds * 1000),
        durationSeconds,
        billable: project.status !== "cancelled",
        hourlyRateSnapshotCents: project.hourlyRateCents,
        description: timeEntryDescription(rowIndex),
        source: "manual",
        createdAt: timestamp(createdAt, rowIndex),
        updatedAt
      }
    })
  )
}

function buildExpenses(
  seed: number,
  clients: DemoClientRow[],
  projects: DemoProjectRow[],
  baseDate: Date,
  createdAt: Date,
  updatedAt: Date
): DemoExpenseRow[] {
  const categories = ["Software", "Travel", "Research", "Hosting", "Contractor"]

  return projects.map((project, index) => {
    const client = clients.find((candidate) => candidate.id === project.clientId)
    const amountCents = 4_500 + (index % 6) * 3_250

    return {
      id: deterministicUuid(seed, "expense", index),
      projectId: project.id,
      clientId: project.clientId,
      amountCents,
      currency: project.currency,
      category: categories[index % categories.length] ?? "Software",
      description: `${faker.commerce.productName()} subscription`,
      spentAt: dateOnly(baseDate, -42 + index * 3),
      rebillable: Boolean(client) && index % 3 === 0,
      markupPercentage: index % 3 === 0 ? "10.00" : null,
      createdAt: timestamp(createdAt, index),
      updatedAt
    }
  })
}

function buildLeads(
  seed: number,
  clients: DemoClientRow[],
  baseDate: Date,
  createdAt: Date,
  updatedAt: Date,
  profile: DemoSeedSizeProfile
): DemoLeadRow[] {
  const statuses: DemoLeadRow["status"][] = [
    "new",
    "contacted",
    "qualified",
    "proposal_sent",
    "lost",
    "won"
  ]

  return Array.from({ length: profile.leadCount }, (_, index) => {
    const firstName = faker.person.firstName()
    const lastName = faker.person.lastName()
    const status = statuses[index % statuses.length] ?? "new"
    const wonClient = status === "won" ? clients[0] : null

    return {
      id: deterministicUuid(seed, "lead", index),
      firstName,
      lastName,
      company: faker.company.name(),
      email: faker.internet.email({ firstName, lastName, provider: "example" }).toLowerCase(),
      phone: faker.phone.number({ style: "international" }),
      source:
        ["Referral", "Website", "Conference", "LinkedIn", "Partner", "Newsletter"][index] ??
        "Referral",
      status,
      notes: faker.lorem.sentence({ min: 8, max: 14 }),
      convertedAt: wonClient ? timestamp(baseDate, -18) : null,
      convertedToClientId: wonClient?.id ?? null,
      lostReason: status === "lost" ? "Budget deferred until next quarter" : null,
      createdAt: timestamp(createdAt, index),
      updatedAt
    }
  })
}

function buildProposals(
  seed: number,
  projects: DemoProjectRow[],
  baseDate: Date,
  createdAt: Date,
  updatedAt: Date,
  profile: DemoSeedSizeProfile
): DemoProposalRow[] {
  const statuses: DemoProposalRow["status"][] = ["draft", "sent", "accepted", "rejected", "sent"]

  return Array.from({ length: profile.proposalCount }, (_, index) => {
    const project = projects[index % projects.length]

    if (!project) {
      throw new Error("Demo seed requires at least one project before proposals are generated.")
    }

    const status = statuses[index % statuses.length] ?? "draft"
    const subtotalCents = 180_000 + index * 55_000
    const taxAmountCents = Math.round(subtotalCents * 0.23)
    const respondedAt =
      status === "accepted" || status === "rejected" ? timestamp(baseDate, -10 + index) : null

    return {
      id: deterministicUuid(seed, "proposal", index),
      projectId: project.id,
      number: `PROP-${String(index + 1).padStart(4, "0")}`,
      status,
      currency: project.currency,
      subtotalCents,
      discountAmountTotalCents: 0,
      taxAmountCents,
      totalCents: subtotalCents + taxAmountCents,
      validUntil: dateOnly(baseDate, 21 + index),
      notes: "Prepared for review; scope can be adjusted before acceptance.",
      publicToken: deterministicToken(seed, "proposal", index),
      viewCount: status === "draft" ? 0 : 2 + index,
      issuedAt: status === "draft" ? null : timestamp(baseDate, -15 + index),
      lockedAt: status === "accepted" ? respondedAt : null,
      respondedAt,
      respondedIp: respondedAt ? `192.0.2.${10 + index}` : null,
      rejectionReason:
        status === "rejected" ? "Timing does not align with the launch window" : null,
      createdAt: timestamp(createdAt, index),
      updatedAt
    }
  })
}

function buildInvoices(
  seed: number,
  clients: DemoClientRow[],
  projects: DemoProjectRow[],
  proposals: DemoProposalRow[],
  baseDate: Date,
  createdAt: Date,
  updatedAt: Date,
  profile: DemoSeedSizeProfile
): DemoInvoiceRow[] {
  const statuses: DemoInvoiceRow["status"][] = ["draft", "sent", "paid", "sent", "paid", "draft"]

  return Array.from({ length: profile.invoiceCount }, (_, index) => {
    const project = projects[index % projects.length]

    if (!project) {
      throw new Error("Demo seed requires at least one project before invoices are generated.")
    }

    const status = statuses[index % statuses.length] ?? "draft"
    const proposal =
      index === 2 ? (proposals.find((candidate) => candidate.status === "accepted") ?? null) : null
    const subtotalCents = 95_000 + index * 42_500
    const taxAmountCents = Math.round(subtotalCents * 0.23)
    const totalCents = subtotalCents + taxAmountCents
    const paidAt = status === "paid" ? timestamp(baseDate, -5 + index) : null
    const client = clients.find((candidate) => candidate.id === project.clientId)

    return {
      id: deterministicUuid(seed, "invoice", index),
      projectId: project.id,
      clientId: project.clientId,
      proposalId: proposal?.id ?? null,
      number: `INV-${String(index + 1).padStart(4, "0")}`,
      status,
      currency: client?.currency ?? project.currency,
      subtotalCents,
      discountAmountTotalCents: 0,
      taxAmountCents,
      totalCents,
      amountPaidCents: status === "paid" ? totalCents : 0,
      issueDate: dateOnly(baseDate, -20 + index * 4),
      dueDate: dateOnly(baseDate, 10 + index * 4),
      paidAt,
      notes: "Payment by bank transfer is preferred for this demo invoice.",
      publicToken: deterministicToken(seed, "invoice", index),
      viewCount: status === "draft" ? 0 : 1 + index,
      createdAt: timestamp(createdAt, index),
      updatedAt
    }
  })
}

function buildCreditNotes(
  seed: number,
  invoices: DemoInvoiceRow[],
  baseDate: Date,
  createdAt: Date,
  updatedAt: Date,
  profile: DemoSeedSizeProfile
): DemoCreditNoteRow[] {
  return invoices
    .filter((candidate) => candidate.status === "paid")
    .slice(0, profile.creditNoteCount)
    .map((invoice, index) => ({
      id: deterministicUuid(seed, "credit-note", index),
      invoiceId: invoice.id,
      number: `CN-${String(index + 1).padStart(4, "0")}`,
      reason: "Courtesy adjustment for unused workshop hours",
      currency: invoice.currency,
      subtotalCents: 15_000 + index * 2_500,
      taxAmountCents: Math.round((15_000 + index * 2_500) * 0.23),
      totalCents: 15_000 + index * 2_500 + Math.round((15_000 + index * 2_500) * 0.23),
      issuedAt: timestamp(baseDate, -1 + index),
      createdAt: timestamp(createdAt, index),
      updatedAt
    }))
}

function buildLineItems(
  seed: number,
  taxRates: DemoTaxRateRow[],
  proposals: DemoProposalRow[],
  invoices: DemoInvoiceRow[],
  creditNotes: DemoCreditNoteRow[],
  timeEntries: DemoTimeEntryRow[],
  expenses: DemoExpenseRow[],
  createdAt: Date,
  updatedAt: Date
): DemoLineItemRow[] {
  const standardTax = taxRates[0]
  const zeroTax = taxRates[2]
  const rows: DemoLineItemRow[] = []

  proposals.forEach((proposal, index) => {
    rows.push(
      buildLineItem({
        seed,
        index: rows.length,
        proposalId: proposal.id,
        invoiceId: null,
        creditNoteId: null,
        taxRateId: standardTax.id,
        position: 0,
        description: "Discovery, planning, and technical direction",
        unit: "project",
        quantity: "1.00",
        unitPriceCents: Math.round(proposal.subtotalCents * 0.55),
        taxPercentageSnapshot: standardTax.percentage,
        sourceTimeEntryId: null,
        sourceExpenseId: null,
        createdAt: timestamp(createdAt, index),
        updatedAt
      }),
      buildLineItem({
        seed,
        index: rows.length + 1,
        proposalId: proposal.id,
        invoiceId: null,
        creditNoteId: null,
        taxRateId: standardTax.id,
        position: 1,
        description: "Implementation and launch support",
        unit: "project",
        quantity: "1.00",
        unitPriceCents: proposal.subtotalCents - Math.round(proposal.subtotalCents * 0.55),
        taxPercentageSnapshot: standardTax.percentage,
        sourceTimeEntryId: null,
        sourceExpenseId: null,
        createdAt: timestamp(createdAt, index),
        updatedAt
      })
    )
  })

  invoices.forEach((invoice, index) => {
    const sourceTimeEntry = timeEntries[index] ?? null
    const sourceExpense =
      expenses.find((expense) => expense.projectId === invoice.projectId) ?? null

    rows.push(
      buildLineItem({
        seed,
        index: rows.length,
        proposalId: null,
        invoiceId: invoice.id,
        creditNoteId: null,
        taxRateId: standardTax.id,
        position: 0,
        description: "Professional services",
        unit: "hours",
        quantity: "8.00",
        unitPriceCents: Math.round(invoice.subtotalCents * 0.75) / 8,
        taxPercentageSnapshot: standardTax.percentage,
        sourceTimeEntryId: sourceTimeEntry?.id ?? null,
        sourceExpenseId: null,
        createdAt: timestamp(createdAt, index),
        updatedAt
      }),
      buildLineItem({
        seed,
        index: rows.length + 1,
        proposalId: null,
        invoiceId: invoice.id,
        creditNoteId: null,
        taxRateId: zeroTax.id,
        position: 1,
        description: "Reimbursable tools and hosting",
        unit: "item",
        quantity: "1.00",
        unitPriceCents: invoice.subtotalCents - Math.round(invoice.subtotalCents * 0.75),
        taxPercentageSnapshot: zeroTax.percentage,
        sourceTimeEntryId: null,
        sourceExpenseId: sourceExpense?.id ?? null,
        createdAt: timestamp(createdAt, index),
        updatedAt
      })
    )
  })

  creditNotes.forEach((creditNote) => {
    rows.push(
      buildLineItem({
        seed,
        index: rows.length,
        proposalId: null,
        invoiceId: null,
        creditNoteId: creditNote.id,
        taxRateId: standardTax.id,
        position: 0,
        description: "Unused workshop hours adjustment",
        unit: "hours",
        quantity: "2.00",
        unitPriceCents: 7_500,
        taxPercentageSnapshot: standardTax.percentage,
        sourceTimeEntryId: null,
        sourceExpenseId: null,
        createdAt,
        updatedAt
      })
    )
  })

  return rows
}

type BuildLineItemInput = Omit<
  DemoLineItemRow,
  "id" | "subtotalCents" | "taxAmountCents" | "totalCents"
> & {
  seed: number
  index: number
}

function buildLineItem(input: BuildLineItemInput): DemoLineItemRow {
  const quantity = Number(input.quantity)
  const taxPercentage = Number(input.taxPercentageSnapshot)
  const subtotalCents = Math.round(quantity * input.unitPriceCents)
  const taxAmountCents = Math.round((subtotalCents * taxPercentage) / 100)

  return {
    id: deterministicUuid(input.seed, "line-item", input.index),
    proposalId: input.proposalId,
    invoiceId: input.invoiceId,
    creditNoteId: input.creditNoteId,
    taxRateId: input.taxRateId,
    position: input.position,
    description: input.description,
    unit: input.unit,
    quantity: input.quantity,
    unitPriceCents: Math.round(input.unitPriceCents),
    taxPercentageSnapshot: input.taxPercentageSnapshot,
    subtotalCents,
    taxAmountCents,
    totalCents: subtotalCents + taxAmountCents,
    sourceTimeEntryId: input.sourceTimeEntryId,
    sourceExpenseId: input.sourceExpenseId,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt
  }
}

function buildPayments(
  seed: number,
  invoices: DemoInvoiceRow[],
  baseDate: Date,
  createdAt: Date,
  updatedAt: Date
): DemoPaymentRow[] {
  return invoices
    .filter((invoice) => invoice.status === "paid")
    .map((invoice, index) => ({
      id: deterministicUuid(seed, "payment", index),
      invoiceId: invoice.id,
      method: index % 2 === 0 ? "bank_transfer" : "cash",
      amountCents: invoice.totalCents,
      currency: invoice.currency,
      paidAt: timestamp(baseDate, -5 + index),
      reference: `DEMO-PAY-${String(index + 1).padStart(3, "0")}`,
      notes: "Demo payment recorded manually.",
      createdAt: timestamp(createdAt, index),
      updatedAt
    }))
}

function buildContracts(
  seed: number,
  clients: DemoClientRow[],
  projects: DemoProjectRow[],
  proposals: DemoProposalRow[],
  baseDate: Date,
  createdAt: Date,
  updatedAt: Date,
  profile: DemoSeedSizeProfile
): DemoContractRow[] {
  const statuses: DemoContractRow["status"][] = ["sent", "draft", "signed", "expired"]

  return projects.slice(0, profile.contractCount).map((project, index) => {
    const client = clients.find((candidate) => candidate.id === project.clientId)
    const proposal = proposals[index] ?? null
    const status = statuses[index % statuses.length] ?? "draft"

    return {
      id: deterministicUuid(seed, "contract", index),
      projectId: project.id,
      clientId: project.clientId,
      proposalId: proposal?.id ?? null,
      number: `CTR-${String(index + 1).padStart(4, "0")}`,
      title: `${client?.name ?? "Client"} service agreement`,
      status,
      blocks: [
        { type: "heading", text: "Scope of work" },
        {
          type: "paragraph",
          text: "The consultant will provide the services described in the approved proposal."
        }
      ],
      publicToken: deterministicToken(seed, "contract", index),
      issuedAt: status === "draft" ? null : timestamp(baseDate, -8 + index),
      effectiveFrom: dateOnly(baseDate, -7 + index),
      effectiveUntil: dateOnly(baseDate, 90 + index * 30),
      createdAt: timestamp(createdAt, index),
      updatedAt
    }
  })
}

function buildRecurringInvoices(
  seed: number,
  clients: DemoClientRow[],
  projects: DemoProjectRow[],
  baseDate: Date,
  createdAt: Date,
  updatedAt: Date,
  profile: DemoSeedSizeProfile
): DemoRecurringInvoiceRow[] {
  const names = ["Monthly advisory retainer", "Quarterly reporting package", "Weekly support block"]
  const cadences: DemoRecurringInvoiceRow["cadence"][] = ["monthly", "quarterly", "weekly"]
  const statuses: DemoRecurringInvoiceRow["status"][] = ["active", "paused", "active", "completed"]

  return clients.slice(0, profile.recurringInvoiceCount).map((client, index) => {
    const project = projects.find((candidate) => candidate.clientId === client.id) ?? null
    const cadence = cadences[index % cadences.length] ?? "monthly"
    const status = statuses[index % statuses.length] ?? "active"

    return {
      id: deterministicUuid(seed, "recurring-invoice", index),
      clientId: client.id,
      projectId: project?.id ?? null,
      name: names[index % names.length] ?? "Monthly advisory retainer",
      status,
      cadence,
      cadenceDay: 1,
      nextRunAt: dateOnly(baseDate, 14 + index * 30),
      lastRunAt: index === 0 ? dateOnly(baseDate, -16) : null,
      occurrencesGenerated: index === 0 ? 3 : 1,
      autoSend: false,
      currency: client.currency,
      lineItemsBlueprint: [
        {
          description: "Retainer services",
          quantity: "1.00",
          unitPriceCents: index === 0 ? 240_000 : 390_000
        }
      ],
      includedHours: index === 0 ? 12 : null,
      overageRateCents: index === 0 ? 12_500 : null,
      notes: "Demo recurring invoice schedule.",
      createdAt: timestamp(createdAt, index),
      updatedAt
    }
  })
}

function getBaseDate(seed: number): Date {
  const offsetDays = seed % 365

  return new Date(Date.UTC(BASE_YEAR, 0, 1 + offsetDays, 12, 0, 0, 0))
}

function timestamp(date: Date, offsetDays: number, hour = 12): Date {
  const next = new Date(date.getTime() + offsetDays * DAY_MS)

  return new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate(), hour, 0, 0, 0)
  )
}

function dateOnly(date: Date, offsetDays: number): Date {
  const next = new Date(date.getTime() + offsetDays * DAY_MS)

  return new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate(), 0, 0, 0, 0)
  )
}

function deterministicUuid(seed: number, namespace: string, index: number): string {
  const bytes = Buffer.from(
    createHash("sha256").update(`${seed}:${namespace}:${index}`).digest().subarray(0, 16)
  )

  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = bytes.toString("hex")

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function deterministicToken(seed: number, namespace: string, index: number): string {
  return createHash("sha256").update(`remit-demo:${seed}:${namespace}:${index}`).digest("base64url")
}

function projectName(clientName: string, index: number): string {
  const suffixes = [
    "client portal refresh",
    "billing automation rollout",
    "analytics dashboard",
    "brand operations sprint",
    "retainer support"
  ]

  return `${clientName} ${suffixes[index % suffixes.length]}`
}

function timeEntryDescription(index: number): string {
  const descriptions = [
    "Mapped invoice workflow edge cases",
    "Prepared client review notes",
    "Implemented dashboard data cleanup",
    "Reviewed launch blockers",
    "Refined proposal scope",
    "Documented handoff tasks"
  ]

  return descriptions[index % descriptions.length] ?? "Completed project work"
}

function postalCodeForMarket(format: MarketProfile["postalCodeFormat"]): string {
  switch (format) {
    case "us":
      return faker.location.zipCode("#####")
    case "pt":
      return `${faker.string.numeric(4)}-${faker.string.numeric(3)}`
    case "gb":
      return `${faker.string.alpha({ length: 1, casing: "upper" })}${faker.string.numeric(1)} ${faker.string.numeric(1)}${faker.string.alpha({ length: 2, casing: "upper" })}`
    case "de":
    case "fr":
      return faker.string.numeric(5)
  }
}
