import { type DataExportScope, type DataExportStatus } from "./schemas"
import { type DataExportFailureReason } from "./services/exportStatus"

export type DataExportListItem = {
  id: string
  scope: DataExportScope
  // Null on an instance export, and also on a client export whose client was deleted afterwards — the
  // archive outlives the client row (`data_exports.client_id` is `set null`), so the name is a label
  // the page may not have rather than a guarantee.
  clientName: string | null
  status: DataExportStatus
  progress: number
  sizeBytes: number | null
  entryCount: number | null
  failureReason: DataExportFailureReason | null
  requestedAt: Date
  completedAt: Date | null
}

export type DataExportClientOption = {
  id: string
  name: string
}

export type DataExportPageData = {
  clients: DataExportClientOption[]
  exports: DataExportListItem[]
  // Drives the form's disabled state. The mutation re-derives it from the same statuses, because a
  // page rendered before another tab's request is stale by the time the owner submits.
  hasActiveExport: boolean
  locale: string
  timeZone: string
}

export type DataExportArchive = {
  filename: string
  sizeBytes: number | null
  storageKey: string
}
