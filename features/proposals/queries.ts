import { and, asc, desc, eq, isNull } from "drizzle-orm"

import { formatCentsForInput } from "@/lib/utils"

import { database } from "@/database"
import {
  clients,
  contracts,
  lineItems,
  projects,
  proposals,
  taxRates,
  templates
} from "@/database/schema"

import { blocksSchema } from "@/features/templates"

import {
  proposalEditorParamsSchema,
  proposalIdSchema,
  proposalListParamsSchema,
  type ProposalDiscountKind
} from "./schemas"
import { summarizeProposals } from "./services"
import {
  type AcceptedProposalForContract,
  type ProposalDefaults,
  type ProposalDetail,
  type ProposalDetailLineItem,
  type ProposalEditorData,
  type ProposalFormData,
  type ProposalListItem,
  type ProposalListPageData,
  type ProposalParentOptions,
  type ProposalTaxRateOption,
  type ProposalTemplateOption,
  type PublicLinkState
} from "./types"

const proposalListColumns = {
  id: proposals.id,
  projectId: proposals.projectId,
  number: proposals.number,
  status: proposals.status,
  currency: proposals.currency,
  totalCents: proposals.totalCents,
  validUntil: proposals.validUntil,
  issuedAt: proposals.issuedAt,
  createdAt: proposals.createdAt
}

type ProposalListRow = {
  id: string
  projectId: string | null
  number: string
  status: ProposalListItem["status"]
  currency: string
  totalCents: number
  validUntil: Date | null
  issuedAt: Date | null
  createdAt: Date
}

type LineItemRow = typeof lineItems.$inferSelect

export async function getProposalDefaults(): Promise<ProposalDefaults> {
  const row = await database.query.settings.findFirst({
    columns: {
      defaultCurrency: true,
      defaultLocale: true,
      defaultTimezone: true,
      proposalValidityDays: true,
      defaultNotesProposal: true
    }
  })

  return {
    defaultCurrency: row?.defaultCurrency ?? "EUR",
    defaultLocale: row?.defaultLocale ?? "en",
    defaultTimezone: row?.defaultTimezone ?? "UTC",
    proposalValidityDays: row?.proposalValidityDays ?? 30,
    defaultNotesProposal: row?.defaultNotesProposal ?? ""
  }
}

export async function listProposalsByProject(
  projectId: string,
  defaultCurrency = "EUR"
): Promise<ProposalListItem[]> {
  const rows = await database
    .select(proposalListColumns)
    .from(proposals)
    .where(and(eq(proposals.projectId, projectId), isNull(proposals.deletedAt)))
    .orderBy(desc(proposals.createdAt))

  return rows.map((row) => toProposalListItem(row, defaultCurrency))
}

export async function getProposalsPageData(input: unknown): Promise<ProposalListPageData | null> {
  const parsed = proposalListParamsSchema.safeParse(input)

  if (!parsed.success) return null

  const project = await database.query.projects.findFirst({
    where: and(eq(projects.id, parsed.data.projectId), isNull(projects.deletedAt)),
    columns: { id: true, name: true, currency: true }
  })

  if (!project) return null

  const defaults = await getProposalDefaults()
  const currency = project.currency ?? defaults.defaultCurrency
  const proposalList = await listProposalsByProject(project.id, currency)

  return {
    projectId: project.id,
    projectName: project.name,
    currency,
    proposals: proposalList,
    summary: summarizeProposals(proposalList),
    defaults
  }
}

export async function getProposalDetail(input: unknown): Promise<ProposalDetail | null> {
  const parsed = proposalIdSchema.safeParse(input)

  if (!parsed.success) return null

  const proposal = await database.query.proposals.findFirst({
    where: and(eq(proposals.id, parsed.data.id), isNull(proposals.deletedAt))
  })

  if (!proposal) return null

  const [parent, template, rows, defaults] = await Promise.all([
    findProposalParent(proposal.projectId, proposal.clientId),
    proposal.templateId
      ? database.query.templates.findFirst({
          where: eq(templates.id, proposal.templateId),
          columns: { name: true }
        })
      : Promise.resolve(undefined),
    listProposalLineItems(proposal.id),
    getProposalDefaults()
  ])

  return {
    id: proposal.id,
    projectId: proposal.projectId,
    projectName: parent.projectName,
    clientId: proposal.clientId ?? parent.clientId,
    clientName: parent.clientName,
    number: proposal.number,
    status: proposal.status,
    currency: proposal.currency,
    subtotalCents: Number(proposal.subtotalCents),
    discountAmountTotalCents: Number(proposal.discountAmountTotalCents),
    taxAmountCents: Number(proposal.taxAmountCents),
    totalCents: Number(proposal.totalCents),
    discountPercentage:
      proposal.discountPercentage === null ? null : Number(proposal.discountPercentage),
    discountAmountCents:
      proposal.discountAmountCents === null ? null : Number(proposal.discountAmountCents),
    validUntil: proposal.validUntil,
    notes: proposal.notes ?? "",
    issuedAt: proposal.issuedAt,
    viewCount: proposal.viewCount,
    templateName: template?.name ?? null,
    // A proposal that was never issued keeps its token unexposed: surfacing it would hand out a live
    // client URL for a document the client is not meant to have seen yet (SCHEMA.md's
    // `proposals.public_token` note). An issued proposal whose link was revoked has no token at all.
    publicPath: toProposalPublicPath(proposal),
    publicLinkState: toProposalPublicLinkState(proposal),
    lineItems: rows.map(toProposalDetailLineItem),
    defaults
  }
}

// The two link fields are derived together so the path and the state can never disagree: a `live`
// state without a path, or a path on a revoked proposal, would each be a bug the card would render.
function toProposalPublicPath(proposal: { issuedAt: Date | null; publicToken: string | null }) {
  if (!proposal.issuedAt || !proposal.publicToken) return null

  return `/p/${proposal.publicToken}`
}

function toProposalPublicLinkState(proposal: {
  issuedAt: Date | null
  publicToken: string | null
}): PublicLinkState {
  if (!proposal.issuedAt) return "unissued"

  return proposal.publicToken ? "live" : "revoked"
}

export async function getProposalForEdit(input: unknown): Promise<ProposalFormData | null> {
  const parsed = proposalIdSchema.safeParse(input)

  if (!parsed.success) return null

  const proposal = await database.query.proposals.findFirst({
    where: and(eq(proposals.id, parsed.data.id), isNull(proposals.deletedAt))
  })

  if (!proposal) return null

  const rows = await listProposalLineItems(proposal.id)

  return {
    id: proposal.id,
    number: proposal.number,
    status: proposal.status,
    projectId: proposal.projectId ?? "",
    clientId: proposal.clientId ?? "",
    currency: proposal.currency,
    templateId: proposal.templateId ?? "",
    validUntil: toDateInput(proposal.validUntil),
    notes: proposal.notes ?? "",
    discountKind: toDiscountKind(proposal.discountType),
    discountPercentage:
      proposal.discountPercentage === null ? "" : String(Number(proposal.discountPercentage)),
    discountAmount: formatCentsForInput(proposal.discountAmountCents),
    lineItems: rows.map((row) => ({
      description: row.description,
      unit: row.unit ?? "",
      quantity: String(Number(row.quantity)),
      unitPrice: formatCentsForInput(Number(row.unitPriceCents)),
      discountKind: toDiscountKind(row.discountType),
      discountPercentage:
        row.discountPercentage === null ? "" : String(Number(row.discountPercentage)),
      discountAmount: formatCentsForInput(row.discountAmountCents),
      taxRateId: row.taxRateId ?? ""
    }))
  }
}

// The read model the contract-conversion path needs, kept here because it reads proposal tables.
// Proposals carry no `blocks` column of their own, so the snapshot offered to the new contract is
// the proposal's template blocks resolved by join; a proposal with no template yields an empty
// snapshot and the conversion falls back to the contract template (features/contracts/services
// /contractBlocks.ts). Returns null for anything not convertible, so the caller never has to
// re-derive convertibility.
export async function getAcceptedProposalForContract(
  input: unknown
): Promise<AcceptedProposalForContract | null> {
  const parsed = proposalIdSchema.safeParse(input)

  if (!parsed.success) return null

  const proposal = await database.query.proposals.findFirst({
    where: and(
      eq(proposals.id, parsed.data.id),
      eq(proposals.status, "accepted"),
      isNull(proposals.deletedAt)
    ),
    columns: { id: true, projectId: true, clientId: true, templateId: true, number: true }
  })

  if (!proposal) return null

  const [parent, template, existingContract] = await Promise.all([
    findProposalParent(proposal.projectId, proposal.clientId),
    proposal.templateId
      ? database.query.templates.findFirst({
          where: eq(templates.id, proposal.templateId),
          columns: { blocks: true }
        })
      : Promise.resolve(undefined),
    database
      .select({ id: contracts.id })
      .from(contracts)
      .where(and(eq(contracts.proposalId, proposal.id), isNull(contracts.deletedAt)))
      .limit(1)
  ])

  if (existingContract.length > 0) return null

  const blocks = blocksSchema.safeParse(template?.blocks ?? [])

  const parentName = parent.projectName ?? parent.clientName

  return {
    id: proposal.id,
    projectId: proposal.projectId,
    clientId: proposal.clientId ?? parent.clientId,
    templateId: proposal.templateId,
    blocks: blocks.success ? blocks.data : [],
    title: parentName ? `${proposal.number} - ${parentName}` : proposal.number
  }
}

export async function getProposalEditorData(input: unknown): Promise<ProposalEditorData | null> {
  const parsed = proposalEditorParamsSchema.safeParse(input)

  if (!parsed.success) return null

  const project = parsed.data.projectId
    ? await database.query.projects.findFirst({
        where: and(eq(projects.id, parsed.data.projectId), isNull(projects.deletedAt)),
        columns: { id: true, name: true }
      })
    : null

  if (parsed.data.projectId && !project) return null

  const [defaults, taxRateOptions, templateOptions, parentOptions] = await Promise.all([
    getProposalDefaults(),
    listProposalTaxRates(),
    listProposalTemplates(),
    getProposalParentOptions()
  ])

  return {
    projectId: project?.id ?? null,
    projectName: project?.name ?? null,
    defaults,
    taxRates: taxRateOptions,
    templates: templateOptions,
    parentOptions
  }
}

// The label pair a read model shows for whichever parent the proposal has. A project-level
// proposal reaches its client through the project rather than through `proposals.client_id`; the
// two agree by `fk_proposals_project_client`, so either source answers the same question.
async function findProposalParent(
  projectId: string | null,
  clientId: string | null
): Promise<{ projectName: string | null; clientId: string | null; clientName: string | null }> {
  if (projectId) {
    const rows = await database
      .select({ projectName: projects.name, clientId: clients.id, clientName: clients.name })
      .from(projects)
      .leftJoin(clients, eq(clients.id, projects.clientId))
      .where(eq(projects.id, projectId))
      .limit(1)

    const row = rows[0]

    if (row) return row
  }

  if (!clientId) return { projectName: null, clientId: null, clientName: null }

  const client = await database.query.clients.findFirst({
    where: eq(clients.id, clientId),
    columns: { id: true, name: true }
  })

  return { projectName: null, clientId: client?.id ?? null, clientName: client?.name ?? null }
}

async function getProposalParentOptions(): Promise<ProposalParentOptions> {
  const [projectRows, clientRows] = await Promise.all([
    database
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(isNull(projects.deletedAt))
      .orderBy(asc(projects.name)),
    database
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(isNull(clients.deletedAt))
      .orderBy(asc(clients.name))
  ])

  return { projects: projectRows, clients: clientRows }
}

async function listProposalTaxRates(): Promise<ProposalTaxRateOption[]> {
  const rows = await database
    .select({
      id: taxRates.id,
      name: taxRates.name,
      percentage: taxRates.percentage,
      isDefault: taxRates.isDefault
    })
    .from(taxRates)
    .where(isNull(taxRates.deletedAt))
    .orderBy(desc(taxRates.isDefault), asc(taxRates.name))

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    percentage: Number(row.percentage),
    isDefault: row.isDefault
  }))
}

async function listProposalTemplates(): Promise<ProposalTemplateOption[]> {
  const rows = await database
    .select({ id: templates.id, name: templates.name })
    .from(templates)
    .where(and(eq(templates.type, "proposal"), isNull(templates.deletedAt)))
    .orderBy(desc(templates.isDefault), asc(templates.name))

  return rows
}

export async function listProposalLineItems(proposalId: string): Promise<LineItemRow[]> {
  return database
    .select()
    .from(lineItems)
    .where(and(eq(lineItems.proposalId, proposalId), isNull(lineItems.deletedAt)))
    .orderBy(asc(lineItems.position))
}

function toProposalListItem(row: ProposalListRow, defaultCurrency: string): ProposalListItem {
  return {
    id: row.id,
    projectId: row.projectId,
    number: row.number,
    status: row.status,
    currency: row.currency ?? defaultCurrency,
    totalCents: Number(row.totalCents),
    validUntil: row.validUntil,
    issuedAt: row.issuedAt,
    createdAt: row.createdAt
  }
}

export function toProposalDetailLineItem(row: LineItemRow): ProposalDetailLineItem {
  return {
    id: row.id,
    position: row.position,
    description: row.description,
    unit: row.unit ?? "",
    quantity: Number(row.quantity),
    unitPriceCents: Number(row.unitPriceCents),
    discountPercentage: row.discountPercentage === null ? null : Number(row.discountPercentage),
    discountAmountCents: row.discountAmountCents === null ? null : Number(row.discountAmountCents),
    taxPercentage: Number(row.taxPercentageSnapshot),
    subtotalCents: Number(row.subtotalCents),
    taxAmountCents: Number(row.taxAmountCents),
    totalCents: Number(row.totalCents)
  }
}

function toDiscountKind(value: "percentage" | "fixed" | null): ProposalDiscountKind {
  return value ?? "none"
}

function toDateInput(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : ""
}
