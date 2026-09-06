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

const INVOICE_DESCRIPTION_MAX_LENGTH = 500
const INVOICE_UNIT_MAX_LENGTH = 50
const INVOICE_NOTES_MAX_LENGTH = 5000
const INVOICE_TOKEN_MAX_LENGTH = 128
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

export const BILLABLE_GROUPINGS = ["entry", "task", "project"] as const
export type BillableGroupingValue = (typeof BILLABLE_GROUPINGS)[number]

// `targetInvoiceId` null means "raise a new draft". The id list is what the browser selected and is
// re-read and re-checked inside the conversion's transaction; nothing here may be trusted beyond its
// shape.
export const convertBillableWorkSchema = z
  .object({
    timeEntryIds: z.array(z.uuid(i18n.t("invoices.validation.billableSelectionRequired"))),
    expenseIds: z.array(z.uuid(i18n.t("invoices.validation.billableSelectionRequired"))),
    grouping: z.enum(BILLABLE_GROUPINGS, i18n.t("invoices.validation.billableGroupingInvalid")),
    targetInvoiceId: z.uuid(i18n.t("invoices.validation.billableTargetInvalid")).nullable()
  })
  .refine((values) => values.timeEntryIds.length + values.expenseIds.length > 0, {
    message: i18n.t("invoices.validation.billableSelectionRequired"),
    path: ["timeEntryIds"]
  })

export type ConvertBillableWorkValues = z.infer<typeof convertBillableWorkSchema>

export const invoiceIdSchema = z.object({
  id: z.uuid(i18n.t("invoices.validation.idInvalid"))
})

export type InvoiceIdValues = z.infer<typeof invoiceIdSchema>

// The amount stays the string the control holds and becomes cents on the server, the way every other
// money field in this feature travels (`forms.md`). An empty string is refused rather than read as
// "no fee": waiving is an explicit `0`.
export const adjustInvoiceLateFeeSchema = z.object({
  id: z.uuid(i18n.t("invoices.validation.idInvalid")),
  lateFee: z
    .string()
    .trim()
    .refine((value) => parseAmountToCents(value) !== null, {
      message: i18n.t("invoices.validation.lateFeeInvalid")
    })
})

export type AdjustInvoiceLateFeeValues = z.infer<typeof adjustInvoiceLateFeeSchema>

// The shape `features/invoices/lateFees.ts` writes into `audit_logs.metadata`, read back by
// `getInvoiceDetail` so the detail screen can state which terms a fee was charged under. It is a
// JSONB column typed `unknown`, so it is parsed rather than cast — an entry written by an older
// version simply yields no origin.
export const lateFeeAuditMetadataSchema = z.object({
  daysLate: z.number().int().nonnegative(),
  policy: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("percentage"), percentage: z.number() }),
    z.object({ kind: z.literal("fixed"), amountCents: z.number().int() })
  ])
})

export type LateFeeAuditMetadata = z.infer<typeof lateFeeAuditMetadataSchema>

export const invoiceListParamsSchema = z.object({
  projectId: z.uuid(i18n.t("invoices.validation.projectRequired"))
})

export type InvoiceListParams = z.infer<typeof invoiceListParamsSchema>

// Bounded, not shaped: the stored token is always 43 base64url characters, but validating that here
// would turn a malformed token into a distinguishable rejection. Anything within the bound falls
// through to the same constant-time miss as a well-formed token that does not exist.
const publicInvoiceTokenValueSchema = z
  .string()
  .trim()
  .min(1, i18n.t("invoices.public.validation.tokenInvalid"))
  .max(INVOICE_TOKEN_MAX_LENGTH, i18n.t("invoices.public.validation.tokenInvalid"))

export const publicInvoiceTokenSchema = z.object({ token: publicInvoiceTokenValueSchema })

const INVOICE_OVERVIEW_SORT_FIELDS = [
  "number",
  "parent",
  "issueDate",
  "dueDate",
  "total",
  "outstanding"
] as const

export type InvoiceOverviewSortField = (typeof INVOICE_OVERVIEW_SORT_FIELDS)[number]

const invoiceOverviewSortItemSchema = z.object({
  id: z.enum(INVOICE_OVERVIEW_SORT_FIELDS),
  desc: z.boolean()
})

// Soonest due first, because the instance-wide list exists to answer "what am I owed and what is
// late". Postgres puts a null due date last under ASC, which parks the drafts that carry no deadline
// below every invoice that does. `status` is deliberately absent from the sort fields above: it is
// derived by services/invoiceStatusView.ts and the database has no column to order by.
export const INVOICE_OVERVIEW_DEFAULT_SORT = [{ id: "dueDate", desc: false }] as const

const invoiceOverviewQuerySchema = z.object({
  search: z.string().trim().default(""),
  statuses: z.array(z.enum(INVOICE_VIEW_STATUS_VALUES)).default([]),
  clientIds: z.array(z.uuid()).default([]),
  totalMin: z.number().int().nonnegative().nullable().default(null),
  totalMax: z.number().int().nonnegative().nullable().default(null),
  issueFrom: z.coerce.date().nullable().catch(null),
  issueTo: z.coerce.date().nullable().catch(null),
  dueFrom: z.coerce.date().nullable().catch(null),
  dueTo: z.coerce.date().nullable().catch(null),
  page: z.number().int().positive().catch(1),
  perPage: z.number().int().positive().max(MAX_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE),
  sort: z.array(invoiceOverviewSortItemSchema).catch([...INVOICE_OVERVIEW_DEFAULT_SORT])
})

export type InvoiceOverviewQuery = z.infer<typeof invoiceOverviewQuerySchema>

// The parameter names are the table's column ids, because `useDataTable` writes one URL parameter per
// filterable column and names it after the column. Renaming a column id here without renaming it in
// components/InvoicesOverviewPage/columns.tsx silently drops that filter on the server.
export function parseInvoiceOverviewQuery(input: unknown): InvoiceOverviewQuery {
  const total = readArrayParam(input, "total")
  const issueDate = readArrayParam(input, "issueDate")
  const dueDate = readArrayParam(input, "dueDate")

  return invoiceOverviewQuerySchema.parse({
    search: readStringParam(input, "search"),
    statuses: readArrayParam(input, "status").filter((value): value is InvoiceViewStatus =>
      (INVOICE_VIEW_STATUS_VALUES as readonly string[]).includes(value)
    ),
    clientIds: readArrayParam(input, "client").filter((value) => z.uuid().safeParse(value).success),
    totalMin: readNumberAt(total, 0),
    totalMax: readNumberAt(total, 1),
    issueFrom: readDateAt(issueDate, 0),
    issueTo: readDateAt(issueDate, 1),
    dueFrom: readDateAt(dueDate, 0),
    dueTo: readDateAt(dueDate, 1),
    page: readIntParam(input, "page", 1),
    perPage: readIntParam(input, "perPage", DEFAULT_PAGE_SIZE),
    sort: readSortParam(input, [...INVOICE_OVERVIEW_DEFAULT_SORT])
  })
}
