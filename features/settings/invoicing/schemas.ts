import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

// Every bound below restates a check constraint on the `settings` table — `chk_settings_invoice_
// prefix` (24 characters, printable ASCII), `chk_settings_number_padding_width` (1-10),
// `chk_settings_next_invoice_number` (>= 1) and `chk_settings_payment_terms` (0-365). They are
// restated here so a bad value is a field error the user can fix rather than a database exception,
// which means the two sides have to be widened together or the schema starts rejecting values the
// column would accept.
export const INVOICE_PREFIX_MAX_LENGTH = 24

const printableAsciiRegex = /^[ -~]*$/
const optionalDocumentTextSchema = z.string().trim()

const invoicePrefixSchema = z
  .string()
  .trim()
  .max(
    INVOICE_PREFIX_MAX_LENGTH,
    i18n.t("settings.invoicing.validation.invoicePrefixTooLong", {
      count: INVOICE_PREFIX_MAX_LENGTH
    })
  )
  .refine((value) => printableAsciiRegex.test(value), {
    message: i18n.t("settings.invoicing.validation.invoicePrefixInvalid")
  })

const numberPaddingWidthSchema = z
  .number()
  .int(i18n.t("settings.invoicing.validation.numberPaddingWidthInvalid"))
  .min(1, i18n.t("settings.invoicing.validation.numberPaddingWidthInvalid"))
  .max(10, i18n.t("settings.invoicing.validation.numberPaddingWidthInvalid"))

const nextInvoiceNumberSchema = z
  .number()
  .int(i18n.t("settings.invoicing.validation.nextInvoiceNumberInvalid"))
  .positive(i18n.t("settings.invoicing.validation.nextInvoiceNumberInvalid"))

const paymentTermsDaysSchema = z
  .number()
  .int(i18n.t("settings.invoicing.validation.paymentTermsDaysInvalid"))
  .min(0, i18n.t("settings.invoicing.validation.paymentTermsDaysInvalid"))
  .max(365, i18n.t("settings.invoicing.validation.paymentTermsDaysInvalid"))

const invoicingSettingsBaseSchema = z.object({
  invoicePrefix: invoicePrefixSchema,
  numberPaddingWidth: numberPaddingWidthSchema,
  nextInvoiceNumber: nextInvoiceNumberSchema,
  paymentTermsDays: paymentTermsDaysSchema,
  defaultNotesInvoice: optionalDocumentTextSchema,
  defaultInvoiceFooter: optionalDocumentTextSchema
})

// The counter may only ever move forward. Lowering it would hand out a number that has already
// been issued, which both collides with the unique constraint on `invoices.number` and breaks the
// gapless-sequence expectation that makes an invoice series auditable. The floor is a parameter
// because it comes from the numbers already issued, so the schema is built per request.
export const createInvoicingSettingsSchema = (minimumNextInvoiceNumber: number) =>
  invoicingSettingsBaseSchema.superRefine((values, context) => {
    if (values.nextInvoiceNumber >= minimumNextInvoiceNumber) return

    context.addIssue({
      code: "custom",
      path: ["nextInvoiceNumber"],
      message: i18n.t("settings.invoicing.validation.nextInvoiceNumberForward", {
        number: minimumNextInvoiceNumber
      })
    })
  })

export const invoicingSettingsSchema = createInvoicingSettingsSchema(1)

export type InvoicingSettingsValues = z.infer<typeof invoicingSettingsBaseSchema>
export type InvoicingSettingsInputValues = z.input<typeof invoicingSettingsBaseSchema>
