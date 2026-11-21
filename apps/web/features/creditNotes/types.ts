import { type CreditNotesSummaryResult } from "./services"

export type CreditNoteDefaults = {
  defaultCurrency: string
  defaultLocale: string
  defaultTimezone: string
}

export type CreditNoteTaxRateOption = {
  id: string
  name: string
  percentage: number
  isDefault: boolean
}

// One credit note as the invoice detail surface lists it. `totalCents` is what the effective
// receivable is derived from, so it travels on every row rather than being re-read per note.
export type CreditNoteListItem = {
  id: string
  invoiceId: string
  number: string
  reason: string
  currency: string
  totalCents: number
  issuedAt: Date
}

export type CreditNoteDetailLineItem = {
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

export type CreditNoteDetail = {
  id: string
  invoiceId: string
  invoiceNumber: string
  projectId: string | null
  clientId: string | null
  clientName: string
  number: string
  reason: string
  currency: string
  subtotalCents: number
  taxAmountCents: number
  totalCents: number
  issuedAt: Date
  lineItems: CreditNoteDetailLineItem[]
  defaults: CreditNoteDefaults
}

// The instance-wide row. `invoiceNumber` and `clientName` are joined in rather than looked up per
// row, because the global list exists to answer "what have I credited" without opening each note.
export type CreditNoteOverviewItem = {
  id: string
  number: string
  invoiceId: string
  invoiceNumber: string
  projectId: string | null
  clientId: string | null
  clientName: string
  currency: string
  totalCents: number
  issuedAt: Date
}

export type CreditNoteOverviewClientOption = {
  id: string
  name: string
}

export type CreditNoteOverviewFilterOptions = {
  clients: CreditNoteOverviewClientOption[]
}

export type CreditNoteOverviewPageData = {
  creditNotes: CreditNoteOverviewItem[]
  rowCount: number
  summary: CreditNotesSummaryResult
  filterOptions: CreditNoteOverviewFilterOptions
  defaults: CreditNoteDefaults
}

// Everything the create form needs about the invoice it is crediting. `currency` and
// `outstandingCents` are read-only context: the credit note inherits the currency, and the
// outstanding figure is what tells the user how much is still worth crediting.
export type CreditNoteEditorData = {
  invoiceId: string
  invoiceNumber: string
  projectId: string | null
  clientName: string
  currency: string
  invoiceTotalCents: number
  creditedCents: number
  outstandingCents: number
  taxRates: CreditNoteTaxRateOption[]
  defaults: CreditNoteDefaults
}

// The action result shapes live here rather than in mutations.ts so mutationContext.ts can name them
// without importing a "use server" module.
export type CreditNoteMutationResult = { data: { id: string } } | { error: string }
