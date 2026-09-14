import {
  getClientDefaults,
  getClientDetail,
  listClients,
  parseClientListQuery
} from "@/features/clients/server"

import {
  getExpensesDefaults,
  listExpenses,
  parseExpenseListQuery
} from "@/features/expenses/server"

import {
  getInvoiceDefaults,
  getInvoiceDetail,
  listInvoiceOverview,
  parseInvoiceOverviewQuery
} from "@/features/invoices/server"

import {
  getProjectDefaults,
  getProjectDetail,
  listProjects,
  parseProjectListQuery
} from "@/features/projects/server"

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

// Every read here is the one the application's own screens use, fed the same parsed query they
// are: an API that re-implemented "the clients list" would be a second definition of which clients
// exist, and the two would drift apart the first time either changed its soft-delete rule. Only
// `page` and `perPage` are passed through, so each collection keeps the default filter (live rows
// only) and the default order of the screen it comes from.

export async function listApiClients(params: ApiListParams): Promise<ApiListResult<ApiClient>> {
  const defaults = await getClientDefaults()
  const result = await listClients(
    parseClientListQuery(toSearchParams(params)),
    defaults.defaultCurrency
  )

  return { rows: result.rows.map(toApiClient), total: result.rowCount }
}

export async function getApiClient(id: string): Promise<ApiClientDetail | null> {
  const client = await getClientDetail({ id })

  return client ? toApiClientDetail(client) : null
}

export async function listApiProjects(params: ApiListParams): Promise<ApiListResult<ApiProject>> {
  const defaults = await getProjectDefaults()
  const result = await listProjects(
    parseProjectListQuery(toSearchParams(params)),
    defaults.defaultCurrency
  )

  return { rows: result.rows.map(toApiProject), total: result.rowCount }
}

export async function getApiProject(id: string): Promise<ApiProjectDetail | null> {
  const project = await getProjectDetail({ id })

  return project ? toApiProjectDetail(project) : null
}

export async function listApiInvoices(params: ApiListParams): Promise<ApiListResult<ApiInvoice>> {
  const defaults = await getInvoiceDefaults()
  const result = await listInvoiceOverview(
    parseInvoiceOverviewQuery(toSearchParams(params)),
    defaults.defaultCurrency,
    new Date()
  )

  return { rows: result.rows.map(toApiInvoice), total: result.rowCount }
}

export async function getApiInvoice(id: string): Promise<ApiInvoiceDetail | null> {
  const invoice = await getInvoiceDetail({ id })

  return invoice ? toApiInvoiceDetail(invoice) : null
}

export async function listApiTimeEntries(
  params: ApiListParams
): Promise<ApiListResult<ApiTimeEntry>> {
  const defaults = await getTimeTrackingDefaults()
  const result = await listTimeEntries(
    parseTimeEntryListQuery(toSearchParams(params)),
    defaults.defaultCurrency
  )

  return { rows: result.rows.map(toApiTimeEntry), total: result.rowCount }
}

export async function listApiExpenses(params: ApiListParams): Promise<ApiListResult<ApiExpense>> {
  const defaults = await getExpensesDefaults()
  const result = await listExpenses(
    parseExpenseListQuery(toSearchParams(params)),
    defaults.defaultCurrency
  )

  return { rows: result.rows.map(toApiExpense), total: result.rowCount }
}

function toSearchParams(params: ApiListParams): URLSearchParams {
  return new URLSearchParams({ page: String(params.page), perPage: String(params.perPage) })
}
