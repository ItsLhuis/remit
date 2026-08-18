import { type ReseedCheckTableName, type SeededTableName } from "../domainData/inventory"

import { type DEMO_SEED_SIZES } from "./inventory"

export type DemoSeedSize = (typeof DEMO_SEED_SIZES)[number]

export type DemoSeedCountOverrides = {
  clients?: number
  projects?: number
  invoices?: number
}

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
  status: "backlog" | "todo" | "in_progress" | "done" | "cancelled"
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
