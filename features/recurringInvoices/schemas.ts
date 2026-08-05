import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

import {
  isValidAmount,
  parseAmountToCents,
  readArrayParam,
  readIntParam,
  readSortParam,
  readStringParam,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE
} from "@/lib/utils"

const RECURRING_INVOICE_NAME_MAX_LENGTH = 200
const RECURRING_INVOICE_NOTES_MAX_LENGTH = 2000
const RECURRING_INVOICE_DESCRIPTION_MAX_LENGTH = 500
const RECURRING_INVOICE_UNIT_MAX_LENGTH = 50
const MAX_DAY_OF_MONTH = 31
const MAX_DAY_OF_WEEK = 7
const MAX_INCLUDED_HOURS = 10_000
const MAX_OCCURRENCE_COUNT = 1_000
const QUANTITY_PATTERN = /^\d+(\.\d{1,2})?$/
const PERCENTAGE_PATTERN = /^\d+(\.\d{1,2})?$/

export const RECURRING_INVOICE_CADENCE_VALUES = [
  "weekly",
  "monthly",
  "quarterly",
  "yearly"
] as const
export type RecurringInvoiceCadence = (typeof RECURRING_INVOICE_CADENCE_VALUES)[number]

export const RECURRING_INVOICE_STATUS_VALUES = [
  "active",
  "paused",
  "completed",
  "cancelled"
] as const
export type RecurringInvoiceStatus = (typeof RECURRING_INVOICE_STATUS_VALUES)[number]

export const RECURRING_INVOICE_DISCOUNT_KINDS = ["none", "percentage", "fixed"] as const
export type RecurringInvoiceDiscountKind = (typeof RECURRING_INVOICE_DISCOUNT_KINDS)[number]

// The UI asks "when does this stop?" as one question with three answers, while the table stores the
// answer across two independently nullable columns. Keeping the discriminator in the schema is what
// lets `chk_recurring_invoices_end_condition` be restated as a field error rather than surfacing as
// a database exception.
export const RECURRING_INVOICE_END_CONDITIONS = ["never", "after_count", "by_date"] as const
export type RecurringInvoiceEndCondition = (typeof RECURRING_INVOICE_END_CONDITIONS)[number]

const requiredDateSchema = z
  .string()
  .trim()
  .min(1, i18n.t("recurringInvoices.validation.nextRunRequired"))
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), {
    message: i18n.t("recurringInvoices.validation.dateInvalid")
  })
  .transform((value) => new Date(`${value}T00:00:00.000Z`))

const optionalDateSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), {
    message: i18n.t("recurringInvoices.validation.dateInvalid")
  })
  .transform((value) => (value === "" ? null : new Date(`${value}T00:00:00.000Z`)))

const optionalUuidSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || z.uuid().safeParse(value).success, {
    message: i18n.t("recurringInvoices.validation.referenceInvalid")
  })
  .transform((value) => (value === "" ? null : value))

const optionalCountSchema = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" ||
      (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= MAX_OCCURRENCE_COUNT),
    { message: i18n.t("recurringInvoices.validation.occurrenceCountInvalid") }
  )
  .transform((value) => (value === "" ? null : Number(value)))

const optionalHoursSchema = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" ||
      (/^\d+(\.\d{1,2})?$/.test(value) &&
        Number(value) >= 0 &&
        Number(value) <= MAX_INCLUDED_HOURS),
    { message: i18n.t("recurringInvoices.validation.includedHoursInvalid") }
  )
  .transform((value) => (value === "" ? null : Number(value)))

const optionalAmountSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || isValidAmount(value), {
    message: i18n.t("recurringInvoices.validation.amountInvalid")
  })
  .transform((value) => (value === "" ? null : (parseAmountToCents(value) ?? null)))

const requiredAmountSchema = z
  .string()
  .trim()
  .min(1, i18n.t("recurringInvoices.validation.amountRequired"))
  .refine((value) => isValidAmount(value), {
    message: i18n.t("recurringInvoices.validation.amountInvalid")
  })
  .transform((value) => parseAmountToCents(value) ?? 0)

const quantitySchema = z
  .string()
  .trim()
  .refine((value) => QUANTITY_PATTERN.test(value) && Number(value) > 0, {
    message: i18n.t("recurringInvoices.validation.quantityInvalid")
  })
  .transform((value) => Number(value))

const optionalPercentageSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || (PERCENTAGE_PATTERN.test(value) && Number(value) <= 100), {
    message: i18n.t("recurringInvoices.validation.percentageInvalid")
  })
  .transform((value) => (value === "" ? null : Number(value)))

const optionalDaySchema = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d+$/.test(value), {
    message: i18n.t("recurringInvoices.validation.cadenceDayInvalid")
  })
  .transform((value) => (value === "" ? null : Number(value)))

export const recurringInvoiceLineItemSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, i18n.t("recurringInvoices.validation.descriptionRequired"))
    .max(
      RECURRING_INVOICE_DESCRIPTION_MAX_LENGTH,
      i18n.t("recurringInvoices.validation.descriptionTooLong")
    ),
  unit: z
    .string()
    .trim()
    .max(RECURRING_INVOICE_UNIT_MAX_LENGTH, i18n.t("recurringInvoices.validation.unitTooLong")),
  quantity: quantitySchema,
  unitPrice: requiredAmountSchema,
  taxRateId: optionalUuidSchema,
  discountKind: z.enum(RECURRING_INVOICE_DISCOUNT_KINDS),
  discountPercentage: optionalPercentageSchema,
  discountAmount: optionalAmountSchema
})

export type RecurringInvoiceLineItemInputValues = z.input<typeof recurringInvoiceLineItemSchema>
export type RecurringInvoiceLineItemValues = z.infer<typeof recurringInvoiceLineItemSchema>

// The persisted shape of `recurring_invoices.line_items_blueprint`, distinct from the form shape
// above: the column stores already-parsed cents and numbers, while the form holds the strings the
// controls carry. It is a jsonb column with no database-level shape at all, so this schema is the
// only thing standing between a hand-edited row and the generation job — every read validates
// through it (`remit/validate-before-io`, security.md).
//
// `taxPercentage` is snapshotted here rather than joined from `tax_rates` at generation time, for
// the same reason `conversion.ts` copies the proposal's snapshot: a rate edited between authoring
// the schedule and the run must not silently move an amount the client has been quoted (ADR-0017).
export const recurringInvoiceBlueprintLineSchema = z.object({
  description: z.string().min(1).max(RECURRING_INVOICE_DESCRIPTION_MAX_LENGTH),
  unit: z.string().max(RECURRING_INVOICE_UNIT_MAX_LENGTH).nullable(),
  quantity: z.number().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  taxRateId: z.uuid().nullable(),
  taxPercentage: z.number().min(0).max(100),
  discountType: z.enum(["percentage", "fixed"]).nullable(),
  discountPercentage: z.number().min(0).max(100).nullable(),
  discountAmountCents: z.number().int().nonnegative().nullable()
})

export type RecurringInvoiceBlueprintLine = z.infer<typeof recurringInvoiceBlueprintLineSchema>

export const recurringInvoiceBlueprintSchema = z.array(recurringInvoiceBlueprintLineSchema)

const recurringInvoiceFieldsShape = {
  name: z
    .string()
    .trim()
    .min(1, i18n.t("recurringInvoices.validation.nameRequired"))
    .max(RECURRING_INVOICE_NAME_MAX_LENGTH, i18n.t("recurringInvoices.validation.nameTooLong")),
  clientId: z.uuid(i18n.t("recurringInvoices.validation.clientRequired")),
  projectId: optionalUuidSchema,
  templateId: optionalUuidSchema,
  cadence: z.enum(RECURRING_INVOICE_CADENCE_VALUES),
  cadenceDay: optionalDaySchema,
  nextRunAt: requiredDateSchema,
  endCondition: z.enum(RECURRING_INVOICE_END_CONDITIONS),
  endAfterCount: optionalCountSchema,
  endByDate: optionalDateSchema,
  autoSend: z.boolean(),
  currency: z
    .string()
    .trim()
    .length(3, i18n.t("recurringInvoices.validation.currencyInvalid"))
    .transform((value) => value.toUpperCase()),
  includedHours: optionalHoursSchema,
  overageRate: optionalAmountSchema,
  notes: z
    .string()
    .trim()
    .max(RECURRING_INVOICE_NOTES_MAX_LENGTH, i18n.t("recurringInvoices.validation.notesTooLong")),
  lineItems: z
    .array(recurringInvoiceLineItemSchema)
    .min(1, i18n.t("recurringInvoices.validation.lineItemsRequired"))
}

type RecurringInvoiceFieldValues = {
  cadence: RecurringInvoiceCadence
  cadenceDay: number | null
  endCondition: RecurringInvoiceEndCondition
  endAfterCount: number | null
  endByDate: Date | null
  nextRunAt: Date
  includedHours: number | null
  overageRate: number | null
}

// Each of the three refinements below is a database CHECK restated at the trust boundary, plus the
// one rule the schema owns alone: `cadence_day` has no CHECK constraint at all, so 31 is storable
// against a weekly cadence and nothing but this would stop it.
function refineRecurringInvoiceFields(
  values: RecurringInvoiceFieldValues,
  context: z.RefinementCtx
): void {
  const maxCadenceDay = values.cadence === "weekly" ? MAX_DAY_OF_WEEK : MAX_DAY_OF_MONTH

  if (values.cadenceDay !== null && (values.cadenceDay < 1 || values.cadenceDay > maxCadenceDay)) {
    context.addIssue({
      code: "custom",
      path: ["cadenceDay"],
      message: i18n.t("recurringInvoices.validation.cadenceDayOutOfRange")
    })
  }

  if (values.endCondition === "after_count" && values.endAfterCount === null) {
    context.addIssue({
      code: "custom",
      path: ["endAfterCount"],
      message: i18n.t("recurringInvoices.validation.occurrenceCountRequired")
    })
  }

  if (values.endCondition === "by_date" && values.endByDate === null) {
    context.addIssue({
      code: "custom",
      path: ["endByDate"],
      message: i18n.t("recurringInvoices.validation.endDateRequired")
    })
  }

  if (values.endByDate !== null && values.endByDate.getTime() < values.nextRunAt.getTime()) {
    context.addIssue({
      code: "custom",
      path: ["endByDate"],
      message: i18n.t("recurringInvoices.validation.endDateBeforeNextRun")
    })
  }

  // `chk_recurring_invoices_retainer` cannot express "both or neither" — it permits an included-hours
  // pool with no overage rate, which would bill nothing once the pool ran out. The pair is required
  // together here so `toRetainerTerms` in services/retainerPool.ts never has to guess.
  if ((values.includedHours === null) !== (values.overageRate === null)) {
    context.addIssue({
      code: "custom",
      path: values.includedHours === null ? ["includedHours"] : ["overageRate"],
      message: i18n.t("recurringInvoices.validation.retainerIncomplete")
    })
  }
}

export const recurringInvoiceFormSchema = z
  .object(recurringInvoiceFieldsShape)
  .superRefine(refineRecurringInvoiceFields)

export type RecurringInvoiceFormInputValues = z.input<typeof recurringInvoiceFormSchema>

export const createRecurringInvoiceSchema = recurringInvoiceFormSchema

export type CreateRecurringInvoiceValues = z.infer<typeof createRecurringInvoiceSchema>

export const updateRecurringInvoiceSchema = z
  .object({
    id: z.uuid(i18n.t("recurringInvoices.validation.referenceInvalid")),
    ...recurringInvoiceFieldsShape
  })
  .superRefine(refineRecurringInvoiceFields)

export type UpdateRecurringInvoiceValues = z.infer<typeof updateRecurringInvoiceSchema>

export const recurringInvoiceIdSchema = z.object({
  id: z.uuid(i18n.t("recurringInvoices.validation.referenceInvalid"))
})

export type RecurringInvoiceIdValues = z.infer<typeof recurringInvoiceIdSchema>

const RECURRING_INVOICE_SORT_FIELDS = ["name", "client", "cadence", "nextRunAt", "status"] as const

export type RecurringInvoiceSortField = (typeof RECURRING_INVOICE_SORT_FIELDS)[number]

const recurringInvoiceSortItemSchema = z.object({
  id: z.enum(RECURRING_INVOICE_SORT_FIELDS),
  desc: z.boolean()
})

// Soonest run first, matching the invoice overview's soonest-due rather than the credit-note ledger's
// newest-first: a schedule list is a forward-looking queue, and the question it answers is "what is
// about to bill".
export const RECURRING_INVOICE_DEFAULT_SORT = [{ id: "nextRunAt", desc: false }] as const

const recurringInvoiceOverviewQuerySchema = z.object({
  search: z.string().trim().default(""),
  clientIds: z.array(z.uuid()).default([]),
  statuses: z.array(z.enum(RECURRING_INVOICE_STATUS_VALUES)).catch([]),
  cadences: z.array(z.enum(RECURRING_INVOICE_CADENCE_VALUES)).catch([]),
  page: z.number().int().positive().catch(1),
  perPage: z.number().int().positive().max(MAX_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE),
  sort: z.array(recurringInvoiceSortItemSchema).catch([...RECURRING_INVOICE_DEFAULT_SORT])
})

export type RecurringInvoiceOverviewQuery = z.infer<typeof recurringInvoiceOverviewQuerySchema>

// The parameter names are the table's column ids, because `useDataTable` writes one URL parameter per
// filterable column and names it after the column. Renaming a column id here without renaming it in
// components/RecurringInvoicesOverviewPage/columns.tsx silently drops that filter on the server.
export function parseRecurringInvoiceOverviewQuery(input: unknown): RecurringInvoiceOverviewQuery {
  return recurringInvoiceOverviewQuerySchema.parse({
    search: readStringParam(input, "search"),
    clientIds: readArrayParam(input, "client").filter((value) => z.uuid().safeParse(value).success),
    statuses: readArrayParam(input, "status"),
    cadences: readArrayParam(input, "cadence"),
    page: readIntParam(input, "page", 1),
    perPage: readIntParam(input, "perPage", DEFAULT_PAGE_SIZE),
    sort: readSortParam(input, [...RECURRING_INVOICE_DEFAULT_SORT])
  })
}
