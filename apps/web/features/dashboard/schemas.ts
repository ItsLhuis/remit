import { z } from "zod"

import { readStringParam } from "@/lib/utils"

export const DASHBOARD_PERIODS = ["month", "quarter", "year", "all"] as const

export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number]

// Year rather than month, so the period-scoped figures line up with the year-to-date revenue tile
// beside them and a dashboard opened on the first of a month is not blank.
export const DEFAULT_DASHBOARD_PERIOD: DashboardPeriod = "year"

export const dashboardQuerySchema = z.object({
  period: z.enum(DASHBOARD_PERIODS).catch(DEFAULT_DASHBOARD_PERIOD)
})

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>

export function parseDashboardQuery(input: unknown): DashboardQuery {
  return dashboardQuerySchema.parse({
    period: readStringParam(input, "period") || DEFAULT_DASHBOARD_PERIOD
  })
}
