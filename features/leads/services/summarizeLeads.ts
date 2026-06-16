import { type LeadStatus } from "../schemas"

const ACQUISITION_TREND_MONTHS = 6

export type LeadSummaryRow = {
  status: LeadStatus
  createdAt: Date
  convertedAt: Date | null
}

export type LeadAcquisitionPoint = {
  month: string
  newLeads: number
  totalLeads: number
}

export type LeadsSummary = {
  total: number
  open: number
  won: number
  lost: number
  converted: number
  newThisMonth: number
  acquisitionTrend: LeadAcquisitionPoint[]
}

export function summarizeLeads(rows: LeadSummaryRow[], now: Date): LeadsSummary {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const summary: LeadsSummary = {
    total: 0,
    open: 0,
    won: 0,
    lost: 0,
    converted: 0,
    newThisMonth: 0,
    acquisitionTrend: []
  }

  for (const row of rows) {
    summary.total += 1

    if (row.status === "won") summary.won += 1
    else if (row.status === "lost") summary.lost += 1
    else summary.open += 1

    if (row.convertedAt !== null) summary.converted += 1

    if (row.createdAt >= monthStart) summary.newThisMonth += 1
  }

  summary.acquisitionTrend = buildAcquisitionTrend(rows, now)

  return summary
}

function buildAcquisitionTrend(rows: LeadSummaryRow[], now: Date): LeadAcquisitionPoint[] {
  const buckets: LeadAcquisitionPoint[] = []

  let year = now.getUTCFullYear()
  let month = now.getUTCMonth()

  for (let index = 0; index < ACQUISITION_TREND_MONTHS; index += 1) {
    const start = Date.UTC(year, month, 1)
    const end = Date.UTC(year, month + 1, 1)

    let newLeads = 0
    let totalLeads = 0

    for (const row of rows) {
      const createdAt = row.createdAt.getTime()

      if (createdAt < end) totalLeads += 1
      if (createdAt >= start && createdAt < end) newLeads += 1
    }

    buckets.unshift({
      month: `${year}-${String(month + 1).padStart(2, "0")}`,
      newLeads,
      totalLeads
    })

    month -= 1

    if (month < 0) {
      month = 11
      year -= 1
    }
  }

  return buckets
}
