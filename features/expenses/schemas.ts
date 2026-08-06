import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

import {
  isValidAmount,
  parseAmountToCents,
  readArrayParam,
  readDateAt,
  readIntParam,
  readSortParam,
  readStringParam,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE
} from "@/lib/utils"

const EXPENSE_CATEGORY_MAX_LENGTH = 100
const EXPENSE_DESCRIPTION_MAX_LENGTH = 2000
const EXPENSE_FILENAME_MAX_LENGTH = 255
const EXPENSE_OBJECT_KEY_MAX_LENGTH = 512

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MARKUP_PATTERN = /^\d+(\.\d{1,2})?$/

// `chk_expenses_markup` restated at the trust boundary, so an out-of-range markup is a field error
// rather than a database exception.
const EXPENSE_MARKUP_MAX = 1000

export const EXPENSE_RECEIPT_MAX_BYTES = 10 * 1024 * 1024

// The contract between the presign route and this feature: `app/api/upload/[type]/route.ts` maps
// exactly these types to a file extension, and a receipt whose type is not here can never have been
// written to storage by that route. The route restates the list rather than importing it — see the
// comment above its `RECEIPT_KEY_PREFIX` for why — so the two must be changed together.
export const EXPENSE_RECEIPT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf"
] as const

// Every receipt object the presign route mints is keyed under this prefix. Validating it here is
// what stops a caller from pointing a receipt at an avatar or a business logo it does not own:
// `uploads` carries no owner column, so authorization has to come from the referencing record.
export const EXPENSE_RECEIPT_KEY_PREFIX = "expenses/"

export const EXPENSE_STATUS_FILTERS = ["active", "deleted", "all"] as const
export type ExpenseStatusFilter = (typeof EXPENSE_STATUS_FILTERS)[number]

export const EXPENSE_REBILLABLE_VALUES = ["rebillable", "nonRebillable"] as const
export type ExpenseRebillableValue = (typeof EXPENSE_REBILLABLE_VALUES)[number]

export const EXPENSE_INVOICED_VALUES = ["unbilled", "invoiced"] as const
export type ExpenseInvoicedValue = (typeof EXPENSE_INVOICED_VALUES)[number]

export const EXPENSE_SORT_FIELDS = ["spentAt", "amount", "category"] as const
export type ExpenseSortField = (typeof EXPENSE_SORT_FIELDS)[number]

const amountSchema = z
  .string()
  .trim()
  .min(1, i18n.t("expenses.validation.amountRequired"))
  .refine((value) => isValidAmount(value), {
    message: i18n.t("expenses.validation.amountInvalid")
  })
  .transform((value) => parseAmountToCents(value) ?? 0)

// Pinned to UTC midnight: handing the bare "YYYY-MM-DD" to `new Date` reads it in the server's local
// zone, so an instance west of UTC would persist the previous day (`money-and-dates.md`).
const spentAtSchema = z
  .string()
  .trim()
  .min(1, i18n.t("expenses.validation.dateRequired"))
  .refine((value) => DATE_PATTERN.test(value), {
    message: i18n.t("expenses.validation.dateInvalid")
  })
  .transform((value) => new Date(`${value}T00:00:00.000Z`))

const optionalUuidSchema = (message: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || z.uuid().safeParse(value).success, { message })
    .transform((value) => (value === "" ? null : value))

const optionalMarkupSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || (MARKUP_PATTERN.test(value) && Number(value) <= EXPENSE_MARKUP_MAX),
    { message: i18n.t("expenses.validation.markupInvalid", { max: EXPENSE_MARKUP_MAX }) }
  )
  .transform((value) => (value === "" ? null : Number(value)))

export const expenseReceiptSchema = z.object({
  objectKey: z
    .string()
    .trim()
    .min(1, i18n.t("expenses.validation.receiptKeyInvalid"))
    .max(EXPENSE_OBJECT_KEY_MAX_LENGTH, i18n.t("expenses.validation.receiptKeyInvalid"))
    .refine((value) => value.startsWith(EXPENSE_RECEIPT_KEY_PREFIX), {
      message: i18n.t("expenses.validation.receiptKeyInvalid")
    }),
  filename: z
    .string()
    .trim()
    .min(1, i18n.t("expenses.validation.receiptFilenameRequired"))
    .max(EXPENSE_FILENAME_MAX_LENGTH, i18n.t("expenses.validation.receiptFilenameRequired")),
  // Typed as a bounded string rather than an enum: the value round-trips through `uploads.mime_type`,
  // which is `text`, so an enum here would make every read model have to re-narrow a column the
  // database cannot constrain.
  mimeType: z
    .string()
    .trim()
    .refine((value) => (EXPENSE_RECEIPT_MIME_TYPES as readonly string[]).includes(value), {
      message: i18n.t("expenses.validation.receiptTypeInvalid")
    }),
  sizeBytes: z
    .number()
    .int(i18n.t("expenses.validation.receiptSizeInvalid"))
    .positive(i18n.t("expenses.validation.receiptSizeInvalid"))
    .max(
      EXPENSE_RECEIPT_MAX_BYTES,
      i18n.t("expenses.validation.receiptTooLarge", {
        megabytes: EXPENSE_RECEIPT_MAX_BYTES / (1024 * 1024)
      })
    )
})

export type ExpenseReceiptValues = z.infer<typeof expenseReceiptSchema>

const expenseFieldsShape = {
  projectId: optionalUuidSchema(i18n.t("expenses.validation.projectInvalid")),
  clientId: optionalUuidSchema(i18n.t("expenses.validation.clientInvalid")),
  spentAt: spentAtSchema,
  amount: amountSchema,
  currency: z
    .string()
    .trim()
    .length(3, i18n.t("expenses.validation.currencyInvalid"))
    .transform((value) => value.toUpperCase()),
  category: z
    .string()
    .trim()
    .min(1, i18n.t("expenses.validation.categoryRequired"))
    .max(
      EXPENSE_CATEGORY_MAX_LENGTH,
      i18n.t("expenses.validation.categoryTooLong", { count: EXPENSE_CATEGORY_MAX_LENGTH })
    ),
  description: z
    .string()
    .trim()
    .min(1, i18n.t("expenses.validation.descriptionRequired"))
    .max(
      EXPENSE_DESCRIPTION_MAX_LENGTH,
      i18n.t("expenses.validation.descriptionTooLong", { count: EXPENSE_DESCRIPTION_MAX_LENGTH })
    ),
  rebillable: z.boolean(),
  markupPercentage: optionalMarkupSchema,
  receipt: expenseReceiptSchema.nullable()
}

// A markup only means anything on an expense that is passed on to a client, and the column is
// nullable precisely so a non-rebillable expense carries none. Refusing the combination here keeps
// `calculateRebillableCents` from ever seeing a markup it must decide to ignore.
function refineExpenseFields(
  values: { rebillable: boolean; markupPercentage: number | null },
  context: z.RefinementCtx
): void {
  if (values.rebillable || values.markupPercentage === null) return

  context.addIssue({
    code: "custom",
    path: ["markupPercentage"],
    message: i18n.t("expenses.validation.markupRequiresRebillable")
  })
}

export const expenseFormSchema = z.object(expenseFieldsShape).superRefine(refineExpenseFields)

export type ExpenseFormInputValues = z.input<typeof expenseFormSchema>
export type ExpenseFormValues = z.infer<typeof expenseFormSchema>

export const updateExpenseSchema = z
  .object({ ...expenseFieldsShape, id: z.uuid(i18n.t("expenses.validation.idInvalid")) })
  .superRefine(refineExpenseFields)

export type UpdateExpenseValues = z.infer<typeof updateExpenseSchema>

export const expenseIdSchema = z.object({
  id: z.uuid(i18n.t("expenses.validation.idInvalid"))
})

export type ExpenseIdValues = z.infer<typeof expenseIdSchema>

const expenseSortItemSchema = z.object({
  id: z.enum(EXPENSE_SORT_FIELDS),
  desc: z.boolean()
})

export const expenseListQuerySchema = z.object({
  search: z.string().trim().default(""),
  status: z.enum(EXPENSE_STATUS_FILTERS).catch("active"),
  projectIds: z.array(z.uuid()).catch([]),
  clientIds: z.array(z.uuid()).catch([]),
  categories: z.array(z.string().trim().min(1)).catch([]),
  currencies: z.array(z.string().trim().length(3)).catch([]),
  rebillable: z.array(z.enum(EXPENSE_REBILLABLE_VALUES)).default([]),
  invoiced: z.array(z.enum(EXPENSE_INVOICED_VALUES)).default([]),
  spentFrom: z.date().nullable().catch(null),
  spentTo: z.date().nullable().catch(null),
  page: z.number().int().positive().catch(1),
  perPage: z.number().int().positive().max(MAX_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE),
  sort: z.array(expenseSortItemSchema).catch([{ id: "spentAt", desc: true }])
})

export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>

// The parameter names are the table's column ids, because `useDataTable` writes one URL parameter
// per filterable column and names it after the column. Renaming a column id in
// components/ExpensesListPage/columns.tsx without renaming it here silently drops that filter.
export function parseExpenseListQuery(input: unknown): ExpenseListQuery {
  const spentAt = readArrayParam(input, "spentAt")

  return expenseListQuerySchema.parse({
    search: readStringParam(input, "search"),
    status: readStringParam(input, "status") || "active",
    projectIds: readArrayParam(input, "project"),
    clientIds: readArrayParam(input, "client"),
    categories: readArrayParam(input, "category"),
    currencies: readArrayParam(input, "currency"),
    rebillable: readArrayParam(input, "rebillable").filter(
      (value): value is ExpenseRebillableValue =>
        (EXPENSE_REBILLABLE_VALUES as readonly string[]).includes(value)
    ),
    invoiced: readArrayParam(input, "invoiced").filter((value): value is ExpenseInvoicedValue =>
      (EXPENSE_INVOICED_VALUES as readonly string[]).includes(value)
    ),
    spentFrom: readDateAt(spentAt, 0),
    spentTo: readDateAt(spentAt, 1),
    page: readIntParam(input, "page", 1),
    perPage: readIntParam(input, "perPage", DEFAULT_PAGE_SIZE),
    sort: readSortParam(input, [{ id: "spentAt", desc: true }])
  })
}
