import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

import {
  isValidAmount,
  parseAmountToCents,
  readArrayParam,
  readDateAt,
  readIntParam,
  readNumberAt,
  readSortParam,
  readStringParam,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE
} from "@/lib/utils"

const CREDIT_NOTE_DESCRIPTION_MAX_LENGTH = 500
const CREDIT_NOTE_UNIT_MAX_LENGTH = 50
const CREDIT_NOTE_REASON_MAX_LENGTH = 2000
const QUANTITY_PATTERN = /^\d+(\.\d{1,2})?$/

export const CREDIT_NOTE_DISCOUNT_KINDS = ["none", "percentage", "fixed"] as const
export type CreditNoteDiscountKind = (typeof CREDIT_NOTE_DISCOUNT_KINDS)[number]

const requiredAmountSchema = z
  .string()
  .trim()
  .min(1, i18n.t("creditNotes.validation.amountRequired"))
  .refine((value) => isValidAmount(value), {
    message: i18n.t("creditNotes.validation.amountInvalid")
  })
  .transform((value) => parseAmountToCents(value) ?? 0)

const optionalAmountSchema = z
  .string()
  .trim()
  .refine((value) => isValidAmount(value), {
    message: i18n.t("creditNotes.validation.amountInvalid")
  })
  .transform((value) => parseAmountToCents(value))

const quantitySchema = z
  .string()
  .trim()
  .refine((value) => QUANTITY_PATTERN.test(value) && Number(value) > 0, {
    message: i18n.t("creditNotes.validation.quantityInvalid")
  })
  .transform((value) => Number(value))

const optionalPercentageSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || (/^\d+(\.\d{1,2})?$/.test(value) && Number(value) <= 100), {
    message: i18n.t("creditNotes.validation.percentageInvalid")
  })
  .transform((value) => (value === "" ? null : Number(value)))

const optionalUuidSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || z.uuid().safeParse(value).success, {
    message: i18n.t("creditNotes.validation.taxRateInvalid")
  })
  .transform((value) => (value === "" ? null : value))

const discountKindSchema = z.enum(CREDIT_NOTE_DISCOUNT_KINDS)

// `chk_line_items_discount_shape` demands that exactly the columns matching the discount kind are
// populated. This refinement is that constraint restated at the trust boundary, so an inconsistent
// shape is a field error rather than a database exception.
function refineDiscountShape<
  TValues extends {
    discountKind: CreditNoteDiscountKind
    discountPercentage: number | null
    discountAmount: number | null
  }
>(values: TValues, context: z.RefinementCtx): void {
  if (values.discountKind === "percentage" && values.discountPercentage === null) {
    context.addIssue({
      code: "custom",
      path: ["discountPercentage"],
      message: i18n.t("creditNotes.validation.discountPercentageRequired")
    })
  }

  if (values.discountKind === "fixed" && values.discountAmount === null) {
    context.addIssue({
      code: "custom",
      path: ["discountAmount"],
      message: i18n.t("creditNotes.validation.discountAmountRequired")
    })
  }
}

export const creditNoteLineItemSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(1, i18n.t("creditNotes.validation.descriptionRequired"))
      .max(
        CREDIT_NOTE_DESCRIPTION_MAX_LENGTH,
        i18n.t("creditNotes.validation.descriptionTooLong", {
          count: CREDIT_NOTE_DESCRIPTION_MAX_LENGTH
        })
      ),
    unit: z
      .string()
      .trim()
      .max(
        CREDIT_NOTE_UNIT_MAX_LENGTH,
        i18n.t("creditNotes.validation.unitTooLong", { count: CREDIT_NOTE_UNIT_MAX_LENGTH })
      ),
    quantity: quantitySchema,
    unitPrice: requiredAmountSchema,
    discountKind: discountKindSchema,
    discountPercentage: optionalPercentageSchema,
    discountAmount: optionalAmountSchema,
    taxRateId: optionalUuidSchema
  })
  .superRefine(refineDiscountShape)

export type CreditNoteLineItemInputValues = z.input<typeof creditNoteLineItemSchema>

// No currency and no document-level discount, unlike the invoice shape. The currency is copied from
// the invoice being credited, because a credit note that priced itself in another currency could not
// reduce that invoice's receivable; and `credit_notes` has no discount columns to record a
// document-level reduction in (services/calculateCreditNoteTotal.ts).
const creditNoteFieldsShape = {
  reason: z
    .string()
    .trim()
    .max(
      CREDIT_NOTE_REASON_MAX_LENGTH,
      i18n.t("creditNotes.validation.reasonTooLong", { count: CREDIT_NOTE_REASON_MAX_LENGTH })
    ),
  lineItems: z
    .array(creditNoteLineItemSchema)
    .min(1, i18n.t("creditNotes.validation.lineItemsRequired"))
}

export const creditNoteFormSchema = z.object(creditNoteFieldsShape)

export type CreditNoteFormInputValues = z.input<typeof creditNoteFormSchema>

export const createCreditNoteSchema = z.object({
  ...creditNoteFieldsShape,
  invoiceId: z.uuid(i18n.t("creditNotes.validation.invoiceIdInvalid"))
})

export type CreateCreditNoteValues = z.infer<typeof createCreditNoteSchema>

export const creditNoteIdSchema = z.object({
  id: z.uuid(i18n.t("creditNotes.validation.idInvalid"))
})

export const invoiceCreditNotesParamsSchema = z.object({
  invoiceId: z.uuid(i18n.t("creditNotes.validation.invoiceIdInvalid"))
})

const CREDIT_NOTE_OVERVIEW_SORT_FIELDS = [
  "number",
  "invoice",
  "client",
  "issuedAt",
  "total"
] as const

export type CreditNoteOverviewSortField = (typeof CREDIT_NOTE_OVERVIEW_SORT_FIELDS)[number]

const creditNoteOverviewSortItemSchema = z.object({
  id: z.enum(CREDIT_NOTE_OVERVIEW_SORT_FIELDS),
  desc: z.boolean()
})

// Newest first, unlike the invoice overview's soonest-due: a credit note has no deadline and nothing
// to chase. The question this list answers is "what have I credited lately", so the ledger reads in
// the order the notes were issued.
export const CREDIT_NOTE_OVERVIEW_DEFAULT_SORT = [{ id: "issuedAt", desc: true }] as const

const creditNoteOverviewQuerySchema = z.object({
  search: z.string().trim().default(""),
  clientIds: z.array(z.uuid()).default([]),
  totalMin: z.number().int().nonnegative().nullable().default(null),
  totalMax: z.number().int().nonnegative().nullable().default(null),
  issuedFrom: z.coerce.date().nullable().catch(null),
  issuedTo: z.coerce.date().nullable().catch(null),
  page: z.number().int().positive().catch(1),
  perPage: z.number().int().positive().max(MAX_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE),
  sort: z.array(creditNoteOverviewSortItemSchema).catch([...CREDIT_NOTE_OVERVIEW_DEFAULT_SORT])
})

export type CreditNoteOverviewQuery = z.infer<typeof creditNoteOverviewQuerySchema>

// The parameter names are the table's column ids, because `useDataTable` writes one URL parameter per
// filterable column and names it after the column. Renaming a column id here without renaming it in
// components/CreditNotesOverviewPage/columns.tsx silently drops that filter on the server.
export function parseCreditNoteOverviewQuery(input: unknown): CreditNoteOverviewQuery {
  const total = readArrayParam(input, "total")
  const issuedAt = readArrayParam(input, "issuedAt")

  return creditNoteOverviewQuerySchema.parse({
    search: readStringParam(input, "search"),
    clientIds: readArrayParam(input, "client").filter((value) => z.uuid().safeParse(value).success),
    totalMin: readNumberAt(total, 0),
    totalMax: readNumberAt(total, 1),
    issuedFrom: readDateAt(issuedAt, 0),
    issuedTo: readDateAt(issuedAt, 1),
    page: readIntParam(input, "page", 1),
    perPage: readIntParam(input, "perPage", DEFAULT_PAGE_SIZE),
    sort: readSortParam(input, [...CREDIT_NOTE_OVERVIEW_DEFAULT_SORT])
  })
}
