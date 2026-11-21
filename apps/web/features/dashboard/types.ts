import { type ActivityEntry } from "@/features/activityLog"

import { type DashboardQuery } from "./schemas"
import {
  type AttentionItem,
  type CashflowPoint,
  type InvoiceLifecycle,
  type LeadPipeline,
  type PeriodDelta,
  type ReceivablesAging,
  type TopClient,
  type UnbilledWork,
  type UpcomingInvoice,
  type UpcomingSchedule
} from "./services"

export type DashboardDefaults = {
  defaultCurrency: string
  defaultLocale: string
  defaultTimezone: string
}

export type DashboardReceivables = {
  outstandingCents: number
  outstandingCount: number
  overdueCents: number
  overdueCount: number
}

export type DashboardMetric = {
  delta: PeriodDelta
  // Twelve monthly values ending with the current month, the sparkline's whole input. Deliberately
  // the fixed twelve-month window rather than the selected period: a sparkline exists to give the
  // figure beside it a shape, and a one-month period would leave it with a single point.
  series: number[]
}

export type DashboardMetrics = {
  revenue: DashboardMetric
  expenses: DashboardMetric
  net: DashboardMetric
}

export type DashboardPageData = {
  query: DashboardQuery
  // The one currency every figure below is expressed in, with the number of further currencies the
  // instance also holds money in. Tiles say so rather than silently reporting a partial total.
  currency: string
  otherCurrencyCount: number
  receivables: DashboardReceivables
  aging: ReceivablesAging
  metrics: DashboardMetrics
  unbilled: UnbilledWork
  cashflow: CashflowPoint[]
  lifecycle: InvoiceLifecycle
  upcomingInvoices: UpcomingInvoice[]
  topClients: TopClient[]
  // Ranked across five document types, and capped: `attentionTotalCount` is the untruncated size, so
  // a rail that shows seven rows can still say how many more are behind them.
  attention: AttentionItem[]
  attentionTotalCount: number
  pipeline: LeadPipeline
  schedules: UpcomingSchedule[]
  activity: ActivityEntry[]
  defaults: DashboardDefaults
}
