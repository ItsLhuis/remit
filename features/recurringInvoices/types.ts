import {
  type RecurringInvoiceBlueprintLine,
  type RecurringInvoiceCadence,
  type RecurringInvoiceStatus
} from "./schemas"

export type RecurringInvoiceDefaults = {
  defaultCurrency: string
  defaultLocale: string
  defaultTimezone: string
}

export type RecurringInvoiceClientOption = {
  id: string
  name: string
  currency: string | null
}

export type RecurringInvoiceProjectOption = {
  id: string
  name: string
  clientId: string | null
}

export type RecurringInvoiceTemplateOption = {
  id: string
  name: string
}

export type RecurringInvoiceTaxRateOption = {
  id: string
  name: string
  percentage: number
  isDefault: boolean
}

// One schedule as the list renders it.
export type RecurringInvoiceListItem = {
  id: string
  name: string
  clientId: string
  clientName: string
  projectName: string | null
  status: RecurringInvoiceStatus
  cadence: RecurringInvoiceCadence
  nextRunAt: Date
  lastRunAt: Date | null
  occurrencesGenerated: number
  endAfterCount: number | null
  endByDate: Date | null
  autoSend: boolean
  isRetainer: boolean
  currency: string
}

export type RecurringInvoiceListPageData = {
  rows: RecurringInvoiceListItem[]
  rowCount: number
  pageCount: number
  clientOptions: RecurringInvoiceClientOption[]
  defaults: RecurringInvoiceDefaults
}

export type RecurringInvoiceGeneratedInvoice = {
  id: string
  number: string
  status: string
  issueDate: Date | null
  totalCents: number
  currency: string
}

export type RecurringInvoiceDetail = {
  id: string
  name: string
  clientId: string
  clientName: string
  projectId: string | null
  projectName: string | null
  templateId: string | null
  status: RecurringInvoiceStatus
  cadence: RecurringInvoiceCadence
  cadenceDay: number | null
  nextRunAt: Date
  lastRunAt: Date | null
  endAfterCount: number | null
  endByDate: Date | null
  occurrencesGenerated: number
  autoSend: boolean
  currency: string
  includedHours: number | null
  overageRateCents: number | null
  notes: string
  lineItems: RecurringInvoiceBlueprintLine[]
  invoices: RecurringInvoiceGeneratedInvoice[]
}

export type RecurringInvoiceEditorData = {
  schedule: RecurringInvoiceDetail | null
  clientOptions: RecurringInvoiceClientOption[]
  projectOptions: RecurringInvoiceProjectOption[]
  templateOptions: RecurringInvoiceTemplateOption[]
  taxRateOptions: RecurringInvoiceTaxRateOption[]
  defaults: RecurringInvoiceDefaults
}

export type RecurringInvoiceMutationResult = { data: { id: string } } | { error: string }
