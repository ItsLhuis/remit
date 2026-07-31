import { type Blocks } from "@/features/templates"

import { type ContractListQuery, type ContractStatus } from "./schemas"
import { type ContractsSummary } from "./services"

export type ContractDisplayStatus = ContractStatus

export type ContractFormData = {
  id: string
  number: string
  title: string
  status: ContractStatus
  projectId: string | null
  clientId: string | null
  templateId: string | null
  proposalId: string | null
  blocks: Blocks
  effectiveFrom: Date | null
  effectiveUntil: Date | null
}

export type ContractListItem = {
  id: string
  number: string
  title: string
  status: ContractStatus
  displayStatus: ContractDisplayStatus
  parentLabel: string
  projectId: string | null
  // The client the row links to, which for a project-level contract is the project's client rather
  // than `contracts.client_id` (null there). ContractFormData.clientId is the stored column.
  clientId: string | null
  issuedAt: Date | null
  effectiveFrom: Date | null
  effectiveUntil: Date | null
  createdAt: Date
}

export type ContractFilterOption = {
  id: string
  name: string
}

export type ContractFilterOptions = {
  clients: ContractFilterOption[]
}

export type ContractDefaults = {
  defaultLocale: string
  defaultTimezone: string
}

export type ContractsPageData = {
  contracts: ContractListItem[]
  rowCount: number
  summary: ContractsSummary
  query: ContractListQuery
  filterOptions: ContractFilterOptions
  defaults: ContractDefaults
}

export type ContractParentOption = {
  id: string
  name: string
}

// Templates carry their blocks because the form has no canvas of its own: picking a template is how
// a draft gets its content, so the snapshot has to be available client-side to seed the field.
export type ContractTemplateOption = ContractParentOption & {
  blocks: Blocks
}

export type ContractParentOptions = {
  projects: ContractParentOption[]
  clients: ContractParentOption[]
  templates: ContractTemplateOption[]
}

export type ContractDetail = ContractFormData & {
  displayStatus: ContractDisplayStatus
  issuedAt: Date | null
  terminatedAt: Date | null
  terminationReason: string | null
  projectName: string | null
  clientName: string | null
  hasSignature: boolean
}
