import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

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
