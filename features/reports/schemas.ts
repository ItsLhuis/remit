import { z } from "zod"

import { readStringParam } from "@/lib/utils"

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const REPORT_KINDS = [
  "revenueByClient",
  "revenueByProject",
  "revenueByMonth",
  "revenueByTaxRate",
  "timeByProject",
  "expensesByCategory",
  "taxSummary"
] as const

export type ReportKind = (typeof REPORT_KINDS)[number]

export const DEFAULT_REPORT: ReportKind = "revenueByClient"

// Declared as a union rather than derived from a runtime array: nothing iterates every filter id,
// only the per-report lists below, so a `REPORT_FILTER_IDS` const would exist purely to be typed off.
export type ReportFilterId = "client" | "project" | "taxRate"

// Which entity filter each report offers. A date range applies to every report and is not listed.
// This is the single source for both the controls the page renders and the values the query keeps,
// so a filter that is not on screen can never still be narrowing the rows behind it.
export const REPORT_FILTERS = {
  revenueByClient: ["client"],
  revenueByProject: ["client", "project"],
  revenueByMonth: ["client"],
  revenueByTaxRate: ["taxRate"],
  timeByProject: ["client", "project"],
  expensesByCategory: ["client", "project"],
  taxSummary: ["taxRate"]
} as const satisfies Record<ReportKind, readonly ReportFilterId[]>

export const reportQuerySchema = z.object({
  report: z.enum(REPORT_KINDS).catch(DEFAULT_REPORT),
  from: z.date().nullable().catch(null),
  to: z.date().nullable().catch(null),
  clientId: z.uuid().nullable().catch(null),
  projectId: z.uuid().nullable().catch(null),
  taxRateId: z.uuid().nullable().catch(null)
})

export type ReportQuery = z.infer<typeof reportQuerySchema>

// Applied to every parse, including the one the export action performs on input it did not build.
// The audit snapshot records the query that actually ran, so an id smuggled in for a report that
// does not offer that filter must be dropped here rather than silently ignored downstream.
export function scopeReportFilters(query: ReportQuery): ReportQuery {
  const allowed: readonly ReportFilterId[] = REPORT_FILTERS[query.report]

  return {
    ...query,
    clientId: allowed.includes("client") ? query.clientId : null,
    projectId: allowed.includes("project") ? query.projectId : null,
    taxRateId: allowed.includes("taxRate") ? query.taxRateId : null
  }
}

export function parseReportQuery(input: unknown): ReportQuery {
  return scopeReportFilters(
    reportQuerySchema.parse({
      report: readStringParam(input, "report") || DEFAULT_REPORT,
      from: readDayParam(input, "from"),
      to: readDayParam(input, "to"),
      clientId: readStringParam(input, "client") || null,
      projectId: readStringParam(input, "project") || null,
      taxRateId: readStringParam(input, "taxRate") || null
    })
  )
}

// The range travels as the calendar day the picker wrote, not as an epoch instant, because a report
// range is a human date a reader retypes and shares. Pinned to UTC midnight for the same reason
// `expenses.schemas.ts` pins `spentAt`: parsing a bare day with `new Date` reads it in the server's
// zone and shifts the boundary a day west of Greenwich.
function readDayParam(input: unknown, key: string): Date | null {
  const raw = readStringParam(input, key)

  return DAY_PATTERN.test(raw) ? new Date(`${raw}T00:00:00.000Z`) : null
}
