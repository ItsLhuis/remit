import { type DataExportStatus } from "../schemas"

// One export at a time per instance, and this is the pair of statuses that means "in flight". Shared
// with `queries.ts`, which filters on the same tuple: a second request while one of these is
// outstanding would read the same tables twice and race the first archive's storage write.
export const ACTIVE_DATA_EXPORT_STATUSES = ["pending", "running"] as const

export function isActiveDataExportStatus(status: DataExportStatus): boolean {
  return ACTIVE_DATA_EXPORT_STATUSES.some((active) => active === status)
}

export type DataExportFailureReason = "clientMissing" | "assemblyFailed" | "storageFailed"

const FAILURE_REASONS: readonly DataExportFailureReason[] = [
  "clientMissing",
  "assemblyFailed",
  "storageFailed"
]

// The column is nullable text, so a row written by an older build can hold anything. The caller turns
// the result into a translated message, so an unrecognised value has to collapse to null rather than
// reach `t()` as a key.
export function toDataExportFailureReason(value: string | null): DataExportFailureReason | null {
  return FAILURE_REASONS.find((reason) => reason === value) ?? null
}
