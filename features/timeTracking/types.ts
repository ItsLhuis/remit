import {
  type TimeEntryFormInputValues,
  type TimeEntryListQuery,
  type TimeEntrySource
} from "./schemas"

export type TimeEntryListItem = {
  id: string
  projectId: string
  projectName: string
  clientName: string
  taskId: string | null
  taskTitle: string | null
  description: string
  startedAt: Date
  endedAt: Date | null
  durationSeconds: number | null
  billable: boolean
  hourlyRateOverrideCents: number | null
  hourlyRateSnapshotCents: number
  amountCents: number
  currency: string
  source: TimeEntrySource
  invoicedInId: string | null
  deletedAt: Date | null
}

export type RunningTimer = {
  id: string
  projectId: string
  projectName: string
  taskId: string | null
  taskTitle: string | null
  description: string
  startedAt: Date
  billable: boolean
  hourlyRateSnapshotCents: number
  currency: string
}

export type TimeTrackingSummary = {
  totalSeconds: number
  billableSeconds: number
  unbilledSeconds: number
  unbilledAmountCents: number
  unbilledCurrency: string
}

export type TimeTrackingProjectOption = {
  id: string
  name: string
  clientName: string
  currency: string
}

export type TimeTrackingTaskOption = {
  id: string
  projectId: string
  title: string
}

export type TimeTrackingDefaults = {
  defaultCurrency: string
  defaultLocale: string
  defaultTimezone: string
}

export type TimeTrackingPageData = {
  entries: TimeEntryListItem[]
  rowCount: number
  runningTimer: RunningTimer | null
  summary: TimeTrackingSummary
  query: TimeEntryListQuery
  projectOptions: TimeTrackingProjectOption[]
  taskOptions: TimeTrackingTaskOption[]
  defaults: TimeTrackingDefaults
}

// `startedAt` and `endedAt` travel as ISO instants rather than as the `datetime-local` strings the
// controls hold, because only the browser knows the zone the user meant. `TimeEntryForm` converts
// them on mount and on submit (see `lib/utils/datetime.ts`).
export type TimeEntryFormData = Omit<TimeEntryFormInputValues, "startedAt" | "endedAt"> & {
  id: string
  startedAt: string
  endedAt: string
}
