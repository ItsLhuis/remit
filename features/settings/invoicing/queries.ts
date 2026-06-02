import { database } from "@/database"

import { type InvoicingSettingsValues } from "./schemas"

type InvoicingSettingsRow = {
  invoicePrefix: string
  numberPaddingWidth: number
  nextInvoiceNumber: number
  paymentTermsDays: number
  defaultNotesInvoice: string | null
  defaultInvoiceFooter: string | null
}

export async function getInvoicingSettings(): Promise<InvoicingSettingsValues> {
  const row = await database.query.settings.findFirst({
    columns: {
      invoicePrefix: true,
      numberPaddingWidth: true,
      nextInvoiceNumber: true,
      paymentTermsDays: true,
      defaultNotesInvoice: true,
      defaultInvoiceFooter: true
    }
  })

  return toInvoicingSettingsFormData(row ?? null)
}

export function toInvoicingSettingsFormData(
  row: InvoicingSettingsRow | null
): InvoicingSettingsValues {
  return {
    invoicePrefix: row?.invoicePrefix ?? "INV-",
    numberPaddingWidth: row?.numberPaddingWidth ?? 4,
    nextInvoiceNumber: row?.nextInvoiceNumber ?? 1,
    paymentTermsDays: row?.paymentTermsDays ?? 30,
    defaultNotesInvoice: row?.defaultNotesInvoice ?? "",
    defaultInvoiceFooter: row?.defaultInvoiceFooter ?? ""
  }
}
