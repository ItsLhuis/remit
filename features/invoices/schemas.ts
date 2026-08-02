import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

import { isValidAmount, parseAmountToCents } from "@/lib/utils"

const INVOICE_DESCRIPTION_MAX_LENGTH = 500
const INVOICE_UNIT_MAX_LENGTH = 50
const INVOICE_NOTES_MAX_LENGTH = 5000
const QUANTITY_PATTERN = /^\d+(\.\d{1,2})?$/

export const INVOICE_STATUS_VALUES = ["draft", "sent", "paid"] as const
export type InvoiceStatus = (typeof INVOICE_STATUS_VALUES)[number]

// The badge vocabulary, not the column vocabulary: `overdue` and `partially_paid` are derived by
// services/invoiceStatusView.ts and never persisted, so they appear here and nowhere near a write.
export const INVOICE_VIEW_STATUS_VALUES = [
  "draft",
  "sent",
  "paid",
  "overdue",
  "partially_paid"
] as const
export type InvoiceViewStatus = (typeof INVOICE_VIEW_STATUS_VALUES)[number]

export const INVOICE_DISCOUNT_KINDS = ["none", "percentage", "fixed"] as const
export type InvoiceDiscountKind = (typeof INVOICE_DISCOUNT_KINDS)[number]

export const invoiceStatusSchema = z.enum(INVOICE_STATUS_VALUES)

const requiredAmountSchema = z
  .string()
  .trim()
  .min(1, i18n.t("invoices.validation.amountRequired"))
  .refine((value) => isValidAmount(value), {
    message: i18n.t("invoices.validation.amountInvalid")
  })
  .transform((value) => parseAmountToCents(value) ?? 0)

const optionalAmountSchema = z
  .string()
  .trim()
  .refine((value) => isValidAmount(value), {
    message: i18n.t("invoices.validation.amountInvalid")
  })
  .transform((value) => parseAmountToCents(value))

const quantitySchema = z
  .string()
  .trim()
  .refine((value) => QUANTITY_PATTERN.test(value) && Number(value) > 0, {
    message: i18n.t("invoices.validation.quantityInvalid")
  })
  .transform((value) => Number(value))

const optionalPercentageSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || (/^\d+(\.\d{1,2})?$/.test(value) && Number(value) <= 100), {
    message: i18n.t("invoices.validation.percentageInvalid")
  })
  .transform((value) => (value === "" ? null : Number(value)))

const optionalDateSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: i18n.t("invoices.validation.dateInvalid")
  })
  // Pinned to UTC midnight: handing the bare "YYYY-MM-DD" to `new Date` reads it in the server's
  // local zone, so an instance west of UTC would persist the previous day (`money-and-dates.md`).
  .transform((value) => (value === "" ? null : new Date(`${value}T00:00:00.000Z`)))

const optionalUuidSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || z.uuid().safeParse(value).success, {
    message: i18n.t("invoices.validation.taxRateInvalid")
  })
  .transform((value) => (value === "" ? null : value))

const discountKindSchema = z.enum(INVOICE_DISCOUNT_KINDS)

// `chk_line_items_discount_shape` and `chk_invoices_discount_shape` demand that exactly the columns
// matching the discount kind are populated. This refinement is that constraint restated at the trust
// boundary, so an inconsistent shape is a field error rather than a database exception.
function refineDiscountShape<
  TValues extends {
    discountKind: InvoiceDiscountKind
    discountPercentage: number | null
    discountAmount: number | null
  }
>(values: TValues, context: z.RefinementCtx): void {
  if (values.discountKind === "percentage" && values.discountPercentage === null) {
    context.addIssue({
      code: "custom",
      path: ["discountPercentage"],
      message: i18n.t("invoices.validation.discountPercentageRequired")
    })
  }

  if (values.discountKind === "fixed" && values.discountAmount === null) {
    context.addIssue({
      code: "custom",
      path: ["discountAmount"],
      message: i18n.t("invoices.validation.discountAmountRequired")
    })
  }
}

// `chk_invoices_dates` restated at the boundary. Either date may stand alone on a draft; only the
// ordering is constrained, and only once both are present.
function refineDateOrder(
  values: { issueDate: Date | null; dueDate: Date | null },
  context: z.RefinementCtx
): void {
  if (values.issueDate && values.dueDate && values.dueDate < values.issueDate) {
    context.addIssue({
      code: "custom",
      path: ["dueDate"],
      message: i18n.t("invoices.validation.dueDateBeforeIssueDate")
    })
  }
}

export const invoiceLineItemSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(1, i18n.t("invoices.validation.descriptionRequired"))
      .max(
        INVOICE_DESCRIPTION_MAX_LENGTH,
        i18n.t("invoices.validation.descriptionTooLong", { count: INVOICE_DESCRIPTION_MAX_LENGTH })
      ),
    unit: z
      .string()
      .trim()
      .max(
        INVOICE_UNIT_MAX_LENGTH,
        i18n.t("invoices.validation.unitTooLong", { count: INVOICE_UNIT_MAX_LENGTH })
      ),
    quantity: quantitySchema,
    unitPrice: requiredAmountSchema,
    discountKind: discountKindSchema,
    discountPercentage: optionalPercentageSchema,
    discountAmount: optionalAmountSchema,
    taxRateId: optionalUuidSchema
  })
  .superRefine(refineDiscountShape)

export type InvoiceLineItemInputValues = z.input<typeof invoiceLineItemSchema>
export type InvoiceLineItemValues = z.infer<typeof invoiceLineItemSchema>

const invoiceFieldsShape = {
  currency: z
    .string()
    .trim()
    .length(3, i18n.t("invoices.validation.currencyInvalid"))
    .transform((value) => value.toUpperCase()),
  templateId: optionalUuidSchema,
  issueDate: optionalDateSchema,
  dueDate: optionalDateSchema,
  notes: z
    .string()
    .trim()
    .max(
      INVOICE_NOTES_MAX_LENGTH,
      i18n.t("invoices.validation.notesTooLong", { count: INVOICE_NOTES_MAX_LENGTH })
    ),
  discountKind: discountKindSchema,
  discountPercentage: optionalPercentageSchema,
  discountAmount: optionalAmountSchema,
  lineItems: z.array(invoiceLineItemSchema).min(1, i18n.t("invoices.validation.lineItemsRequired"))
}

function refineInvoiceFields<
  TValues extends {
    discountKind: InvoiceDiscountKind
    discountPercentage: number | null
    discountAmount: number | null
    issueDate: Date | null
    dueDate: Date | null
  }
>(values: TValues, context: z.RefinementCtx): void {
  refineDiscountShape(values, context)
  refineDateOrder(values, context)
}

export const invoiceFormSchema = z.object(invoiceFieldsShape).superRefine(refineInvoiceFields)

export type InvoiceFormInputValues = z.input<typeof invoiceFormSchema>
export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>

export const createInvoiceSchema = z
  .object({
    ...invoiceFieldsShape,
    projectId: z.uuid(i18n.t("invoices.validation.projectRequired"))
  })
  .superRefine(refineInvoiceFields)

export type CreateInvoiceValues = z.infer<typeof createInvoiceSchema>

export const updateInvoiceSchema = z
  .object({
    ...invoiceFieldsShape,
    id: z.uuid(i18n.t("invoices.validation.idInvalid"))
  })
  .superRefine(refineInvoiceFields)

export type UpdateInvoiceValues = z.infer<typeof updateInvoiceSchema>

export const createInvoiceFromProposalSchema = z.object({
  proposalId: z.uuid(i18n.t("invoices.validation.proposalIdInvalid"))
})

export type CreateInvoiceFromProposalValues = z.infer<typeof createInvoiceFromProposalSchema>

export const invoiceIdSchema = z.object({
  id: z.uuid(i18n.t("invoices.validation.idInvalid"))
})

export type InvoiceIdValues = z.infer<typeof invoiceIdSchema>

export const invoiceListParamsSchema = z.object({
  projectId: z.uuid(i18n.t("invoices.validation.projectRequired"))
})

export type InvoiceListParams = z.infer<typeof invoiceListParamsSchema>
