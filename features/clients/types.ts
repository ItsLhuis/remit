import { type ProjectListItem } from "@/features/projects"

import { type ClientBillingPoint, type ClientsSummary, type ClientHealth } from "./services"
import { type ClientFormValues, type ClientListQuery } from "./schemas"

export type ClientListItem = {
  id: string
  name: string
  email: string
  currency: string
  outstandingBalanceCents: number
  invoiceCount: number
  health: ClientHealth
  createdAt: Date
  deletedAt: Date | null
}

export type ClientFilterOptions = {
  currencies: string[]
}

export type ClientAddress = {
  line1: string
  line2: string
  city: string
  state: string
  postalCode: string
  country: string
}

export type ClientRelatedResourceCounts = {
  projects: number
  invoices: number
  recurringInvoices: number
}

export type ClientDetail = {
  id: string
  name: string
  email: string
  phone: string
  website: string
  taxId: string
  currency: string
  address: ClientAddress
  notes: string
  outstandingBalanceCents: number
  health: ClientHealth
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
  relatedResources: ClientRelatedResourceCounts
  billingTrend: ClientBillingPoint[]
  projects: ProjectListItem[]
}

export type ClientFormData = ClientFormValues & {
  id: string
}

export type ClientDefaults = {
  defaultCurrency: string
  defaultLocale: string
}

export type ClientListPageData = {
  clients: ClientListItem[]
  rowCount: number
  summary: ClientsSummary
  query: ClientListQuery
  filterOptions: ClientFilterOptions
  defaults: ClientDefaults
}
