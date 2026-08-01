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

export type PublicContractIssuer = {
  name: string
  email: string | null
}

// The rendered document, pre-sized: the public page draws it in a sandboxed iframe, and the page
// box is computed from the same blocks the HTML came from, so the frame is exactly the document.
export type PublicContractDocument = {
  html: string
  width: number
  height: number
}

// What an anonymous holder of `/c/[token]` is allowed to see. It carries no contract id, no token,
// and no client email: the id is the signing route's business and the other two are credentials.
export type PublicContract = {
  number: string
  title: string
  status: ContractStatus
  issuedAt: Date
  effectiveFrom: Date | null
  effectiveUntil: Date | null
  clientName: string
  document: PublicContractDocument | null
  consentText: string
  issuer: PublicContractIssuer
  locale: string
  timeZone: string
}

// The server-side counterpart of PublicContract, carrying the ids the read model must not leak.
// Only publicSigning.ts reads it, so it is exported from neither index.ts nor server.ts.
export type ContractSigningTarget = {
  id: string
  projectId: string | null
  clientId: string | null
  number: string
  status: ContractStatus
  consentText: string
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
