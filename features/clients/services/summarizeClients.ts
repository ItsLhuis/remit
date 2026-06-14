import { getClientHealth } from "./clientHealth"

const NEW_CLIENT_WINDOW_DAYS = 30
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000
const ACQUISITION_TREND_MONTHS = 6

export type ClientSummaryRow = {
  currency: string
  createdAt: Date
  outstandingBalanceCents: number
  invoiceCount: number
}

export type OutstandingByCurrency = {
  currency: string
  totalCents: number
}

export type ClientHealthDistribution = {
  owing: number
  settled: number
  dormant: number
}

export type ClientAcquisitionPoint = {
  month: string
  newClients: number
  totalClients: number
}

export type ClientsSummary = {
  totalClients: number
  owingClients: number
  newClients: number
  outstandingByCurrency: OutstandingByCurrency[]
  hasSingleCurrency: boolean
  healthDistribution: ClientHealthDistribution
  acquisitionTrend: ClientAcquisitionPoint[]
}

export function summarizeClients(
  rows: readonly ClientSummaryRow[],
  now: Date,
  windowDays = NEW_CLIENT_WINDOW_DAYS
): ClientsSummary {
  const newThreshold = now.getTime() - windowDays * MILLISECONDS_PER_DAY

  const outstandingTotals = new Map<string, number>()
  const healthDistribution: ClientHealthDistribution = { owing: 0, settled: 0, dormant: 0 }

  let owingClients = 0
  let newClients = 0

  for (const row of rows) {
    if (row.createdAt.getTime() >= newThreshold) newClients += 1

    if (row.outstandingBalanceCents > 0) {
      owingClients += 1
      outstandingTotals.set(
        row.currency,
        (outstandingTotals.get(row.currency) ?? 0) + row.outstandingBalanceCents
      )
    }

    const health = getClientHealth({
      outstandingBalanceCents: row.outstandingBalanceCents,
      invoiceCount: row.invoiceCount
    })

    healthDistribution[health] += 1
  }

  const outstandingByCurrency = Array.from(outstandingTotals.entries())
    .map(([currency, totalCents]) => ({ currency, totalCents }))
    .sort((first, second) => second.totalCents - first.totalCents)

  return {
    totalClients: rows.length,
    owingClients,
    newClients,
    outstandingByCurrency,
    hasSingleCurrency: outstandingByCurrency.length <= 1,
    healthDistribution,
    acquisitionTrend: buildAcquisitionTrend(rows, now)
  }
}

function buildAcquisitionTrend(
  rows: readonly ClientSummaryRow[],
  now: Date
): ClientAcquisitionPoint[] {
  const buckets: ClientAcquisitionPoint[] = []

  let year = now.getUTCFullYear()
  let month = now.getUTCMonth()

  for (let index = 0; index < ACQUISITION_TREND_MONTHS; index += 1) {
    const start = Date.UTC(year, month, 1)
    const end = Date.UTC(year, month + 1, 1)

    let newClients = 0
    let totalClients = 0

    for (const row of rows) {
      const createdAt = row.createdAt.getTime()

      if (createdAt < end) totalClients += 1
      if (createdAt >= start && createdAt < end) newClients += 1
    }

    buckets.unshift({
      month: `${year}-${String(month + 1).padStart(2, "0")}`,
      newClients,
      totalClients
    })

    month -= 1

    if (month < 0) {
      month = 11
      year -= 1
    }
  }

  return buckets
}
