import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

import { isValidAmount, parseAmountToCents } from "@/lib/utils"

const PAYMENT_REFERENCE_MAX_LENGTH = 200
const PAYMENT_NOTES_MAX_LENGTH = 2000
const PAYMENT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const PAYMENT_METHOD_VALUES = ["bank_transfer", "stripe", "cash", "other"] as const
export type PaymentMethod = (typeof PAYMENT_METHOD_VALUES)[number]

// `stripe` is absent on purpose. A row carrying that method is one the signature-verified webhook
// wrote, and that receiver is the only writer able to supply the `stripe_payment_intent_id` the
// method implies — the id is what makes the write idempotent. A card payment keyed by hand is
// `other`.
export const MANUAL_PAYMENT_METHOD_VALUES = ["bank_transfer", "cash", "other"] as const
export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHOD_VALUES)[number]

const amountSchema = z
  .string()
  .trim()
  .min(1, i18n.t("payments.validation.amountRequired"))
  .refine((value) => isValidAmount(value), {
    message: i18n.t("payments.validation.amountInvalid")
  })
  .transform((value) => parseAmountToCents(value) ?? 0)
  .refine((value) => value > 0, { message: i18n.t("payments.validation.amountPositive") })

// Pinned to UTC midnight for the same reason the invoice dates are (`money-and-dates.md`): handing
// a bare "YYYY-MM-DD" to `new Date` reads it in the server's local zone, so an instance west of UTC
// would file the payment against the previous day.
const paidAtSchema = z
  .string()
  .trim()
  .refine((value) => PAYMENT_DATE_PATTERN.test(value), {
    message: i18n.t("payments.validation.dateInvalid")
  })
  .transform((value) => new Date(`${value}T00:00:00.000Z`))

const paymentFieldsShape = {
  amount: amountSchema,
  paidAt: paidAtSchema,
  method: z.enum(MANUAL_PAYMENT_METHOD_VALUES),
  reference: z
    .string()
    .trim()
    .max(
      PAYMENT_REFERENCE_MAX_LENGTH,
      i18n.t("payments.validation.referenceTooLong", { count: PAYMENT_REFERENCE_MAX_LENGTH })
    ),
  notes: z
    .string()
    .trim()
    .max(
      PAYMENT_NOTES_MAX_LENGTH,
      i18n.t("payments.validation.notesTooLong", { count: PAYMENT_NOTES_MAX_LENGTH })
    )
}

export const paymentFormSchema = z.object(paymentFieldsShape)

export type PaymentFormInputValues = z.input<typeof paymentFormSchema>
export type PaymentFormValues = z.infer<typeof paymentFormSchema>

export const recordPaymentSchema = z.object({
  ...paymentFieldsShape,
  invoiceId: z.uuid(i18n.t("payments.validation.invoiceIdInvalid"))
})

export const updatePaymentSchema = z.object({
  ...paymentFieldsShape,
  id: z.uuid(i18n.t("payments.validation.idInvalid"))
})

export const paymentIdSchema = z.object({
  id: z.uuid(i18n.t("payments.validation.idInvalid"))
})

export const invoicePaymentsParamsSchema = z.object({
  invoiceId: z.uuid(i18n.t("payments.validation.invoiceIdInvalid"))
})
