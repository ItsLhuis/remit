import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

import { isValidAmount } from "@/lib/utils"

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

// Kept as the string the control holds rather than transformed to cents here: this schema is the
// action's schema too, and a transform would make the server re-parse a number where it expects a
// string (see `forms.md`). `buildInvoicingSettingsWritePlan` is where it becomes cents.
const defaultHourlyRateSchema = z
  .string()
  .trim()
  .refine((value) => isValidAmount(value), {
    message: i18n.t("settings.invoicing.validation.defaultHourlyRateInvalid")
  })

const LATE_FEE_PERCENTAGE_PATTERN = /^\d+(\.\d{1,2})?$/

const lateFeeTypeSchema = z.enum(["percentage", "fixed"])

const lateFeePercentageSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || (LATE_FEE_PERCENTAGE_PATTERN.test(value) && Number(value) <= 100),
    { message: i18n.t("settings.invoicing.validation.lateFeePercentageInvalid") }
  )

const lateFeeAmountSchema = z
  .string()
  .trim()
  .refine((value) => isValidAmount(value), {
    message: i18n.t("settings.invoicing.validation.lateFeeAmountInvalid")
  })

const lateFeeMaxSchema = z
  .string()
  .trim()
  .refine((value) => isValidAmount(value), {
    message: i18n.t("settings.invoicing.validation.lateFeeMaxInvalid")
  })

const lateFeeGraceDaysSchema = z
  .number()
  .int(i18n.t("settings.invoicing.validation.lateFeeGraceDaysInvalid"))
  .min(0, i18n.t("settings.invoicing.validation.lateFeeGraceDaysInvalid"))
  .max(365, i18n.t("settings.invoicing.validation.lateFeeGraceDaysInvalid"))

const invoicingSettingsBaseSchema = z.object({
  invoicePrefix: invoicePrefixSchema,
  numberPaddingWidth: numberPaddingWidthSchema,
  nextInvoiceNumber: nextInvoiceNumberSchema,
  paymentTermsDays: paymentTermsDaysSchema,
  defaultNotesInvoice: optionalDocumentTextSchema,
  defaultInvoiceFooter: optionalDocumentTextSchema,
  defaultHourlyRate: defaultHourlyRateSchema,
  lateFeeEnabled: z.boolean(),
  lateFeeType: lateFeeTypeSchema,
  lateFeePercentage: lateFeePercentageSchema,
  lateFeeAmount: lateFeeAmountSchema,
  lateFeeGraceDays: lateFeeGraceDaysSchema,
  lateFeeMax: lateFeeMaxSchema
})

// Turning the policy on without an amount is refused here as well as by
// `chk_settings_late_fee_enabled_shape`, so the operator sees a field error rather than a database
// exception. The amount of the *other* type stays whatever it was: switching from a percentage to a
// flat fee and back must not silently erase the percentage.
function refineLateFeePolicy(
  values: InvoicingSettingsValues,
  context: z.RefinementCtx<InvoicingSettingsValues>
): void {
  if (!values.lateFeeEnabled) return

  const path = values.lateFeeType === "percentage" ? "lateFeePercentage" : "lateFeeAmount"

  if (values[path] !== "") return

  context.addIssue({
    code: "custom",
    path: [path],
    message: i18n.t("settings.invoicing.validation.lateFeeAmountRequired")
  })
}

// The counter may only ever move forward. Lowering it would hand out a number that has already
// been issued, which both collides with the unique constraint on `invoices.number` and breaks the
// gapless-sequence expectation that makes an invoice series auditable. The floor is a parameter
// because it comes from the numbers already issued, so the schema is built per request.
export const createInvoicingSettingsSchema = (minimumNextInvoiceNumber: number) =>
  invoicingSettingsBaseSchema.superRefine((values, context) => {
    refineLateFeePolicy(values, context)

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
