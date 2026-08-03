import { type InvoiceFormInputValues, type InvoiceStatus, type InvoiceViewStatus } from "./schemas"
import { type InvoicesSummaryResult } from "./services"

export type InvoiceDefaults = {
  defaultCurrency: string
  defaultLocale: string
  defaultTimezone: string
  paymentTermsDays: number
  defaultNotesInvoice: string
}

export type InvoiceTaxRateOption = {
  id: string
  name: string
  percentage: number
  isDefault: boolean
}

export type InvoiceTemplateOption = {
  id: string
  name: string
}

// Every field a computed status needs travels with the row. `deriveInvoiceStatusView` is pure, so a
// list that omitted `amountPaidCents` or `paidAt` would silently render `sent` where the invoice is
// really overdue or partially paid.
export type InvoiceListItem = {
  id: string
  projectId: string | null
  number: string
  status: InvoiceStatus
  currency: string
  totalCents: number
  amountPaidCents: number
  issueDate: Date | null
  dueDate: Date | null
  paidAt: Date | null
  createdAt: Date
}

export type InvoiceListPageData = {
  projectId: string
  projectName: string
  currency: string
  invoices: InvoiceListItem[]
  summary: InvoicesSummaryResult
  defaults: InvoiceDefaults
}

// The instance-wide row. Unlike `InvoiceListItem` it carries `viewStatus` already derived rather than
// the fields to derive it from: the overview's status filter runs in SQL, so the server must pick the
// instant the rule is evaluated against, and the badge has to agree with the filter that selected the
// row. `parentLabel` is the project name when the invoice has one and the client name otherwise —
// `chk_invoices_parent` guarantees at least one of them exists.
export type InvoiceOverviewItem = {
  id: string
  number: string
  status: InvoiceStatus
  viewStatus: InvoiceViewStatus
  currency: string
  totalCents: number
  amountPaidCents: number
  outstandingCents: number
  issueDate: Date | null
  dueDate: Date | null
  paidAt: Date | null
  createdAt: Date
  parentLabel: string
  projectId: string | null
  clientId: string | null
  clientName: string
}

export type InvoiceOverviewClientOption = {
  id: string
  name: string
}

export type InvoiceOverviewFilterOptions = {
  clients: InvoiceOverviewClientOption[]
}

export type InvoiceOverviewPageData = {
  invoices: InvoiceOverviewItem[]
  rowCount: number
  summary: InvoicesSummaryResult
  filterOptions: InvoiceOverviewFilterOptions
  defaults: InvoiceDefaults
}

export type InvoiceDetailLineItem = {
  id: string
  position: number
  description: string
  unit: string
  quantity: number
  unitPriceCents: number
  discountPercentage: number | null
  discountAmountCents: number | null
  taxPercentage: number
  subtotalCents: number
  taxAmountCents: number
  totalCents: number
}

export type InvoiceDetail = {
  id: string
  projectId: string | null
  projectName: string
  clientId: string | null
  clientName: string
  proposalId: string | null
  number: string
  status: InvoiceStatus
  currency: string
  subtotalCents: number
  discountAmountTotalCents: number
  taxAmountCents: number
  totalCents: number
  amountPaidCents: number
  discountPercentage: number | null
  discountAmountCents: number | null
  issueDate: Date | null
  dueDate: Date | null
  paidAt: Date | null
  notes: string
  viewCount: number
  templateName: string | null
  // Null until the invoice is sent. The token exists from creation (the column is NOT NULL), but no
  // read model may carry it before `issueDate` is set — see `getInvoiceDetail` in queries.ts.
  publicPath: string | null
  lineItems: InvoiceDetailLineItem[]
  defaults: InvoiceDefaults
}

export type PublicInvoiceIssuer = {
  name: string
  email: string | null
}

// The payment affordances an anonymous holder may see. It is `PublicPaymentBlock` from
// `@/features/settings/server` flattened onto the invoice, so the page never has to know that the
// two come from different tables. `stripeConfigured` is a boolean and never a key.
export type PublicInvoicePayment = {
  bankName: string | null
  ibanDisplay: string | null
  instructions: string | null
  hasBankTransferDetails: boolean
  stripeConfigured: boolean
}

// Carries neither `id` nor `publicToken`: this model is serialized into an anonymous page, and the
// token is a bearer credential. `viewStatus` is derived server-side so the badge cannot disagree
// with the amounts printed beside it.
export type PublicInvoice = {
  number: string
  status: InvoiceStatus
  viewStatus: InvoiceViewStatus
  currency: string
  subtotalCents: number
  discountAmountTotalCents: number
  taxAmountCents: number
  totalCents: number
  amountPaidCents: number
  outstandingCents: number
  issueDate: Date | null
  dueDate: Date | null
  paidAt: Date | null
  notes: string
  preparedFor: string
  issuer: PublicInvoiceIssuer
  locale: string
  timeZone: string
  payment: PublicInvoicePayment
  lineItems: InvoiceDetailLineItem[]
}

export type InvoiceFormData = InvoiceFormInputValues & {
  id: string
  number: string
  status: InvoiceStatus
}

// The action result shapes live here rather than in mutations.ts so conversion.ts and
// mutationContext.ts can name them without importing a "use server" module.
export type InvoiceMutationResult = { data: { invoice: InvoiceFormData } } | { error: string }

export type SendInvoiceResult = { data: { id: string } } | { error: string }

export type MarkInvoicePaidResult = { data: { id: string } } | { error: string }

export type DeleteInvoiceResult = { data: { id: string } } | { error: string }

// An accepted proposal that has not been turned into an invoice yet. `totalCents` and `currency`
// travel with it so the conversion dialog can show what the invoice will be worth before the write.
export type ConvertibleProposalOption = {
  id: string
  number: string
  currency: string
  totalCents: number
}

// Feature-internal: the conversion path's authoritative copy of an accepted proposal, read straight
// from the tables rather than through a form, so the invoice cannot be seeded with numbers the
// client never accepted. `taxPercentage` is the proposal line's stored snapshot and is carried over
// verbatim — re-reading `tax_rates` here would let a rate edited after acceptance move the invoice
// (ADR-0017). Not exported from index.ts or server.ts: only mutations.ts consumes it.
export type ProposalInvoiceSnapshotLine = {
  description: string
  unit: string | null
  quantity: string
  unitPriceCents: number
  discountType: "percentage" | "fixed" | null
  discountPercentage: string | null
  discountAmountCents: number | null
  taxRateId: string | null
  taxPercentage: number
}

export type ProposalInvoiceSnapshot = {
  id: string
  projectId: string
  clientId: string | null
  currency: string
  notes: string | null
  discountType: "percentage" | "fixed" | null
  discountPercentage: string | null
  discountAmountCents: number | null
  lineItems: ProposalInvoiceSnapshotLine[]
}

export type InvoiceEditorData = {
  projectId: string
  projectName: string
  defaults: InvoiceDefaults
  taxRates: InvoiceTaxRateOption[]
  templates: InvoiceTemplateOption[]
}
