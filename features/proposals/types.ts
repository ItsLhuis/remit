import { type Blocks } from "@/features/templates"

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
  projectId: string | null
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
// project it belongs to and the client it is for, both resolved in the query so a row is readable
// and navigable without a second lookup. Either may be absent — a proposal hangs off a project or
// off a client (`chk_proposals_parent`), and a hard-deleted project leaves only the client behind.
export type ProposalOverviewItem = {
  id: string
  number: string
  status: ProposalStatus
  currency: string
  totalCents: number
  validUntil: Date | null
  issuedAt: Date | null
  createdAt: Date
  projectId: string | null
  projectName: string | null
  // For a project-level proposal this is the project's client, resolved through the project rather
  // than read from `proposals.client_id`; the two agree by `fk_proposals_project_client`.
  clientId: string | null
  clientName: string | null
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
  projectId: string | null
  projectName: string | null
  clientId: string | null
  clientName: string | null
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

export type PublicProposalIssuer = {
  name: string
  email: string | null
}

// The anonymous read model. Every field here is shown to whoever holds the link, so it carries no
// `publicToken`, no internal ids beyond the ones the response endpoints already take from the URL,
// and no client email — the address is the one secret the OTP flow checks against, and echoing it
// back would let a link-holder learn who to impersonate. See `getPublicProposal` in queries.ts.
export type PublicProposal = {
  number: string
  status: ProposalStatus
  currency: string
  subtotalCents: number
  discountAmountTotalCents: number
  taxAmountCents: number
  totalCents: number
  validUntil: Date | null
  notes: string
  issuedAt: Date
  respondedAt: Date | null
  rejectionReason: string
  // The project name when the proposal has one, the client's name otherwise: a client-level
  // proposal still has to say who it was prepared for.
  preparedForLabel: string
  issuer: PublicProposalIssuer
  locale: string
  timeZone: string
  canRespond: boolean
  lineItems: ProposalDetailLineItem[]
}

// Feature-internal: the OTP flow needs the client's address to decide who may respond, and the
// proposal id to write the response against. Neither may reach a client graph, so this type stays
// out of `index.ts` exactly as `getProposalResponseTarget` stays out of `server.ts`.
export type ProposalResponseTarget = {
  id: string
  projectId: string | null
  number: string
  status: ProposalStatus
  currency: string
  totalCents: number
  recipientEmail: string
  recipientName: string
  issuerName: string
  locale: string
}

export type ProposalFormData = ProposalFormInputValues & {
  id: string
  number: string
  status: ProposalStatus
}

export type ProposalParentOption = {
  id: string
  name: string
}

export type ProposalParentOptions = {
  projects: ProposalParentOption[]
  clients: ProposalParentOption[]
}

// `projectId` and `projectName` are the project the editor was opened from, null on the top-level
// `/proposals/new` route where the parent is picked in the form instead.
export type ProposalEditorData = {
  projectId: string | null
  projectName: string | null
  defaults: ProposalDefaults
  taxRates: ProposalTaxRateOption[]
  templates: ProposalTemplateOption[]
  parentOptions: ProposalParentOptions
}

// `title` is a suggested contract title derived from the proposal number and its project name, not
// a stored proposal field; the conversion form may replace it.
export type AcceptedProposalForContract = {
  id: string
  projectId: string | null
  clientId: string | null
  templateId: string | null
  blocks: Blocks
  title: string
}
