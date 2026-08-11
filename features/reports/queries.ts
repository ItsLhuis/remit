import { and, eq, gte, inArray, isNotNull, isNull, lt, sql, type SQL } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import { t } from "@/lib/i18n/server"

import { formatMonthYear } from "@/lib/utils"

import { database } from "@/database"
import {
  clients,
  creditNotes,
  expenses,
  invoices,
  lineItems,
  projects,
  taxRates,
  timeEntries
} from "@/database/schema"

import { calculateRebillableCents } from "@/features/expenses"

import { calculateEntryAmountCents } from "@/features/timeTracking"

import { parseReportQuery, type ReportQuery } from "./schemas"
import {
  aggregateExpensesByCategory,
  aggregateRevenue,
  aggregateRevenueByTaxRate,
  aggregateTaxSummary,
  aggregateTimeByProject,
  resolveReportWindow,
  toUtcMonthKey,
  type ReportResult,
  type RevenueReportRow,
  type TaxReportRow
} from "./services"
import { type ReportDefaults, type ReportFilterOptions, type ReportsPageData } from "./types"

// Only issued documents are reported on. A draft has not been shown to anyone, so counting it as
// revenue or as a tax liability would report money that was never charged.
const ISSUED_INVOICE_STATUSES = ["sent", "paid"] as const

// The client of a project-level invoice, reached through its project — the same alias
// features/dashboard/queries.ts uses, because an invoice may be raised against a client, a project,
// or both.
const projectClients = alias(clients, "project_clients")

export async function getReportsPageData(input: unknown): Promise<ReportsPageData> {
  const query = parseReportQuery(input)
  const defaults = await getReportDefaults()

  const [result, filterOptions] = await Promise.all([
    getReportResult(query, defaults),
    getReportFilterOptions()
  ])

  return { query, result, filterOptions, defaults }
}

export async function getReportDefaults(): Promise<ReportDefaults> {
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

// The page and the export action both come through here, so a CSV can never be built from a
// different population than the table the reader was looking at when they clicked it.
export async function getReportResult(
  query: ReportQuery,
  defaults: ReportDefaults
): Promise<ReportResult> {
  switch (query.report) {
    case "revenueByClient":
      return aggregateRevenue(await listRevenueRows(query, defaults, "client"))
    case "revenueByProject":
      return aggregateRevenue(await listRevenueRows(query, defaults, "project"))
    case "revenueByMonth":
      return aggregateRevenue(await listRevenueRows(query, defaults, "month"), "key")
    case "revenueByTaxRate":
      return aggregateRevenueByTaxRate(await listTaxRows(query))
    case "timeByProject":
      return aggregateTimeByProject(await listTimeRows(query, defaults), {
        billable: t("reports.time.billable"),
        nonBillable: t("reports.time.nonBillable")
      })
    case "expensesByCategory":
      return aggregateExpensesByCategory(await listExpenseRows(query))
    case "taxSummary":
      return aggregateTaxSummary(await listTaxRows(query))
  }
}

async function getReportFilterOptions(): Promise<ReportFilterOptions> {
  const [clientRows, projectRows, taxRateRows] = await Promise.all([
    database
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(isNull(clients.deletedAt))
      .orderBy(clients.name),
    database
      .select({ id: projects.id, name: projects.name, clientName: clients.name })
      .from(projects)
      .innerJoin(clients, eq(clients.id, projects.clientId))
      .where(isNull(projects.deletedAt))
      .orderBy(projects.name),
    database
      .select({ id: taxRates.id, name: taxRates.name, percentage: taxRates.percentage })
      .from(taxRates)
      .where(isNull(taxRates.deletedAt))
      .orderBy(taxRates.name)
  ])

  return {
    clients: clientRows.map((row) => ({ id: row.id, label: row.name })),
    projects: projectRows.map((row) => ({
      id: row.id,
      label: t("reports.filters.projectOption", { client: row.clientName, project: row.name })
    })),
    taxRates: taxRateRows.map((row) => ({
      id: row.id,
      label: t("reports.filters.taxRateOption", {
        name: row.name,
        percentage: Number(row.percentage)
      })
    }))
  }
}

type RevenueDimension = "client" | "project" | "month"

// `issue_date` is set by `sendInvoice` in features/invoices/mutations.ts at the moment an invoice
// leaves draft, so every row in this population carries one; the `isNotNull` guard is what keeps a
// hand-edited row out of a month bucket it cannot be placed in rather than a defensive filter.
//
// Credits are attributed to the invoice's period, not to the credit note's own issue date: a credit
// note undoes part of a specific invoice, and splitting the two across periods would leave a month's
// revenue overstated forever with the correction parked somewhere the reader is not looking.
async function listRevenueRows(
  query: ReportQuery,
  defaults: ReportDefaults,
  dimension: RevenueDimension
): Promise<RevenueReportRow[]> {
  const creditNoteTotals = getCreditNoteTotalsSubquery()

  const rows = await database
    .select({
      currency: invoices.currency,
      totalCents: invoices.totalCents,
      amountPaidCents: invoices.amountPaidCents,
      issueDate: invoices.issueDate,
      creditedCents: sql<number>`cast(coalesce(${creditNoteTotals.creditedCents}, 0) as bigint)`,
      clientId: sql<string | null>`coalesce(${invoices.clientId}, ${projects.clientId})`,
      clientName: sql<string | null>`coalesce(${clients.name}, ${projectClients.name})`,
      projectId: invoices.projectId,
      projectName: projects.name
    })
    .from(invoices)
    .leftJoin(projects, eq(projects.id, invoices.projectId))
    .leftJoin(clients, eq(clients.id, invoices.clientId))
    .leftJoin(projectClients, eq(projectClients.id, projects.clientId))
    .leftJoin(creditNoteTotals, eq(creditNoteTotals.invoiceId, invoices.id))
    .where(and(...buildRevenueConditions(query)))

  return rows.map((row) => ({
    ...toRevenueDimension(row, dimension, defaults.defaultLocale),
    currency: row.currency,
    totalCents: Number(row.totalCents),
    creditedCents: Number(row.creditedCents),
    amountPaidCents: Number(row.amountPaidCents)
  }))
}

type RevenueDimensionRow = {
  issueDate: Date | null
  clientId: string | null
  clientName: string | null
  projectId: string | null
  projectName: string | null
}

function toRevenueDimension(
  row: RevenueDimensionRow,
  dimension: RevenueDimension,
  locale: string
): Pick<RevenueReportRow, "key" | "label" | "sublabel"> {
  if (dimension === "month") {
    const monthKey = row.issueDate ? toUtcMonthKey(row.issueDate) : ""

    return { key: monthKey, label: formatMonthYear(monthKey, locale), sublabel: null }
  }

  if (dimension === "project") {
    return {
      key: row.projectId ?? "",
      label: row.projectName ?? t("reports.rows.noProject"),
      sublabel: row.clientName
    }
  }

  return {
    key: row.clientId ?? "",
    label: row.clientName ?? t("reports.rows.noClient"),
    sublabel: null
  }
}

function buildRevenueConditions(query: ReportQuery): SQL[] {
  const window = resolveReportWindow(query.from, query.to)

  const conditions: SQL[] = [
    isNull(invoices.deletedAt),
    isNotNull(invoices.issueDate),
    inArray(invoices.status, [...ISSUED_INVOICE_STATUSES])
  ]

  if (window.from) conditions.push(gte(invoices.issueDate, window.from))
  if (window.toExclusive) conditions.push(lt(invoices.issueDate, window.toExclusive))
  if (query.projectId) conditions.push(eq(invoices.projectId, query.projectId))
  if (query.clientId) {
    conditions.push(sql`coalesce(${invoices.clientId}, ${projects.clientId}) = ${query.clientId}`)
  }

  return conditions
}

// Both tax reports read the same two populations — the invoice lines that charged tax and the credit
// note lines that gave it back — so their totals reconcile with each other by construction. Credit
// note lines are keyed by the same rate bucket and subtracted there rather than netted per invoice,
// which is what lets a rate that was only ever credited still appear as a row.
async function listTaxRows(query: ReportQuery): Promise<TaxReportRow[]> {
  const [invoiced, credited] = await Promise.all([
    listInvoiceTaxLines(query),
    listCreditNoteTaxLines(query)
  ])

  return [
    ...invoiced.map((row) => ({
      ...toTaxBucket(row),
      taxableCents: row.totalCents - row.taxAmountCents,
      taxCents: row.taxAmountCents,
      creditedTaxableCents: 0,
      creditedTaxCents: 0
    })),
    ...credited.map((row) => ({
      ...toTaxBucket(row),
      taxableCents: 0,
      taxCents: 0,
      creditedTaxableCents: row.totalCents - row.taxAmountCents,
      creditedTaxCents: row.taxAmountCents
    }))
  ]
}

type TaxLineRow = {
  taxRateId: string | null
  taxRateName: string | null
  percentage: number
  currency: string
  totalCents: number
  taxAmountCents: number
}

// Keyed by the snapshot percentage as well as the rate id: `line_items.tax_percentage_snapshot` is
// frozen at issue time, so a rate whose percentage was edited afterwards has charged two different
// amounts under one name, and merging them would report a base at a rate it was never taxed at.
function toTaxBucket(
  row: TaxLineRow
): Pick<TaxReportRow, "key" | "label" | "sublabel" | "currency"> {
  return {
    key: `${row.taxRateId ?? "none"}:${row.percentage}`,
    label: row.taxRateName ?? t("reports.rows.noTaxRate"),
    sublabel: t("reports.rows.percentage", { percentage: row.percentage }),
    currency: row.currency
  }
}

// The currency column is the parameter because it is the only column that differs between the two
// reads below: an invoice line is priced in its invoice's currency and a credit note line in its
// credit note's, and those are separate columns even though a credit note is always raised in the
// currency of the invoice it credits.
function getTaxLineColumns(currency: typeof invoices.currency | typeof creditNotes.currency) {
  return {
    taxRateId: lineItems.taxRateId,
    taxRateName: taxRates.name,
    percentage: lineItems.taxPercentageSnapshot,
    currency,
    totalCents: lineItems.totalCents,
    taxAmountCents: lineItems.taxAmountCents
  }
}

function buildTaxLineConditions(query: ReportQuery): SQL[] {
  const conditions = [...buildRevenueConditions(query), isNull(lineItems.deletedAt)]

  if (query.taxRateId) conditions.push(eq(lineItems.taxRateId, query.taxRateId))

  return conditions
}

async function listInvoiceTaxLines(query: ReportQuery): Promise<TaxLineRow[]> {
  const rows = await database
    .select(getTaxLineColumns(invoices.currency))
    .from(lineItems)
    .innerJoin(invoices, eq(invoices.id, lineItems.invoiceId))
    .leftJoin(projects, eq(projects.id, invoices.projectId))
    .leftJoin(taxRates, eq(taxRates.id, lineItems.taxRateId))
    .where(and(...buildTaxLineConditions(query)))

  return rows.map(toTaxLineRow)
}

async function listCreditNoteTaxLines(query: ReportQuery): Promise<TaxLineRow[]> {
  const rows = await database
    .select(getTaxLineColumns(creditNotes.currency))
    .from(lineItems)
    .innerJoin(creditNotes, eq(creditNotes.id, lineItems.creditNoteId))
    .innerJoin(invoices, eq(invoices.id, creditNotes.invoiceId))
    .leftJoin(projects, eq(projects.id, invoices.projectId))
    .leftJoin(taxRates, eq(taxRates.id, lineItems.taxRateId))
    .where(and(...buildTaxLineConditions(query), isNull(creditNotes.deletedAt)))

  return rows.map(toTaxLineRow)
}

function toTaxLineRow(row: {
  taxRateId: string | null
  taxRateName: string | null
  percentage: string
  currency: string
  totalCents: number
  taxAmountCents: number
}): TaxLineRow {
  return {
    taxRateId: row.taxRateId,
    taxRateName: row.taxRateName,
    percentage: Number(row.percentage),
    currency: row.currency,
    totalCents: Number(row.totalCents),
    taxAmountCents: Number(row.taxAmountCents)
  }
}

// A time entry carries no currency of its own, so it inherits the project's, then the client's, then
// the instance default — the same ladder `resolveHourlyRate` walks for the rate that priced it.
// Running timers are excluded: an entry with no `ended_at` has no duration to report yet.
async function listTimeRows(query: ReportQuery, defaults: ReportDefaults) {
  const window = resolveReportWindow(query.from, query.to)

  const conditions: SQL[] = [
    isNull(timeEntries.deletedAt),
    isNotNull(timeEntries.durationSeconds),
    isNull(projects.deletedAt)
  ]

  if (window.from) conditions.push(gte(timeEntries.startedAt, window.from))
  if (window.toExclusive) conditions.push(lt(timeEntries.startedAt, window.toExclusive))
  if (query.projectId) conditions.push(eq(timeEntries.projectId, query.projectId))
  if (query.clientId) conditions.push(eq(projects.clientId, query.clientId))

  const rows = await database
    .select({
      projectId: timeEntries.projectId,
      projectName: projects.name,
      clientName: clients.name,
      billable: timeEntries.billable,
      durationSeconds: timeEntries.durationSeconds,
      hourlyRateSnapshotCents: timeEntries.hourlyRateSnapshotCents,
      currency: sql<string | null>`coalesce(${projects.currency}, ${clients.currency})`
    })
    .from(timeEntries)
    .innerJoin(projects, eq(projects.id, timeEntries.projectId))
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(and(...conditions))

  return rows.map((row) => ({
    projectId: row.projectId,
    projectLabel: t("reports.filters.projectOption", {
      client: row.clientName,
      project: row.projectName
    }),
    billable: row.billable,
    currency: row.currency ?? defaults.defaultCurrency,
    durationSeconds: row.durationSeconds ?? 0,
    amountCents: calculateEntryAmountCents(row.durationSeconds, Number(row.hourlyRateSnapshotCents))
  }))
}

async function listExpenseRows(query: ReportQuery) {
  const window = resolveReportWindow(query.from, query.to)

  const conditions: SQL[] = [isNull(expenses.deletedAt)]

  if (window.from) conditions.push(gte(expenses.spentAt, window.from))
  if (window.toExclusive) conditions.push(lt(expenses.spentAt, window.toExclusive))
  if (query.projectId) conditions.push(eq(expenses.projectId, query.projectId))
  if (query.clientId) {
    conditions.push(sql`coalesce(${expenses.clientId}, ${projects.clientId}) = ${query.clientId}`)
  }

  const rows = await database
    .select({
      category: expenses.category,
      currency: expenses.currency,
      amountCents: expenses.amountCents,
      rebillable: expenses.rebillable,
      markupPercentage: expenses.markupPercentage
    })
    .from(expenses)
    .leftJoin(projects, eq(projects.id, expenses.projectId))
    .where(and(...conditions))

  return rows.map((row) => {
    const amountCents = Number(row.amountCents)
    const markupPercentage = row.markupPercentage === null ? null : Number(row.markupPercentage)

    return {
      category: row.category,
      currency: row.currency,
      amountCents,
      rebillableCents: calculateRebillableCents({
        amountCents,
        rebillable: row.rebillable,
        markupPercentage
      })
    }
  })
}

// The twin of `getCreditNoteTotalsSubquery` in features/dashboard/queries.ts, and deliberately not
// shared with it. A Drizzle subquery is IO, so it cannot live in `services/`, and the only sanctioned
// cross-feature door is a read function on a `server.ts` barrel — which would hand another feature a
// query builder rather than an answer. The two must agree on one thing only: a credit note counts
// against its invoice unless it is soft-deleted.
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
