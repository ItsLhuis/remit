import { and, eq, gte, isNull, sql, type SQL } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import { database } from "@/database"
import { clients, creditNotes, expenses, invoices, payments, projects } from "@/database/schema"

import { listActivity } from "@/features/activityLog/server"

import { isInvoiceOverdue } from "@/features/invoices/server"

import { parseDashboardQuery } from "./schemas"
import {
  buildCashflowSeries,
  getCurrencyTotal,
  getReceivableCents,
  isWithinWindow,
  resolveDashboardWindow,
  resolveEarliestWindowStart,
  resolvePrimaryCurrency,
  selectUpcomingInvoices,
  startOfUtcYear,
  summarizeExpenseSpend,
  summarizeReceivables,
  summarizeRevenue,
  summarizeTopClients,
  type CashflowRow,
  type ClientRevenueRow,
  type DashboardWindow,
  type UpcomingInvoiceRow
} from "./services"
import { type DashboardDefaults, type DashboardPageData } from "./types"

const CASHFLOW_MONTHS = 12
const RECENT_ACTIVITY_LIMIT = 6

// The client of a project-level invoice, reached through its project. Aliased because the same
// `clients` table is also joined directly for an invoice raised straight against a client, and an
// invoice may carry either link, or both — the same shape `features/invoices/overviewQueries.ts`
// uses for the invoice list.
const projectClients = alias(clients, "project_clients")

// One read per table, aggregated in memory rather than one query per tile. Every tile, the
// twelve-month chart and the upcoming list are cuts of the same three populations, and asking the
// database separately for each would issue a dozen queries whose answers could disagree if a
// payment landed between them. `now` is resolved once and threaded through every service for the
// same reason.
export async function getDashboardPageData(input: unknown): Promise<DashboardPageData> {
  const query = parseDashboardQuery(input)
  const now = new Date()

  const periodWindow = resolveDashboardWindow(query.period, now)
  const cashflowWindow: DashboardWindow = {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (CASHFLOW_MONTHS - 1), 1))
  }
  const readFrom = resolveEarliestWindowStart([
    periodWindow,
    cashflowWindow,
    { start: startOfUtcYear(now) }
  ])

  const [defaults, paymentRows, invoiceRows, expenseRows, activity] = await Promise.all([
    getDashboardDefaults(),
    listRevenuePayments(readFrom),
    listOutstandingInvoices(now),
    listExpenseSpend(readFrom),
    listActivity({ entityType: null, read: "all", page: 1, perPage: RECENT_ACTIVITY_LIMIT })
  ])

  const revenue = summarizeRevenue(paymentRows, now, periodWindow)
  const receivables = summarizeReceivables(invoiceRows)
  const expenseSpend = summarizeExpenseSpend(expenseRows, periodWindow)

  const { currency, otherCurrencyCount } = resolvePrimaryCurrency(
    [revenue.yearToDate, receivables.outstanding, expenseSpend.period],
    defaults.defaultCurrency
  )

  const periodRevenueCents = getCurrencyTotal(revenue.period, currency)
  const periodExpenseCents = getCurrencyTotal(expenseSpend.period, currency)

  return {
    query,
    currency,
    otherCurrencyCount,
    revenue: {
      monthToDateCents: getCurrencyTotal(revenue.monthToDate, currency),
      yearToDateCents: getCurrencyTotal(revenue.yearToDate, currency),
      periodCents: periodRevenueCents
    },
    receivables: {
      outstandingCents: getCurrencyTotal(receivables.outstanding, currency),
      outstandingCount: receivables.outstandingCount,
      overdueCents: getCurrencyTotal(receivables.overdue, currency),
      overdueCount: receivables.overdueCount
    },
    expenses: {
      periodCents: periodExpenseCents,
      count: expenseSpend.count
    },
    // An estimate, and labelled as one on the tile: it subtracts recorded expenses from banked
    // payments in one currency, so it knows nothing about tax, unrecorded costs, or work earning in
    // another currency.
    profitEstimateCents: periodRevenueCents - periodExpenseCents,
    cashflow: buildCashflowSeries(
      {
        revenue: toCashflowRows(paymentRows, currency, cashflowWindow, (row) => row.paidAt),
        expenses: toCashflowRows(expenseRows, currency, cashflowWindow, (row) => row.spentAt)
      },
      now,
      CASHFLOW_MONTHS
    ),
    upcomingInvoices: selectUpcomingInvoices(invoiceRows, now),
    topClients: summarizeTopClients(toClientRevenueRows(paymentRows, periodWindow), currency),
    activity: activity.rows,
    defaults
  }
}

async function getDashboardDefaults(): Promise<DashboardDefaults> {
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

type RevenuePaymentReadRow = {
  amountCents: number
  currency: string
  paidAt: Date
  clientId: string | null
  clientName: string | null
}

// The payment's own currency, not the invoice's: a payment records what actually arrived, and it is
// the settlement record every revenue figure on this page is built from. Payments against a
// soft-deleted invoice are excluded — that money is no longer attributable to a live document.
async function listRevenuePayments(from: Date | null): Promise<RevenuePaymentReadRow[]> {
  const conditions: SQL[] = [isNull(payments.deletedAt), isNull(invoices.deletedAt)]

  if (from) conditions.push(gte(payments.paidAt, from))

  const rows = await database
    .select({
      amountCents: payments.amountCents,
      currency: payments.currency,
      paidAt: payments.paidAt,
      clientId: sql<string | null>`coalesce(${invoices.clientId}, ${projects.clientId})`,
      clientName: sql<string | null>`coalesce(${clients.name}, ${projectClients.name})`
    })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .leftJoin(projects, eq(projects.id, invoices.projectId))
    .leftJoin(clients, eq(clients.id, invoices.clientId))
    .leftJoin(projectClients, eq(projectClients.id, projects.clientId))
    .where(and(...conditions))

  return rows.map((row) => ({
    amountCents: Number(row.amountCents),
    currency: row.currency,
    paidAt: row.paidAt,
    clientId: row.clientId,
    clientName: row.clientName
  }))
}

type OutstandingInvoiceReadRow = UpcomingInvoiceRow & {
  totalCents: number
  amountPaidCents: number
  creditedCents: number
  isOverdue: boolean
}

// Only `sent` invoices: a draft has not been issued to anyone and a paid one is settled, so neither
// is money the freelancer is waiting for. Invoices whose project or client has since been
// soft-deleted are kept — money owed does not stop being owed because the project closed — which is
// the same population `features/invoices/overviewQueries.ts` lists for the same reason.
async function listOutstandingInvoices(now: Date): Promise<OutstandingInvoiceReadRow[]> {
  const creditNoteTotals = getCreditNoteTotalsSubquery()

  const rows = await database
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      currency: invoices.currency,
      totalCents: invoices.totalCents,
      amountPaidCents: invoices.amountPaidCents,
      dueDate: invoices.dueDate,
      paidAt: invoices.paidAt,
      creditedCents: sql<number>`cast(coalesce(${creditNoteTotals.creditedCents}, 0) as bigint)`,
      parentName: sql<
        string | null
      >`coalesce(${clients.name}, ${projectClients.name}, ${projects.name})`
    })
    .from(invoices)
    .leftJoin(projects, eq(projects.id, invoices.projectId))
    .leftJoin(clients, eq(clients.id, invoices.clientId))
    .leftJoin(projectClients, eq(projectClients.id, projects.clientId))
    .leftJoin(creditNoteTotals, eq(creditNoteTotals.invoiceId, invoices.id))
    .where(and(eq(invoices.status, "sent"), isNull(invoices.deletedAt)))

  return rows.map((row) => {
    const totalCents = Number(row.totalCents)
    const amountPaidCents = Number(row.amountPaidCents)
    const creditedCents = Number(row.creditedCents)

    return {
      id: row.id,
      number: row.number,
      parentName: row.parentName ?? "",
      currency: row.currency,
      dueDate: row.dueDate,
      totalCents,
      amountPaidCents,
      creditedCents,
      receivableCents: getReceivableCents({ totalCents, amountPaidCents, creditedCents }),
      // Derived through the invoices feature's own predicate rather than restated here, so the
      // dashboard's overdue count can never contradict the badge the invoice list renders.
      isOverdue: isInvoiceOverdue(
        { status: row.status, dueDate: row.dueDate, paidAt: row.paidAt },
        now
      )
    }
  })
}

type ExpenseSpendReadRow = {
  amountCents: number
  currency: string
  spentAt: Date
}

async function listExpenseSpend(from: Date | null): Promise<ExpenseSpendReadRow[]> {
  const conditions: SQL[] = [isNull(expenses.deletedAt)]

  if (from) conditions.push(gte(expenses.spentAt, from))

  const rows = await database
    .select({
      amountCents: expenses.amountCents,
      currency: expenses.currency,
      spentAt: expenses.spentAt
    })
    .from(expenses)
    .where(and(...conditions))

  return rows.map((row) => ({
    amountCents: Number(row.amountCents),
    currency: row.currency,
    spentAt: row.spentAt
  }))
}

function getCreditNoteTotalsSubquery() {
  return database
    .select({
      invoiceId: creditNotes.invoiceId,
      creditedCents: sql<number>`cast(coalesce(sum(${creditNotes.totalCents}), 0) as bigint)`.as(
        "credited_cents"
      )
    })
    .from(creditNotes)
    .where(isNull(creditNotes.deletedAt))
    .groupBy(creditNotes.invoiceId)
    .as("invoice_credit_note_totals")
}

function toCashflowRows<TRow extends { amountCents: number; currency: string }>(
  rows: readonly TRow[],
  currency: string,
  window: DashboardWindow,
  getOccurredAt: (row: TRow) => Date
): CashflowRow[] {
  return rows.flatMap((row) => {
    const occurredAt = getOccurredAt(row)

    if (row.currency !== currency || !isWithinWindow(occurredAt, window)) return []

    return [{ occurredAt, amountCents: row.amountCents }]
  })
}

function toClientRevenueRows(
  rows: readonly RevenuePaymentReadRow[],
  window: DashboardWindow
): ClientRevenueRow[] {
  return rows.flatMap((row) =>
    row.clientId && row.clientName && isWithinWindow(row.paidAt, window)
      ? [
          {
            clientId: row.clientId,
            clientName: row.clientName,
            currency: row.currency,
            amountCents: row.amountCents
          }
        ]
      : []
  )
}
