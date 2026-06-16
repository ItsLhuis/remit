import { type LeadsSummary } from "./services"
import { type LeadFormValues, type LeadListQuery, type LeadStatus } from "./schemas"

export type LeadListItem = {
  id: string
  firstName: string
  lastName: string
  company: string
  displayName: string
  email: string
  phone: string
  source: string
  status: LeadStatus
  convertedAt: Date | null
  createdAt: Date
  deletedAt: Date | null
}

export type LeadDetail = {
  id: string
  firstName: string
  lastName: string
  company: string
  displayName: string
  email: string
  phone: string
  source: string
  status: LeadStatus
  notes: string
  lostReason: string
  convertedAt: Date | null
  convertedToClientId: string | null
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type LeadFormData = LeadFormValues & {
  id: string
}

export type LeadDefaults = {
  defaultCurrency: string
  defaultLocale: string
}

export type LeadListPageData = {
  leads: LeadListItem[]
  rowCount: number
  summary: LeadsSummary
  query: LeadListQuery
  defaults: LeadDefaults
}
