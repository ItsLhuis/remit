import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  type AnyColumn,
  type SQL
} from "drizzle-orm"

import { formatCentsForInput } from "@/lib/utils"

import { database } from "@/database"
import { clients, expenses, projects, uploads } from "@/database/schema"

import { canWriteAttachments, listAttachmentsByParents } from "@/features/attachments/server"

import {
  expenseIdSchema,
  parseExpenseListQuery,
  type ExpenseListQuery,
  type ExpenseSortField
} from "./schemas"
import { calculateRebillableCents, summarizeExpenses } from "./services"
import {
  type ExpenseClientOption,
  type ExpenseFormData,
  type ExpenseListItem,
  type ExpenseProjectOption,
  type ExpensesDefaults,
  type ExpensesPageData,
  type ExpensesSummary
} from "./types"

type ExpenseRow = {
  id: string
  spentAt: Date
  category: string
  description: string
  projectId: string | null
  projectName: string | null
  clientId: string | null
  clientName: string | null
  amountCents: number
  currency: string
  rebillable: boolean
  markupPercentage: string | null
  invoicedInId: string | null
  receiptUploadId: string | null
  receiptFilename: string | null
  receiptMimeType: string | null
  receiptSizeBytes: number | null
  receiptPath: string | null
  deletedAt: Date | null
}

const expenseListColumns = {
  id: expenses.id,
  spentAt: expenses.spentAt,
  category: expenses.category,
  description: expenses.description,
  projectId: expenses.projectId,
  projectName: projects.name,
  clientId: expenses.clientId,
  clientName: clients.name,
  amountCents: expenses.amountCents,
  currency: expenses.currency,
  rebillable: expenses.rebillable,
  markupPercentage: expenses.markupPercentage,
  invoicedInId: expenses.invoicedInId,
  receiptUploadId: expenses.receiptUploadId,
  receiptFilename: uploads.filename,
  receiptMimeType: uploads.mimeType,
  receiptSizeBytes: uploads.sizeBytes,
  receiptPath: uploads.path,
  deletedAt: expenses.deletedAt
}

export async function getExpensesPageData(input: unknown): Promise<ExpensesPageData> {
  const query = parseExpenseListQuery(input)
  const defaults = await getExpensesDefaults()

  const [list, summary, projectOptions, clientOptions, categoryOptions, currencyOptions] =
    await Promise.all([
      listExpenses(query, defaults.defaultCurrency),
      getExpensesSummary(defaults.defaultCurrency),
      listExpenseProjectOptions(),
      listExpenseClientOptions(),
      listExpenseCategoryOptions(),
      listExpenseCurrencyOptions()
    ])

  // Batched after the list rather than beside it: the ids come from `list.rows`, and an expense has
  // no detail page, so its files panel lives in the edit sheet and needs the attachments already on
  // the page when the sheet opens.
  const [attachmentsByExpense, canWriteFiles] = await Promise.all([
    listAttachmentsByParents({
      parentType: "expense",
      parentIds: list.rows.map((row) => row.id)
    }),
    canWriteAttachments()
  ])

  return {
    expenses: list.rows,
    rowCount: list.rowCount,
    summary,
    query,
    projectOptions,
    clientOptions,
    categoryOptions,
    currencyOptions,
    attachmentsByExpense,
    canWriteAttachments: canWriteFiles,
    defaults
  }
}

export async function listExpenses(
  query: ExpenseListQuery,
  defaultCurrency = "EUR"
): Promise<{ rows: ExpenseListItem[]; rowCount: number }> {
  const whereClause = getExpenseWhereClause(query)

  const [rows, totalRows] = await Promise.all([
    selectExpenses(whereClause)
      .orderBy(...getExpenseOrderBy(query))
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage),
    database
      .select({ value: count() })
      .from(expenses)
      .leftJoin(projects, eq(projects.id, expenses.projectId))
      .leftJoin(clients, eq(clients.id, expenses.clientId))
      .leftJoin(uploads, eq(uploads.id, expenses.receiptUploadId))
      .where(whereClause)
  ])

  return {
    rows: rows.map((row) => toExpenseListItem(row, defaultCurrency)),
    rowCount: totalRows[0]?.value ?? 0
  }
}

// Deliberately unpaginated: the CSV must contain the set the freelancer is looking at, and a page
// boundary in an export is a silent omission rather than a visible one.
export async function listExpensesForExport(
  query: ExpenseListQuery,
  defaultCurrency = "EUR"
): Promise<ExpenseListItem[]> {
  const rows = await selectExpenses(getExpenseWhereClause(query)).orderBy(
    ...getExpenseOrderBy(query)
  )

  return rows.map((row) => toExpenseListItem(row, defaultCurrency))
}

export async function getExpenseForEdit(input: unknown): Promise<ExpenseFormData | null> {
  const parsed = expenseIdSchema.safeParse(input)

  if (!parsed.success) return null

  const [row] = await selectExpenses(
    and(eq(expenses.id, parsed.data.id), isNull(expenses.deletedAt))
  ).limit(1)

  if (!row) return null

  const expense = toExpenseListItem(row, row.currency)

  return {
    id: expense.id,
    projectId: expense.projectId ?? "",
    clientId: expense.clientId ?? "",
    spentAt: expense.spentAt.toISOString().slice(0, 10),
    amount: formatCentsForInput(expense.amountCents),
    currency: expense.currency,
    category: expense.category,
    description: expense.description,
    rebillable: expense.rebillable,
    markupPercentage: expense.markupPercentage === null ? "" : String(expense.markupPercentage),
    receipt: expense.receipt
      ? {
          objectKey: expense.receipt.path,
          filename: expense.receipt.filename,
          mimeType: expense.receipt.mimeType,
          sizeBytes: expense.receipt.sizeBytes
        }
      : null
  }
}

export async function getExpensesDefaults(): Promise<ExpensesDefaults> {
  const row = await database.query.settings.findFirst({
    columns: {
      defaultCurrency: true,
      defaultLocale: true,
      defaultTimezone: true
    }
  })

  return {
    defaultCurrency: row?.defaultCurrency ?? "EUR",
    defaultLocale: row?.defaultLocale ?? "en",
    defaultTimezone: row?.defaultTimezone ?? "UTC"
  }
}

function selectExpenses(whereClause: SQL | undefined) {
  return database
    .select(expenseListColumns)
    .from(expenses)
    .leftJoin(projects, eq(projects.id, expenses.projectId))
    .leftJoin(clients, eq(clients.id, expenses.clientId))
    .leftJoin(uploads, eq(uploads.id, expenses.receiptUploadId))
    .where(whereClause)
}

async function getExpensesSummary(defaultCurrency: string): Promise<ExpensesSummary> {
  const rows = await database
    .select({
      amountCents: expenses.amountCents,
      currency: expenses.currency,
      rebillable: expenses.rebillable,
      markupPercentage: expenses.markupPercentage,
      invoicedInId: expenses.invoicedInId
    })
    .from(expenses)
    .where(isNull(expenses.deletedAt))

  const aggregate = summarizeExpenses(
    rows.map((row) => ({
      amountCents: Number(row.amountCents),
      currency: row.currency,
      rebillable: row.rebillable,
      markupPercentage: toMarkupPercentage(row.markupPercentage),
      invoicedInId: row.invoicedInId
    }))
  )

  return {
    count: aggregate.count,
    currency: defaultCurrency,
    totalCents: aggregate.totalCentsByCurrency[defaultCurrency] ?? 0,
    rebillableCents: aggregate.rebillableCentsByCurrency[defaultCurrency] ?? 0,
    unbilledRebillableCents: aggregate.unbilledRebillableCentsByCurrency[defaultCurrency] ?? 0
  }
}

async function listExpenseProjectOptions(): Promise<ExpenseProjectOption[]> {
  const rows = await database
    .select({
      id: projects.id,
      name: projects.name,
      clientId: projects.clientId,
      clientName: clients.name
    })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(and(isNull(projects.deletedAt), isNull(clients.deletedAt)))
    .orderBy(asc(clients.name), asc(projects.name))

  return rows
}

async function listExpenseClientOptions(): Promise<ExpenseClientOption[]> {
  return database
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(isNull(clients.deletedAt))
    .orderBy(asc(clients.name))
}

// Read from the expenses themselves rather than from a fixed list: the column is free-form, so the
// only categories worth offering as a filter are the ones this instance has actually used.
async function listExpenseCategoryOptions(): Promise<string[]> {
  const rows = await database
    .selectDistinct({ category: expenses.category })
    .from(expenses)
    .where(isNull(expenses.deletedAt))
    .orderBy(asc(expenses.category))

  return rows.map((row) => row.category)
}

async function listExpenseCurrencyOptions(): Promise<string[]> {
  const rows = await database
    .selectDistinct({ currency: expenses.currency })
    .from(expenses)
    .where(isNull(expenses.deletedAt))
    .orderBy(asc(expenses.currency))

  return rows.map((row) => row.currency)
}

function getExpenseOrderBy(query: ExpenseListQuery): SQL[] {
  const sortColumns: Record<ExpenseSortField, AnyColumn> = {
    spentAt: expenses.spentAt,
    amount: expenses.amountCents,
    category: expenses.category
  }

  if (query.sort.length === 0) return [desc(expenses.spentAt)]

  return query.sort.map((item) =>
    item.desc ? desc(sortColumns[item.id]) : asc(sortColumns[item.id])
  )
}

function getExpenseWhereClause(query: ExpenseListQuery): SQL | undefined {
  const conditions: SQL[] = []

  if (query.status === "active") conditions.push(isNull(expenses.deletedAt))
  if (query.status === "deleted") conditions.push(isNotNull(expenses.deletedAt))

  if (query.search) {
    const searchPattern = `%${query.search}%`
    const searchCondition = or(
      ilike(expenses.description, searchPattern),
      ilike(expenses.category, searchPattern),
      ilike(projects.name, searchPattern),
      ilike(clients.name, searchPattern)
    )

    if (searchCondition) conditions.push(searchCondition)
  }

  if (query.projectIds.length > 0) conditions.push(inArray(expenses.projectId, query.projectIds))
  if (query.clientIds.length > 0) conditions.push(inArray(expenses.clientId, query.clientIds))
  if (query.categories.length > 0) conditions.push(inArray(expenses.category, query.categories))
  if (query.currencies.length > 0) conditions.push(inArray(expenses.currency, query.currencies))

  const rebillableCondition = getRebillableCondition(query.rebillable)

  if (rebillableCondition) conditions.push(rebillableCondition)

  const invoicedCondition = getInvoicedCondition(query.invoiced)

  if (invoicedCondition) conditions.push(invoicedCondition)

  if (query.spentFrom) conditions.push(gte(expenses.spentAt, query.spentFrom))
  if (query.spentTo) conditions.push(lte(expenses.spentAt, query.spentTo))

  return and(...conditions)
}

// Both filters return undefined when every option is selected as well as when none is, because
// selecting the whole set narrows nothing and the extra predicate would only cost an index scan.
function getRebillableCondition(values: ExpenseListQuery["rebillable"]): SQL | undefined {
  if (values.length === 0 || values.length === 2) return undefined

  return eq(expenses.rebillable, values[0] === "rebillable")
}

function getInvoicedCondition(values: ExpenseListQuery["invoiced"]): SQL | undefined {
  if (values.length === 0 || values.length === 2) return undefined

  return values[0] === "unbilled" ? isNull(expenses.invoicedInId) : isNotNull(expenses.invoicedInId)
}

function toMarkupPercentage(value: string | null): number | null {
  return value === null ? null : Number(value)
}

function toExpenseListItem(row: ExpenseRow, defaultCurrency: string): ExpenseListItem {
  const amountCents = Number(row.amountCents)
  const markupPercentage = toMarkupPercentage(row.markupPercentage)
  const currency = row.currency || defaultCurrency

  return {
    id: row.id,
    spentAt: row.spentAt,
    category: row.category,
    description: row.description,
    projectId: row.projectId,
    projectName: row.projectName,
    clientId: row.clientId,
    clientName: row.clientName,
    amountCents,
    currency,
    rebillable: row.rebillable,
    markupPercentage,
    rebillableCents: calculateRebillableCents({
      amountCents,
      rebillable: row.rebillable,
      markupPercentage
    }),
    invoicedInId: row.invoicedInId,
    receipt:
      row.receiptUploadId &&
      row.receiptFilename !== null &&
      row.receiptMimeType !== null &&
      row.receiptSizeBytes !== null &&
      row.receiptPath !== null
        ? {
            uploadId: row.receiptUploadId,
            filename: row.receiptFilename,
            mimeType: row.receiptMimeType,
            sizeBytes: Number(row.receiptSizeBytes),
            path: row.receiptPath
          }
        : null,
    deletedAt: row.deletedAt
  }
}
