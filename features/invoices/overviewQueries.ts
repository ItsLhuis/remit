import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
  type AnyColumn,
  type SQL
} from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import { database } from "@/database"
import { clients, invoices, projects } from "@/database/schema"

import { getInvoiceDefaults } from "./queries"
import {
  parseInvoiceOverviewQuery,
  INVOICE_OVERVIEW_DEFAULT_SORT,
  type InvoiceOverviewQuery,
  type InvoiceOverviewSortField,
  type InvoiceStatus,
  type InvoiceViewStatus
} from "./schemas"
import {
  deriveInvoiceStatusView,
  getInvoiceOutstandingCents,
  summarizeInvoices,
  type InvoicesSummaryResult
} from "./services"
import {
  type InvoiceOverviewFilterOptions,
  type InvoiceOverviewItem,
  type InvoiceOverviewPageData
} from "./types"

// The instance-wide read behind `/invoices`, kept beside `queries.ts` rather than inside it because
// that file is already at the max-lines ceiling — the same reason `features/proposals
// /publicQueries.ts` stands apart. Everything here obeys the ordinary query rules.

// The client of a project-level invoice, reached through its project. Aliased because the same
// `clients` table is also joined directly for an invoice raised straight against a client, and a row
// may have either link, or both.
const projectClients = alias(clients, "project_clients")

const invoiceOverviewColumns = {
  id: invoices.id,
  number: invoices.number,
  status: invoices.status,
  currency: invoices.currency,
  totalCents: invoices.totalCents,
  amountPaidCents: invoices.amountPaidCents,
  issueDate: invoices.issueDate,
  dueDate: invoices.dueDate,
  paidAt: invoices.paidAt,
  createdAt: invoices.createdAt,
  projectId: invoices.projectId,
  projectName: projects.name,
  projectClientId: projects.clientId,
  projectClientName: projectClients.name,
  clientId: invoices.clientId,
  clientName: clients.name
}

type InvoiceOverviewRow = {
  id: string
  number: string
  status: InvoiceStatus
  currency: string
  totalCents: number
  amountPaidCents: number
  issueDate: Date | null
  dueDate: Date | null
  paidAt: Date | null
  createdAt: Date
  projectId: string | null
  projectName: string | null
  projectClientId: string | null
  projectClientName: string | null
  clientId: string | null
  clientName: string | null
}

// An invoice outlives the records it was raised from: every parent reference is `ON DELETE SET NULL`
// and `chk_invoices_parent` only demands that one of them survives, which is why the canonical list is
// instance-wide rather than nested under a parent. So the population is every invoice that has not
// itself been soft-deleted, including those whose project or client has been — money owed does not
// stop being owed because the project was closed, and dropping those rows would understate the very
// figures this page exists to show. `features/contracts/queries.ts` takes the same line for the same
// reason; the proposal overview does the opposite because an offer dies with its project.
//
// `now` is resolved once and threaded through the rows, the summary, and the SQL status filter, so
// all three agree about which invoices are overdue even if the request straddles midnight.
export async function getInvoiceOverviewPageData(input: unknown): Promise<InvoiceOverviewPageData> {
  const query = parseInvoiceOverviewQuery(input)
  const now = new Date()
  const defaults = await getInvoiceDefaults()
  const [list, summary, filterOptions] = await Promise.all([
    listInvoiceOverview(query, defaults.defaultCurrency, now),
    getInvoiceOverviewSummary(defaults.defaultCurrency, now),
    getInvoiceOverviewFilterOptions()
  ])

  return {
    invoices: list.rows,
    rowCount: list.rowCount,
    summary,
    filterOptions,
    defaults
  }
}

async function listInvoiceOverview(
  query: InvoiceOverviewQuery,
  defaultCurrency: string,
  now: Date
): Promise<{ rows: InvoiceOverviewItem[]; rowCount: number }> {
  const whereClause = getInvoiceOverviewWhereClause(query, now)

  const sortColumns: Record<InvoiceOverviewSortField, AnyColumn | SQL> = {
    number: invoices.number,
    parent: sql`coalesce(${projects.name}, ${clients.name})`,
    issueDate: invoices.issueDate,
    dueDate: invoices.dueDate,
    total: invoices.totalCents,
    outstanding: getInvoiceOutstandingExpression()
  }

  const sort = query.sort.length > 0 ? query.sort : [...INVOICE_OVERVIEW_DEFAULT_SORT]
  const orderBy = [
    ...sort.map((item) => (item.desc ? desc(sortColumns[item.id]) : asc(sortColumns[item.id]))),
    desc(invoices.createdAt)
  ]

  const [rows, totalRows] = await Promise.all([
    database
      .select(invoiceOverviewColumns)
      .from(invoices)
      .leftJoin(projects, eq(projects.id, invoices.projectId))
      .leftJoin(clients, eq(clients.id, invoices.clientId))
      .leftJoin(projectClients, eq(projectClients.id, projects.clientId))
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage),
    database
      .select({ value: count() })
      .from(invoices)
      .leftJoin(projects, eq(projects.id, invoices.projectId))
      .leftJoin(clients, eq(clients.id, invoices.clientId))
      .leftJoin(projectClients, eq(projectClients.id, projects.clientId))
      .where(whereClause)
  ])

  return {
    rows: rows.map((row) => toInvoiceOverviewItem(row, defaultCurrency, now)),
    rowCount: totalRows[0]?.value ?? 0
  }
}

async function getInvoiceOverviewSummary(
  defaultCurrency: string,
  now: Date
): Promise<InvoicesSummaryResult> {
  const rows = await database
    .select({
      status: invoices.status,
      currency: invoices.currency,
      totalCents: invoices.totalCents,
      amountPaidCents: invoices.amountPaidCents,
      dueDate: invoices.dueDate,
      paidAt: invoices.paidAt
    })
    .from(invoices)
    .where(isNull(invoices.deletedAt))

  return summarizeInvoices(
    rows.map((row) => ({
      status: row.status,
      currency: row.currency ?? defaultCurrency,
      totalCents: Number(row.totalCents),
      amountPaidCents: Number(row.amountPaidCents),
      dueDate: row.dueDate,
      paidAt: row.paidAt
    })),
    now
  )
}

async function getInvoiceOverviewFilterOptions(): Promise<InvoiceOverviewFilterOptions> {
  const [directRows, projectRows] = await Promise.all([
    database
      .selectDistinct({ id: clients.id, name: clients.name })
      .from(invoices)
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .where(isNull(invoices.deletedAt)),
    database
      .selectDistinct({ id: projectClients.id, name: projectClients.name })
      .from(invoices)
      .innerJoin(projects, eq(projects.id, invoices.projectId))
      .innerJoin(projectClients, eq(projectClients.id, projects.clientId))
      .where(isNull(invoices.deletedAt))
  ])

  const byId = new Map([...directRows, ...projectRows].map((row) => [row.id, row]))

  return {
    clients: Array.from(byId.values()).sort((first, second) =>
      first.name.localeCompare(second.name)
    )
  }
}

// The clamp mirrors `getInvoiceOutstandingCents` in services/invoiceStatusView.ts so the column the
// table sorts by and the amount each row prints cannot disagree about an over-applied payment.
function getInvoiceOutstandingExpression(): SQL<number> {
  return sql<number>`cast(greatest(${invoices.totalCents} - ${invoices.amountPaidCents}, 0) as bigint)`
}

function getInvoiceOverviewWhereClause(query: InvoiceOverviewQuery, now: Date): SQL | undefined {
  const conditions: SQL[] = [isNull(invoices.deletedAt)]

  if (query.search) {
    const searchPattern = `%${query.search}%`
    const searchCondition = or(
      ilike(invoices.number, searchPattern),
      ilike(projects.name, searchPattern),
      ilike(clients.name, searchPattern),
      ilike(projectClients.name, searchPattern)
    )

    if (searchCondition) conditions.push(searchCondition)
  }

  if (query.statuses.length > 0) {
    const today = toUtcDay(now)
    const statusCondition = or(
      ...query.statuses.map((status) => getInvoiceViewStatusCondition(status, today))
    )

    if (statusCondition) conditions.push(statusCondition)
  }

  if (query.clientIds.length > 0) {
    const clientCondition = or(
      inArray(invoices.clientId, query.clientIds),
      inArray(projects.clientId, query.clientIds)
    )

    if (clientCondition) conditions.push(clientCondition)
  }

  if (query.totalMin !== null) conditions.push(gte(invoices.totalCents, query.totalMin))
  if (query.totalMax !== null) conditions.push(lte(invoices.totalCents, query.totalMax))

  if (query.issueFrom) conditions.push(gte(invoices.issueDate, query.issueFrom))
  if (query.issueTo) conditions.push(lte(invoices.issueDate, query.issueTo))

  if (query.dueFrom) conditions.push(gte(invoices.dueDate, query.dueFrom))
  if (query.dueTo) conditions.push(lte(invoices.dueDate, query.dueTo))

  return and(...conditions)
}

// `overdue` and `partially_paid` are not values of `invoices.status`, so the status filter cannot be
// an `inArray` over the column. These five branches are the SQL restatement of
// `deriveInvoiceStatusView` in services/invoiceStatusView.ts, precedence included, and must keep
// matching it: the service decides the badge a row displays and this decides which rows the filter
// returns, so a divergence shows up as an invoice filtered into a bucket its own badge contradicts.
// The predicate has to run in the database, which is why it cannot call the service.
//
// `today` is the UTC calendar day of the request and the comparison is strict, mirroring
// `toUtcDayValue`: an invoice due today is not yet late. The `is not null` guard keeps the whole
// conjunction false rather than null for an invoice with no due date, so `not (...)` still selects it.
function getInvoiceViewStatusCondition(status: InvoiceViewStatus, today: string): SQL {
  const isOverdue = sql`(${eq(invoices.status, "sent")} and ${isNull(invoices.paidAt)} and ${isNotNull(invoices.dueDate)} and ${invoices.dueDate} < ${today}::date)`
  const isPartiallyPaid = sql`(${gt(invoices.amountPaidCents, 0)} and ${lt(invoices.amountPaidCents, invoices.totalCents)})`

  switch (status) {
    case "paid":
      return eq(invoices.status, "paid")
    case "overdue":
      return isOverdue
    case "partially_paid":
      return sql`(${ne(invoices.status, "paid")} and not ${isOverdue} and ${isPartiallyPaid})`
    case "draft":
      return sql`(${eq(invoices.status, "draft")} and not ${isPartiallyPaid})`
    case "sent":
      return sql`(${eq(invoices.status, "sent")} and not ${isOverdue} and not ${isPartiallyPaid})`
  }
}

function toInvoiceOverviewItem(
  row: InvoiceOverviewRow,
  defaultCurrency: string,
  now: Date
): InvoiceOverviewItem {
  const totalCents = Number(row.totalCents)
  const amountPaidCents = Number(row.amountPaidCents)

  return {
    id: row.id,
    number: row.number,
    status: row.status,
    viewStatus: deriveInvoiceStatusView(
      { status: row.status, dueDate: row.dueDate, paidAt: row.paidAt, amountPaidCents, totalCents },
      now
    ),
    currency: row.currency ?? defaultCurrency,
    totalCents,
    amountPaidCents,
    outstandingCents: getInvoiceOutstandingCents({ totalCents, amountPaidCents }),
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    paidAt: row.paidAt,
    createdAt: row.createdAt,
    parentLabel: row.projectName ?? row.clientName ?? "",
    projectId: row.projectId,
    clientId: row.clientId ?? row.projectClientId,
    clientName: row.clientName ?? row.projectClientName ?? ""
  }
}

function toUtcDay(value: Date): string {
  return value.toISOString().slice(0, 10)
}
