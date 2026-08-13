import { type DataExportScope, type DataExportStatus } from "./schemas"
import { type DataExportFailureReason } from "./services/exportStatus"

type StatusPresentation = {
  labelKey: string
  variant: "default" | "info" | "secondary" | "destructive"
  icon: "Clock" | "Loader" | "CircleCheck" | "CircleAlert"
}

// `as const satisfies` rather than an annotation, as in `features/reports/labels.ts`: the label keys
// have to stay literal types for the typed `t()` to accept them, which an annotation would widen away.
export const dataExportStatusPresentation = {
  pending: { labelKey: "settings.data.status.pending", variant: "secondary", icon: "Clock" },
  running: { labelKey: "settings.data.status.running", variant: "info", icon: "Loader" },
  ready: { labelKey: "settings.data.status.ready", variant: "default", icon: "CircleCheck" },
  failed: { labelKey: "settings.data.status.failed", variant: "destructive", icon: "CircleAlert" }
} as const satisfies Record<DataExportStatus, StatusPresentation>

export const dataExportScopeLabelKeys = {
  instance: "settings.data.scope.instance",
  client: "settings.data.scope.client"
} as const satisfies Record<DataExportScope, string>

export const dataExportFailureReasonLabelKeys = {
  clientMissing: "settings.data.failureReasons.clientMissing",
  assemblyFailed: "settings.data.failureReasons.assemblyFailed",
  storageFailed: "settings.data.failureReasons.storageFailed"
} as const satisfies Record<DataExportFailureReason, string>
