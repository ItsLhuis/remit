import { eq } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { formatDay, formatNumber } from "@/lib/utils"

import { database } from "@/database"
import { clients, projects, taxRates } from "@/database/schema"

import {
  reportColumnLabelKeys,
  reportDimensionLabelKeys,
  reportFilterLabelKeys,
  reportPresentation
} from "./labels"
import { getReportDefaults, getReportResult } from "./queries"
import { REPORT_FILTERS, type ReportFilterId, type ReportQuery } from "./schemas"
import {
  buildReportDocument,
  countReportRows,
  type ReportDocument,
  type ReportDocumentFilter
} from "./services"

// The worker's entry into the report document: everything `buildReportDocument` needs and cannot
// reach itself. Translation, the instance's locale and time zone, and the names behind the filter
// ids all require IO, so they are resolved here and the paged layout stays a pure function
// (ADR-0007).

export type BuiltReportDocument = {
  document: ReportDocument
  rowCount: number
}

export async function buildReportPdfDocument(query: ReportQuery): Promise<BuiltReportDocument> {
  const defaults = await getReportDefaults()

  const [result, filters, business] = await Promise.all([
    getReportResult(query, defaults),
    buildDocumentFilters(query, defaults.defaultLocale, defaults.defaultTimezone),
    readBusinessName()
  ])

  const rowCount = countReportRows(result)

  return {
    document: buildReportDocument({
      result,
      labels: {
        title: t(reportPresentation[query.report].titleKey),
        business,
        dimension: t(reportDimensionLabelKeys[query.report]),
        detail: t("reports.export.columns.detail"),
        total: t("reports.export.columns.total"),
        columns: result.columns.map((column) => t(reportColumnLabelKeys[column])),
        generatedAt: t("reports.document.generatedAt"),
        rows: t("reports.document.rows"),
        rowCount: formatNumber(rowCount, defaults.defaultLocale),
        empty: t("reports.document.empty"),
        page: (page, pages) => t("reports.document.page", { page, pages })
      },
      filters,
      generatedAt: new Date(),
      locale: defaults.defaultLocale,
      timeZone: defaults.defaultTimezone
    }),
    rowCount
  }
}

// Every filter the report offers, including the ones left open: a document that states only the
// narrowing it applied leaves a reader unable to tell "all clients" from "a client filter this
// report does not have".
async function buildDocumentFilters(
  query: ReportQuery,
  locale: string,
  timeZone: string
): Promise<ReportDocumentFilter[]> {
  const entityFilters = await Promise.all(
    REPORT_FILTERS[query.report].map(async (filter) => ({
      label: t(reportFilterLabelKeys[filter].label),
      value: (await readFilterName(filter, query)) ?? t(reportFilterLabelKeys[filter].all)
    }))
  )

  return [
    { label: t("reports.document.dateRange"), value: formatRange(query, locale, timeZone) },
    ...entityFilters
  ]
}

function formatRange(query: ReportQuery, locale: string, timeZone: string): string {
  const from = query.from ? formatDay(query.from, locale, timeZone) : null
  const to = query.to ? formatDay(query.to, locale, timeZone) : null

  if (from && to) return t("reports.document.rangeBetween", { from, to })
  if (from) return t("reports.document.rangeFrom", { from })
  if (to) return t("reports.document.rangeUntil", { to })

  return t("reports.document.rangeAll")
}

// A filter pointing at a record that has since been deleted resolves to nothing, and the caller
// falls back to the "all" label. Naming the id instead would print a uuid on a document handed to an
// accountant; the audit entry keeps the id.
async function readFilterName(filter: ReportFilterId, query: ReportQuery): Promise<string | null> {
  if (filter === "client" && query.clientId) {
    const row = await database.query.clients.findFirst({
      columns: { name: true },
      where: eq(clients.id, query.clientId)
    })

    return row?.name ?? null
  }

  if (filter === "project" && query.projectId) {
    const row = await database.query.projects.findFirst({
      columns: { name: true },
      where: eq(projects.id, query.projectId)
    })

    return row?.name ?? null
  }

  if (filter === "taxRate" && query.taxRateId) {
    const row = await database.query.taxRates.findFirst({
      columns: { name: true, percentage: true },
      where: eq(taxRates.id, query.taxRateId)
    })

    return row
      ? t("reports.filters.taxRateOption", { name: row.name, percentage: Number(row.percentage) })
      : null
  }

  return null
}

async function readBusinessName(): Promise<string | null> {
  const row = await database.query.settings.findFirst({ columns: { businessName: true } })

  return row?.businessName ?? null
}
