import { type ReportExportStatus, type ReportQuery } from "./schemas"
import { type ReportExportFailureReason, type ReportResult } from "./services"

export type ReportDefaults = {
  defaultCurrency: string
  defaultLocale: string
  defaultTimezone: string
}

export type ReportFilterOption = {
  id: string
  label: string
}

export type ReportFilterOptions = {
  clients: ReportFilterOption[]
  projects: ReportFilterOption[]
  taxRates: ReportFilterOption[]
}

export type ReportsPageData = {
  query: ReportQuery
  result: ReportResult
  filterOptions: ReportFilterOptions
  defaults: ReportDefaults
}

export type ReportExportState = {
  id: string
  status: ReportExportStatus
  failureReason: ReportExportFailureReason | null
  // Built here rather than in the client component, so the one route that can serve the artifact is
  // named in one place and a `ready` state always carries the way to fetch it.
  downloadPath: string | null
}

export type ReportExportArtifact = {
  filename: string
  storageKey: string
}
