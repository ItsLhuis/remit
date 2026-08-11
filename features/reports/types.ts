import { type ReportQuery } from "./schemas"
import { type ReportResult } from "./services"

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
