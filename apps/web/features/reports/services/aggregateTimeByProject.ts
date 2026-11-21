import { toReportResult, type ReportColumnId, type ReportResult } from "./reportTable"

// One completed time entry. `amountCents` is resolved by the caller through
// `calculateEntryAmountCents` from features/timeTracking, so the value a report totals is the same
// arithmetic the time list already shows per row rather than a second rounding of the same seconds.
export type TimeReportRow = {
  projectId: string
  projectLabel: string
  billable: boolean
  currency: string
  durationSeconds: number
  amountCents: number
}

export type TimeBillableLabels = {
  billable: string
  nonBillable: string
}

export const TIME_REPORT_COLUMNS: ReportColumnId[] = ["entryCount", "hours", "billableValue"]

// A project appears once per billable state, never merged: the split is the question the report
// answers, and a project with 40 billable and 6 written-off hours reads as two rows whose values a
// reader can compare. Non-billable rows still carry a value, because the hours were worked at a
// resolved rate and their cost is what "written off" means.
export function aggregateTimeByProject(
  rows: readonly TimeReportRow[],
  labels: TimeBillableLabels
): ReportResult {
  return toReportResult(
    TIME_REPORT_COLUMNS,
    rows.map((row) => ({
      key: `${row.projectId}:${row.billable ? "billable" : "nonBillable"}`,
      label: row.projectLabel,
      sublabel: row.billable ? labels.billable : labels.nonBillable,
      currency: row.currency,
      cells: [
        { kind: "count" as const, value: 1 },
        { kind: "duration" as const, seconds: row.durationSeconds },
        { kind: "money" as const, cents: row.amountCents }
      ]
    }))
  )
}
