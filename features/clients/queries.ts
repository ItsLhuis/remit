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
  lte,
  or,
  sql,
  type AnyColumn,
  type SQL
} from "drizzle-orm"

import { formatCentsForInput } from "@/lib/utils"

import { database } from "@/database"
import { clients, invoices, projects, recurringInvoices, uploads } from "@/database/schema"

import {
  getClientInvoiceCountSubquery,
  getClientInvoiceTotalsSubquery,
  getClientPaymentTotalsSubquery
} from "./queryFragments"
import {
  clientIdSchema,
  parseClientListQuery,
  type ClientHealthValue,
  type ClientListQuery,
  type ClientSortField
} from "./schemas"
import {
  buildClientBillingTrend,
  getClientHealth,
  summarizeClients,
  type ClientBillingPoint,
  type ClientsSummary,
  type ClientSummaryRow
} from "./services"
import {
  type ClientDefaults,
  type ClientDetail,
  type ClientFilterOptions,
  type ClientFormData,
  type ClientListItem,
  type ClientListPageData,
  type ClientRelatedResourceCounts
} from "./types"

export type ClientListRow = {
  id: string
  name: string
  email: string
  imageStorageKey: string | null
  currency: string | null
  outstandingBalanceCents: number
  invoiceCount: number
  createdAt: Date
  deletedAt: Date | null
}

export type ClientOption = {
  id: string
  name: string
  currency: string
}

type ClientDetailRow = typeof clients.$inferSelect

// The detail read joins the image upload so the workspace can render it without a second query.
// `toClientFormData` takes the bare row and is called from `mutations.ts`'s `returning()`, which has
// no join, so the relation is optional here rather than part of `ClientDetailRow` itself.
type ClientDetailRowWithImage = ClientDetailRow & { image?: { path: string } | null }

const clientListColumns = {
  id: clients.id,
  name: clients.name,
  email: clients.email,
  imageStorageKey: uploads.path,
  currency: clients.currency,
  createdAt: clients.createdAt,
  deletedAt: clients.deletedAt
}

export async function getClientsPageData(input: unknown): Promise<ClientListPageData> {
  const query = parseClientListQuery(input)
  const defaults = await getClientDefaults()
  const [list, filterOptions, summary] = await Promise.all([
    listClients(query, defaults.defaultCurrency),
    getClientFilterOptions(),
    getClientsSummary(defaults.defaultCurrency)
  ])

  return {
    clients: list.rows,
    rowCount: list.rowCount,
    summary,
    query,
    filterOptions,
    defaults
  }
}

export async function listClients(
  query: ClientListQuery,
  defaultCurrency = "EUR"
): Promise<{ rows: ClientListItem[]; rowCount: number }> {
  const invoiceTotals = getClientInvoiceTotalsSubquery()
  const paymentTotals = getClientPaymentTotalsSubquery()
  const invoiceCounts = getClientInvoiceCountSubquery()

  const outstandingExpr = sql<number>`cast(greatest(coalesce(${invoiceTotals.totalCents}, 0) - coalesce(${paymentTotals.paidCents}, 0), 0) as bigint)`
  const invoiceCountExpr = sql<number>`cast(coalesce(${invoiceCounts.invoiceCount}, 0) as int)`

  const whereClause = getClientListWhereClause(query, outstandingExpr, invoiceCountExpr)

  const sortColumns: Record<ClientSortField, AnyColumn | SQL> = {
    name: clients.name,
    currency: clients.currency,
    joined: clients.createdAt,
    outstanding: outstandingExpr
  }

  const orderBy =
    query.sort.length > 0
      ? query.sort.map((item) =>
          item.desc ? desc(sortColumns[item.id]) : asc(sortColumns[item.id])
        )
      : [asc(clients.name), asc(clients.email)]

  const [rows, totalRows] = await Promise.all([
    database
      .select({
        ...clientListColumns,
        outstandingBalanceCents: outstandingExpr,
        invoiceCount: invoiceCountExpr
      })
      .from(clients)
      .leftJoin(uploads, eq(uploads.id, clients.imageUploadId))
      .leftJoin(invoiceTotals, eq(invoiceTotals.clientId, clients.id))
      .leftJoin(paymentTotals, eq(paymentTotals.clientId, clients.id))
      .leftJoin(invoiceCounts, eq(invoiceCounts.clientId, clients.id))
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage),
    database
      .select({ value: count() })
      .from(clients)
      .leftJoin(invoiceTotals, eq(invoiceTotals.clientId, clients.id))
      .leftJoin(paymentTotals, eq(paymentTotals.clientId, clients.id))
      .leftJoin(invoiceCounts, eq(invoiceCounts.clientId, clients.id))
      .where(whereClause)
  ])

  return {
    rows: rows.map((row) => toClientListItem(row, defaultCurrency)),
    rowCount: totalRows[0]?.value ?? 0
  }
}

async function getClientsSummary(defaultCurrency = "EUR"): Promise<ClientsSummary> {
  const invoiceTotals = getClientInvoiceTotalsSubquery()
  const paymentTotals = getClientPaymentTotalsSubquery()
  const invoiceCounts = getClientInvoiceCountSubquery()

  const rows = await database
    .select({
      currency: clients.currency,
      createdAt: clients.createdAt,
      outstandingBalanceCents: sql<number>`cast(greatest(coalesce(${invoiceTotals.totalCents}, 0) - coalesce(${paymentTotals.paidCents}, 0), 0) as bigint)`,
      invoiceCount: sql<number>`cast(coalesce(${invoiceCounts.invoiceCount}, 0) as int)`
    })
    .from(clients)
    .leftJoin(invoiceTotals, eq(invoiceTotals.clientId, clients.id))
    .leftJoin(paymentTotals, eq(paymentTotals.clientId, clients.id))
    .leftJoin(invoiceCounts, eq(invoiceCounts.clientId, clients.id))
    .where(isNull(clients.deletedAt))

  const summaryRows: ClientSummaryRow[] = rows.map((row) => ({
    currency: row.currency ?? defaultCurrency,
    createdAt: row.createdAt,
    outstandingBalanceCents: Number(row.outstandingBalanceCents),
    invoiceCount: Number(row.invoiceCount)
  }))

  return summarizeClients(summaryRows, new Date())
}

export async function getClientFilterOptions(): Promise<ClientFilterOptions> {
  const rows = await database
    .select({
      currency: clients.currency
    })
    .from(clients)
    .where(and(isNull(clients.deletedAt), isNotNull(clients.currency)))
    .groupBy(clients.currency)
    .orderBy(asc(clients.currency))

  return {
    currencies: rows.flatMap((row) => (row.currency ? [row.currency] : []))
  }
}

export async function getClientDefaults(): Promise<ClientDefaults> {
  const row = await database.query.settings.findFirst({
    columns: {
      defaultCurrency: true,
      defaultLocale: true
    }
  })

  return {
    defaultCurrency: row?.defaultCurrency ?? "EUR",
    defaultLocale: row?.defaultLocale ?? "en"
  }
}

export async function getClientDetail(input: unknown): Promise<ClientDetail | null> {
  const parsed = clientIdSchema.safeParse(input)

  if (!parsed.success) return null

  const [client, defaults] = await Promise.all([
    database.query.clients.findFirst({
      where: and(eq(clients.id, parsed.data.id), isNull(clients.deletedAt)),
      with: { image: { columns: { path: true } } }
    }),
    getClientDefaults()
  ])

  if (!client) return null

  const now = new Date()

  const [outstandingBalanceCents, relatedResources, billingTrend] = await Promise.all([
    getOutstandingBalanceCents(client.id),
    getClientRelatedResourceCounts(client.id),
    getClientBillingTrend(client.id, now)
  ])

  return toClientDetail({
    row: client,
    outstandingBalanceCents,
    relatedResources,
    billingTrend,
    defaultCurrency: defaults.defaultCurrency
  })
}

export async function getClient(input: unknown): Promise<ClientOption | null> {
  const parsed = clientIdSchema.safeParse(input)

  if (!parsed.success) return null

  const row = await database.query.clients.findFirst({
    where: and(eq(clients.id, parsed.data.id), isNull(clients.deletedAt)),
    columns: { id: true, name: true, currency: true }
  })

  if (!row) return null

  return { id: row.id, name: row.name, currency: row.currency ?? "EUR" }
}

export async function listClientOptions(): Promise<ClientOption[]> {
  const rows = await database
    .select({ id: clients.id, name: clients.name, currency: clients.currency })
    .from(clients)
    .where(isNull(clients.deletedAt))
    .orderBy(asc(clients.name))

  return rows.map((row) => ({ id: row.id, name: row.name, currency: row.currency ?? "EUR" }))
}

export async function getClientForEdit(input: unknown): Promise<ClientFormData | null> {
  const parsed = clientIdSchema.safeParse(input)

  if (!parsed.success) return null

  const row = await database.query.clients.findFirst({
    where: and(eq(clients.id, parsed.data.id), isNull(clients.deletedAt))
  })

  return row ? toClientFormData(row) : null
}

export function toClientFormData(row: ClientDetailRow): ClientFormData {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? "",
    currency: row.currency ?? "EUR",
    taxId: row.taxId ?? "",
    addressLine1: row.addressLine1 ?? "",
    addressLine2: row.addressLine2 ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    postalCode: row.postalCode ?? "",
    country: row.country ?? "",
    notes: row.notes ?? "",
    website: row.website ?? "",
    defaultHourlyRate: formatCentsForInput(row.defaultHourlyRateCents)
  }
}

function getClientListWhereClause(
  query: ClientListQuery,
  outstandingExpr: SQL<number>,
  invoiceCountExpr: SQL<number>
): SQL | undefined {
  const conditions: SQL[] = []

  if (query.status === "active") conditions.push(isNull(clients.deletedAt))
  if (query.status === "deleted") conditions.push(isNotNull(clients.deletedAt))

  if (query.search) {
    const searchPattern = `%${query.search}%`
    const searchCondition = or(
      ilike(clients.name, searchPattern),
      ilike(clients.email, searchPattern)
    )

    if (searchCondition) conditions.push(searchCondition)
  }

  if (query.currencies.length > 0) conditions.push(inArray(clients.currency, query.currencies))

  const healthCondition = getClientHealthCondition(query.healths, outstandingExpr, invoiceCountExpr)

  if (healthCondition) conditions.push(healthCondition)

  if (query.outstandingMin !== null) conditions.push(gte(outstandingExpr, query.outstandingMin))
  if (query.outstandingMax !== null) conditions.push(lte(outstandingExpr, query.outstandingMax))

  if (query.joinedFrom) conditions.push(gte(clients.createdAt, query.joinedFrom))
  if (query.joinedTo) conditions.push(lte(clients.createdAt, query.joinedTo))

  return and(...conditions)
}

// These three branches are the SQL restatement of `getClientHealth` in services/clientHealth.ts and
// must keep matching it: the service decides the badge a row displays, this decides which rows the
// health filter returns, and a divergence shows up as a client filtered into a bucket its own badge
// contradicts. Filtering cannot call the service because the predicate has to run in the database.
function getClientHealthCondition(
  healths: ClientHealthValue[],
  outstandingExpr: SQL<number>,
  invoiceCountExpr: SQL<number>
): SQL | undefined {
  if (healths.length === 0) return undefined

  const parts: SQL[] = []

  for (const health of healths) {
    if (health === "owing") {
      parts.push(gt(outstandingExpr, 0))

      continue
    }

    if (health === "settled") {
      const condition = and(eq(outstandingExpr, 0), gt(invoiceCountExpr, 0))

      if (condition) parts.push(condition)

      continue
    }

    const condition = and(eq(outstandingExpr, 0), eq(invoiceCountExpr, 0))

    if (condition) parts.push(condition)
  }

  return parts.length > 0 ? or(...parts) : undefined
}

// Invoice totals, payment totals and invoice counts are three separate pre-aggregated subqueries
// joined onto `clients`, rather than one query joining invoices and payments together. Joining them
// directly fans out one invoice row per payment, which multiplies `sum(invoices.total_cents)` by
// the number of payments and silently inflates every outstanding balance on the page. The
// `greatest(..., 0)` wrapper at each call site mirrors the clamp in
// `services/calculateOutstandingBalance.ts` so SQL and the pure service agree on an overpaid client.
async function getOutstandingBalanceCents(clientId: string): Promise<number> {
  const invoiceTotals = getClientInvoiceTotalsSubquery()
  const paymentTotals = getClientPaymentTotalsSubquery()

  const [row] = await database
    .select({
      outstandingBalanceCents: sql<number>`cast(greatest(coalesce(${invoiceTotals.totalCents}, 0) - coalesce(${paymentTotals.paidCents}, 0), 0) as bigint)`
    })
    .from(clients)
    .leftJoin(invoiceTotals, eq(invoiceTotals.clientId, clients.id))
    .leftJoin(paymentTotals, eq(paymentTotals.clientId, clients.id))
    .where(and(eq(clients.id, clientId), isNull(clients.deletedAt)))

  return row?.outstandingBalanceCents ?? 0
}

async function getClientBillingTrend(clientId: string, now: Date): Promise<ClientBillingPoint[]> {
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1))

  const [invoiceRows, projectRows, recurringRows] = await Promise.all([
    database
      .select({ createdAt: invoices.createdAt, totalCents: invoices.totalCents })
      .from(invoices)
      .where(
        and(
          eq(invoices.clientId, clientId),
          isNull(invoices.deletedAt),
          gte(invoices.createdAt, windowStart)
        )
      ),
    database
      .select({ createdAt: projects.createdAt })
      .from(projects)
      .where(
        and(
          eq(projects.clientId, clientId),
          isNull(projects.deletedAt),
          gte(projects.createdAt, windowStart)
        )
      ),
    database
      .select({ createdAt: recurringInvoices.createdAt })
      .from(recurringInvoices)
      .where(
        and(
          eq(recurringInvoices.clientId, clientId),
          isNull(recurringInvoices.deletedAt),
          gte(recurringInvoices.createdAt, windowStart)
        )
      )
  ])

  return buildClientBillingTrend(
    {
      invoices: invoiceRows.map((row) => ({
        createdAt: row.createdAt,
        totalCents: Number(row.totalCents)
      })),
      projects: projectRows,
      recurringInvoices: recurringRows
    },
    now
  )
}

async function getClientRelatedResourceCounts(
  clientId: string
): Promise<ClientRelatedResourceCounts> {
  const [projectCountRows, invoiceCountRows, recurringInvoiceCountRows] = await Promise.all([
    database
      .select({ value: count() })
      .from(projects)
      .where(and(eq(projects.clientId, clientId), isNull(projects.deletedAt))),
    database
      .select({ value: count() })
      .from(invoices)
      .where(and(eq(invoices.clientId, clientId), isNull(invoices.deletedAt))),
    database
      .select({ value: count() })
      .from(recurringInvoices)
      .where(and(eq(recurringInvoices.clientId, clientId), isNull(recurringInvoices.deletedAt)))
  ])

  return {
    projects: projectCountRows[0]?.value ?? 0,
    invoices: invoiceCountRows[0]?.value ?? 0,
    recurringInvoices: recurringInvoiceCountRows[0]?.value ?? 0
  }
}

function toClientListItem(row: ClientListRow, defaultCurrency: string): ClientListItem {
  const outstandingBalanceCents = Number(row.outstandingBalanceCents)
  const invoiceCount = Number(row.invoiceCount)

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    imageStorageKey: row.imageStorageKey,
    currency: row.currency ?? defaultCurrency,
    outstandingBalanceCents,
    invoiceCount,
    health: getClientHealth({ outstandingBalanceCents, invoiceCount }),
    createdAt: row.createdAt,
    deletedAt: row.deletedAt
  }
}

type ToClientDetailInput = {
  row: ClientDetailRowWithImage
  outstandingBalanceCents: number
  relatedResources: ClientRelatedResourceCounts
  billingTrend: ClientBillingPoint[]
  defaultCurrency: string
}

function toClientDetail({
  row,
  outstandingBalanceCents,
  relatedResources,
  billingTrend,
  defaultCurrency
}: ToClientDetailInput): ClientDetail {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? "",
    website: row.website ?? "",
    taxId: row.taxId ?? "",
    currency: row.currency ?? defaultCurrency,
    address: {
      line1: row.addressLine1 ?? "",
      line2: row.addressLine2 ?? "",
      city: row.city ?? "",
      state: row.state ?? "",
      postalCode: row.postalCode ?? "",
      country: row.country ?? ""
    },
    notes: row.notes ?? "",
    imageStorageKey: row.image?.path ?? null,
    outstandingBalanceCents,
    health: getClientHealth({
      outstandingBalanceCents,
      invoiceCount: relatedResources.invoices
    }),
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    relatedResources,
    billingTrend
  }
}
