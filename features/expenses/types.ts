import { type AttachmentListItem } from "@/features/attachments"

import { type ExpenseFormInputValues, type ExpenseListQuery } from "./schemas"

export type ExpenseReceiptFile = {
  uploadId: string
  filename: string
  mimeType: string
  sizeBytes: number
  path: string
}

export type ExpenseListItem = {
  id: string
  spentAt: Date
  category: string
  description: string
  projectId: string | null
  projectName: string | null
  clientId: string | null
  clientName: string | null
  amountCents: number
  currency: string
  rebillable: boolean
  markupPercentage: number | null
  rebillableCents: number
  invoicedInId: string | null
  receipt: ExpenseReceiptFile | null
  deletedAt: Date | null
}

export type ExpensesSummary = {
  count: number
  currency: string
  totalCents: number
  rebillableCents: number
  unbilledRebillableCents: number
}

export type ExpenseProjectOption = {
  id: string
  name: string
  clientId: string
  clientName: string
}

export type ExpenseClientOption = {
  id: string
  name: string
}

export type ExpensesDefaults = {
  defaultCurrency: string
  defaultLocale: string
  defaultTimezone: string
}

export type ExpensesPageData = {
  expenses: ExpenseListItem[]
  rowCount: number
  summary: ExpensesSummary
  query: ExpenseListQuery
  projectOptions: ExpenseProjectOption[]
  clientOptions: ExpenseClientOption[]
  categoryOptions: string[]
  currencyOptions: string[]
  attachmentsByExpense: Record<string, AttachmentListItem[]>
  canWriteAttachments: boolean
  defaults: ExpensesDefaults
}

export type ExpenseFormData = ExpenseFormInputValues & {
  id: string
}
