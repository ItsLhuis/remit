import { formatCentsForInput } from "@/lib/utils"

import { database } from "@/database"

import { type InvoicingSettingsValues } from "./schemas"

type InvoicingSettingsRow = {
  invoicePrefix: string
  numberPaddingWidth: number
  nextInvoiceNumber: number
  paymentTermsDays: number
  defaultNotesInvoice: string | null
  defaultInvoiceFooter: string | null
  defaultHourlyRateCents: number | null
  lateFeeEnabled: boolean
  lateFeeType: "percentage" | "fixed" | null
  lateFeePercentage: string | null
  lateFeeAmountCents: number | null
  lateFeeGraceDays: number
  lateFeeMaxCents: number | null
}

export async function getInvoicingSettings(): Promise<InvoicingSettingsValues> {
  const row = await database.query.settings.findFirst({
    columns: {
      invoicePrefix: true,
      numberPaddingWidth: true,
      nextInvoiceNumber: true,
      paymentTermsDays: true,
      defaultNotesInvoice: true,
      defaultInvoiceFooter: true,
      defaultHourlyRateCents: true,
      lateFeeEnabled: true,
      lateFeeType: true,
      lateFeePercentage: true,
      lateFeeAmountCents: true,
      lateFeeGraceDays: true,
      lateFeeMaxCents: true
    }
  })

  return toInvoicingSettingsFormData(row ?? null)
}

// The fallbacks are the `settings` column defaults repeated for the pre-setup case, where no row
// exists yet: an instance that has never saved these settings still issues `INV-0001` on 30-day
// terms. They only stay correct while they match `database/schema/settings.ts`, since nothing links
// the two.
export function toInvoicingSettingsFormData(
  row: InvoicingSettingsRow | null
): InvoicingSettingsValues {
  return {
    invoicePrefix: row?.invoicePrefix ?? "INV-",
    numberPaddingWidth: row?.numberPaddingWidth ?? 4,
    nextInvoiceNumber: row?.nextInvoiceNumber ?? 1,
    paymentTermsDays: row?.paymentTermsDays ?? 30,
    defaultNotesInvoice: row?.defaultNotesInvoice ?? "",
    defaultInvoiceFooter: row?.defaultInvoiceFooter ?? "",
    defaultHourlyRate: formatCentsForInput(row?.defaultHourlyRateCents ?? null),
    lateFeeEnabled: row?.lateFeeEnabled ?? false,
    // The control needs one of the two types selected even when nothing is configured, and
    // `percentage` is the shape a statutory late fee usually takes. It reaches the column only when
    // the operator fills the amount beside it.
    lateFeeType: row?.lateFeeType ?? "percentage",
    lateFeePercentage: row?.lateFeePercentage ?? "",
    lateFeeAmount: formatCentsForInput(row?.lateFeeAmountCents ?? null),
    lateFeeGraceDays: row?.lateFeeGraceDays ?? 0,
    lateFeeMax: formatCentsForInput(row?.lateFeeMaxCents ?? null)
  }
}
