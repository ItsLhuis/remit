import { type ActivityEntry } from "@/features/activityLog"

import { type DashboardQuery } from "./schemas"
import { type CashflowPoint, type TopClient, type UpcomingInvoice } from "./services"

export type DashboardDefaults = {
  defaultCurrency: string
  defaultLocale: string
  defaultTimezone: string
}

export type DashboardRevenue = {
  monthToDateCents: number
  yearToDateCents: number
  periodCents: number
}

export type DashboardReceivables = {
  outstandingCents: number
  outstandingCount: number
  overdueCents: number
  overdueCount: number
}

export type DashboardExpenses = {
  periodCents: number
  count: number
}

export type DashboardPageData = {
  query: DashboardQuery
  // The one currency every figure below is expressed in, with the number of further currencies the
  // instance also holds money in. Tiles say so rather than silently reporting a partial total.
  currency: string
  otherCurrencyCount: number
  revenue: DashboardRevenue
  receivables: DashboardReceivables
  expenses: DashboardExpenses
  profitEstimateCents: number
  cashflow: CashflowPoint[]
  upcomingInvoices: UpcomingInvoice[]
  topClients: TopClient[]
  activity: ActivityEntry[]
  defaults: DashboardDefaults
}
