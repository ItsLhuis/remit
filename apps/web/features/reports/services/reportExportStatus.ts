import { type ReportExportStatus } from "../schemas"

// The pair of statuses that means "a render is in flight". The page polls while a state is one of
// these and stops when it is not, so a job that never reaches a terminal status leaves the control
// waiting rather than the interval running forever against a row that will not change.
export const ACTIVE_REPORT_EXPORT_STATUSES = ["pending", "running"] as const

export function isActiveReportExportStatus(status: ReportExportStatus): boolean {
  return ACTIVE_REPORT_EXPORT_STATUSES.some((active) => active === status)
}

export type ReportExportFailureReason = "renderFailed" | "storageFailed"

const FAILURE_REASONS: readonly ReportExportFailureReason[] = ["renderFailed", "storageFailed"]

// The column is nullable text, so a row written by an older build can hold anything. The caller
// turns the result into a translated message, so an unrecognised value has to collapse to null
// rather than reach `t()` as a key.
export function toReportExportFailureReason(
  value: string | null
): ReportExportFailureReason | null {
  return FAILURE_REASONS.find((reason) => reason === value) ?? null
}
