import {
  getClientDefaults,
  getClientDetail,
  listClients,
  parseClientListQuery
} from "@/features/clients/server"

import { type ExpenseInvoicedValue, type ExpenseRebillableValue } from "@/features/expenses"
import {
  getExpensesDefaults,
  listExpenses,
  parseExpenseListQuery
} from "@/features/expenses/server"

import { type InvoiceViewStatus } from "@/features/invoices"
import {
  getInvoiceDefaults,
  getInvoiceDetail,
  listInvoiceOverview,
  parseInvoiceOverviewQuery
} from "@/features/invoices/server"

import { type ProjectStatus } from "@/features/projects"
import {
  getProjectDefaults,
  getProjectDetail,
  listProjects,
  parseProjectListQuery
} from "@/features/projects/server"

import { type TimeEntryBillableValue, type TimeEntryInvoicedValue } from "@/features/timeTracking"
import {
  getTimeTrackingDefaults,
  listTimeEntries,
  parseTimeEntryListQuery
} from "@/features/timeTracking/server"

import {
  type ApiClient,
  type ApiClientDetail,
  type ApiExpense,
  type ApiInvoice,
  type ApiInvoiceDetail,
  type ApiProject,
  type ApiProjectDetail,
  type ApiTimeEntry
} from "./responseSchemas"
import { type ApiListParams } from "./schemas"
import { toListSearchParams, type ApiDateRange } from "./services/listSearchParams"
import {
  toApiClient,
  toApiClientDetail,
  toApiExpense,
  toApiInvoice,
  toApiInvoiceDetail,
  toApiProject,
  toApiProjectDetail,
  toApiTimeEntry
} from "./services/serializers"

export type ApiListResult<TItem> = {
  rows: TItem[]
  total: number
}

// Narrowing filters, in each screen's own filter vocabulary. The REST routes pass none, because v1
// of the public API refuses every parameter but paging; the MCP tools pass them, because an
// assistant that had to page through a whole collection to answer "what is overdue" would read far
// more than it needs. Every filter narrows the set the unfiltered read returns, and none widens it.

export type ApiSearchFilter = { search?: string }

export type ApiProjectFilters = ApiSearchFilter & { statuses?: readonly ProjectStatus[] }

export type ApiInvoiceFilters = ApiSearchFilter & {
  statuses?: readonly InvoiceViewStatus[]
  clientIds?: readonly string[]
  issued?: ApiDateRange
  due?: ApiDateRange
}

export type ApiTimeEntryFilters = ApiSearchFilter & {
  projectIds?: readonly string[]
  billable?: readonly TimeEntryBillableValue[]
  invoiced?: readonly TimeEntryInvoicedValue[]
  started?: ApiDateRange
}

export type ApiExpenseFilters = ApiSearchFilter & {
  projectIds?: readonly string[]
  clientIds?: readonly string[]
  rebillable?: readonly ExpenseRebillableValue[]
  invoiced?: readonly ExpenseInvoicedValue[]
  spent?: ApiDateRange
}

// Every read here is the one the application's own screens use, fed the same parsed query they
// are: an API that re-implemented "the clients list" would be a second definition of which clients
// exist, and the two would drift apart the first time either changed its soft-delete rule. The
// screens' trash selector is never passed, so each collection keeps the screen's default filter
// (live rows only) and its default order.

export async function listApiClients(
  params: ApiListParams,
  filters: ApiSearchFilter = {}
): Promise<ApiListResult<ApiClient>> {
  const defaults = await getClientDefaults()
  const result = await listClients(
    parseClientListQuery(toListSearchParams(params, { search: filters.search })),
    defaults.defaultCurrency
  )

  return { rows: result.rows.map(toApiClient), total: result.rowCount }
}

export async function getApiClient(id: string): Promise<ApiClientDetail | null> {
  const client = await getClientDetail({ id })

  return client ? toApiClientDetail(client) : null
}

export async function listApiProjects(
  params: ApiListParams,
  filters: ApiProjectFilters = {}
): Promise<ApiListResult<ApiProject>> {
  const defaults = await getProjectDefaults()
  const result = await listProjects(
    parseProjectListQuery(
      toListSearchParams(params, { search: filters.search, stage: filters.statuses })
    ),
    defaults.defaultCurrency
  )

  return { rows: result.rows.map(toApiProject), total: result.rowCount }
}

export async function getApiProject(id: string): Promise<ApiProjectDetail | null> {
  const project = await getProjectDetail({ id })

  return project ? toApiProjectDetail(project) : null
}

// The invoices screen's `status` parameter is its badge filter (overdue, partially paid, ...)
// rather than a trash selector: the overview has no trash view, and its query excludes deleted
// rows outright.
export async function listApiInvoices(
  params: ApiListParams,
  filters: ApiInvoiceFilters = {}
): Promise<ApiListResult<ApiInvoice>> {
  const defaults = await getInvoiceDefaults()
  const result = await listInvoiceOverview(
    parseInvoiceOverviewQuery(
      toListSearchParams(params, {
        search: filters.search,
        status: filters.statuses,
        client: filters.clientIds,
        issueDate: filters.issued,
        dueDate: filters.due
      })
    ),
    defaults.defaultCurrency,
    new Date()
  )

  return { rows: result.rows.map(toApiInvoice), total: result.rowCount }
}

export async function getApiInvoice(id: string): Promise<ApiInvoiceDetail | null> {
  const invoice = await getInvoiceDetail({ id })

  return invoice ? toApiInvoiceDetail(invoice, new Date()) : null
}

export async function listApiTimeEntries(
  params: ApiListParams,
  filters: ApiTimeEntryFilters = {}
): Promise<ApiListResult<ApiTimeEntry>> {
  const defaults = await getTimeTrackingDefaults()
  const result = await listTimeEntries(
    parseTimeEntryListQuery(
      toListSearchParams(params, {
        search: filters.search,
        project: filters.projectIds,
        billable: filters.billable,
        invoiced: filters.invoiced,
        started: filters.started
      })
    ),
    defaults.defaultCurrency
  )

  return { rows: result.rows.map(toApiTimeEntry), total: result.rowCount }
}

export async function listApiExpenses(
  params: ApiListParams,
  filters: ApiExpenseFilters = {}
): Promise<ApiListResult<ApiExpense>> {
  const defaults = await getExpensesDefaults()
  const result = await listExpenses(
    parseExpenseListQuery(
      toListSearchParams(params, {
        search: filters.search,
        project: filters.projectIds,
        client: filters.clientIds,
        rebillable: filters.rebillable,
        invoiced: filters.invoiced,
        spentAt: filters.spent
      })
    ),
    defaults.defaultCurrency
  )

  return { rows: result.rows.map(toApiExpense), total: result.rowCount }
}
