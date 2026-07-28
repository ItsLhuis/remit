import { type ProposalFormInputValues, type ProposalStatus } from "./schemas"
import { type ProposalsSummaryResult } from "./services"

export type ProposalDefaults = {
  defaultCurrency: string
  defaultLocale: string
  defaultTimezone: string
  proposalValidityDays: number
  defaultNotesProposal: string
}

export type ProposalTaxRateOption = {
  id: string
  name: string
  percentage: number
  isDefault: boolean
}

export type ProposalTemplateOption = {
  id: string
  name: string
}

export type ProposalListItem = {
  id: string
  projectId: string
  number: string
  status: ProposalStatus
  currency: string
  totalCents: number
  validUntil: Date | null
  issuedAt: Date | null
  createdAt: Date
}

export type ProposalListPageData = {
  projectId: string
  projectName: string
  currency: string
  proposals: ProposalListItem[]
  summary: ProposalsSummaryResult
  defaults: ProposalDefaults
}

// The instance-wide row carries the parent chain a project-scoped row can leave implicit: the
// project it belongs to and the client that project is worked for, both resolved in the query so a
// row is readable and navigable without a second lookup.
export type ProposalOverviewItem = {
  id: string
  number: string
  status: ProposalStatus
  currency: string
  totalCents: number
  validUntil: Date | null
  issuedAt: Date | null
  createdAt: Date
  projectId: string
  projectName: string
  clientId: string
  clientName: string
}

export type ProposalOverviewClientOption = {
  id: string
  name: string
}

export type ProposalOverviewFilterOptions = {
  clients: ProposalOverviewClientOption[]
}

export type ProposalOverviewPageData = {
  proposals: ProposalOverviewItem[]
  rowCount: number
  summary: ProposalsSummaryResult
  filterOptions: ProposalOverviewFilterOptions
  defaults: ProposalDefaults
}

export type ProposalDetailLineItem = {
  id: string
  position: number
  description: string
  unit: string
  quantity: number
  unitPriceCents: number
  discountPercentage: number | null
  discountAmountCents: number | null
  taxPercentage: number
  subtotalCents: number
  taxAmountCents: number
  totalCents: number
}

export type ProposalDetail = {
  id: string
  projectId: string
  projectName: string
  number: string
  status: ProposalStatus
  currency: string
  subtotalCents: number
  discountAmountTotalCents: number
  taxAmountCents: number
  totalCents: number
  discountPercentage: number | null
  discountAmountCents: number | null
  validUntil: Date | null
  notes: string
  issuedAt: Date | null
  viewCount: number
  templateName: string | null
  // Null until the proposal is sent. The token exists from creation (the column is NOT NULL), but no
  // read model may carry it before `issuedAt` is set — see `getProposalDetail` in queries.ts.
  publicPath: string | null
  lineItems: ProposalDetailLineItem[]
  defaults: ProposalDefaults
}

export type ProposalFormData = ProposalFormInputValues & {
  id: string
  number: string
  status: ProposalStatus
}

export type ProposalEditorData = {
  projectId: string
  projectName: string
  defaults: ProposalDefaults
  taxRates: ProposalTaxRateOption[]
  templates: ProposalTemplateOption[]
}
