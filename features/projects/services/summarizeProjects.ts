import { type ProjectStatus } from "../schemas"

const ACQUISITION_TREND_MONTHS = 6

export type ProjectSummaryRow = {
  status: ProjectStatus
  createdAt: Date
}

export type ProjectAcquisitionPoint = {
  month: string
  newProjects: number
  totalProjects: number
}

export type ProjectsSummary = {
  total: number
  active: number
  onHold: number
  completed: number
  cancelled: number
  newThisMonth: number
  acquisitionTrend: ProjectAcquisitionPoint[]
}

export function summarizeProjects(rows: ProjectSummaryRow[], now: Date): ProjectsSummary {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const summary: ProjectsSummary = {
    total: 0,
    active: 0,
    onHold: 0,
    completed: 0,
    cancelled: 0,
    newThisMonth: 0,
    acquisitionTrend: []
  }

  for (const row of rows) {
    summary.total += 1

    if (row.status === "active") summary.active += 1
    else if (row.status === "on_hold") summary.onHold += 1
    else if (row.status === "completed") summary.completed += 1
    else summary.cancelled += 1

    if (row.createdAt >= monthStart) summary.newThisMonth += 1
  }

  summary.acquisitionTrend = buildAcquisitionTrend(rows, now)

  return summary
}

function buildAcquisitionTrend(rows: ProjectSummaryRow[], now: Date): ProjectAcquisitionPoint[] {
  const buckets: ProjectAcquisitionPoint[] = []

  let year = now.getUTCFullYear()
  let month = now.getUTCMonth()

  for (let index = 0; index < ACQUISITION_TREND_MONTHS; index += 1) {
    const start = Date.UTC(year, month, 1)
    const end = Date.UTC(year, month + 1, 1)

    let newProjects = 0
    let totalProjects = 0

    for (const row of rows) {
      const createdAt = row.createdAt.getTime()

      // `totalProjects` is cumulative to the end of the bucket, not the bucket's own count, so the
      // trend line shows the portfolio growing rather than repeating `newProjects`.
      if (createdAt < end) totalProjects += 1
      if (createdAt >= start && createdAt < end) newProjects += 1
    }

    buckets.unshift({
      month: `${year}-${String(month + 1).padStart(2, "0")}`,
      newProjects,
      totalProjects
    })

    month -= 1

    if (month < 0) {
      month = 11
      year -= 1
    }
  }

  return buckets
}
