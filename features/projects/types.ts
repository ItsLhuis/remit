import { type ProjectsSummary } from "./services"
import { type ProjectFormInputValues, type ProjectListQuery, type ProjectStatus } from "./schemas"

export type ProjectClientOption = {
  id: string
  name: string
  currency: string
}

export type ProjectListItem = {
  id: string
  name: string
  clientId: string
  clientName: string
  status: ProjectStatus
  currency: string
  budgetCents: number | null
  hourlyRateCents: number | null
  startDate: Date | null
  endDate: Date | null
  createdAt: Date
  deletedAt: Date | null
}

export type ProjectDetail = {
  id: string
  name: string
  clientId: string
  clientName: string
  status: ProjectStatus
  currency: string
  budgetCents: number | null
  hourlyRateCents: number | null
  startDate: Date | null
  endDate: Date | null
  description: string
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type ProjectFormData = ProjectFormInputValues & {
  id: string
}

export type ProjectDefaults = {
  defaultCurrency: string
  defaultLocale: string
}

export type ProjectListPageData = {
  projects: ProjectListItem[]
  rowCount: number
  summary: ProjectsSummary
  query: ProjectListQuery
  defaults: ProjectDefaults
}
