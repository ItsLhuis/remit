import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  type AnyColumn,
  type SQL
} from "drizzle-orm"

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
  parseProposalListQuery,
  proposalIdSchema,
  proposalListParamsSchema,
  PROPOSAL_DEFAULT_SORT,
  type ProposalDiscountKind,
  type ProposalListQuery,
  type ProposalSortField
} from "./schemas"
import { summarizeProposals, type ProposalsSummaryResult } from "./services"
import {
  type AcceptedProposalForContract,
  type ProposalDefaults,
  type ProposalDetail,
  type ProposalDetailLineItem,
  type ProposalEditorData,
  type ProposalFormData,
  type ProposalListItem,
  type ProposalListPageData,
  type ProposalOverviewFilterOptions,
  type ProposalOverviewItem,
  type ProposalOverviewPageData,
  type ProposalTaxRateOption,
  type ProposalTemplateOption
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
  projectId: string
  number: string
  status: ProposalListItem["status"]
  currency: string
  totalCents: number
  validUntil: Date | null
  issuedAt: Date | null
  createdAt: Date
}

const proposalOverviewColumns = {
  id: proposals.id,
  number: proposals.number,
  status: proposals.status,
  currency: proposals.currency,
  totalCents: proposals.totalCents,
  validUntil: proposals.validUntil,
  issuedAt: proposals.issuedAt,
  createdAt: proposals.createdAt,
  projectId: proposals.projectId,
  projectName: projects.name,
  clientId: projects.clientId,
  clientName: clients.name
}

type ProposalOverviewRow = ProposalListRow & {
  projectName: string
  clientId: string
  clientName: string
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

export async function getProposalOverviewPageData(
  input: unknown
): Promise<ProposalOverviewPageData> {
  const query = parseProposalListQuery(input)
  const defaults = await getProposalDefaults()
  const [list, summary, filterOptions] = await Promise.all([
    listProposalOverview(query, defaults.defaultCurrency),
    getProposalOverviewSummary(defaults.defaultCurrency),
    getProposalOverviewFilterOptions()
  ])

  return {
    proposals: list.rows,
    rowCount: list.rowCount,
    summary,
    filterOptions,
    defaults
  }
}

export async function listProposalOverview(
  query: ProposalListQuery,
  defaultCurrency = "EUR"
): Promise<{ rows: ProposalOverviewItem[]; rowCount: number }> {
  const whereClause = getProposalOverviewWhereClause(query)

  const sortColumns: Record<ProposalSortField, AnyColumn | SQL> = {
    number: proposals.number,
    project: projects.name,
    client: clients.name,
    validUntil: proposals.validUntil,
    total: proposals.totalCents,
    created: proposals.createdAt
  }

  const sort = query.sort.length > 0 ? query.sort : [...PROPOSAL_DEFAULT_SORT]
  const orderBy = [
    ...sort.map((item) => (item.desc ? desc(sortColumns[item.id]) : asc(sortColumns[item.id]))),
    desc(proposals.createdAt)
  ]

  const [rows, totalRows] = await Promise.all([
    database
      .select(proposalOverviewColumns)
      .from(proposals)
      .innerJoin(projects, eq(projects.id, proposals.projectId))
      .innerJoin(clients, eq(clients.id, projects.clientId))
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage),
    database
      .select({ value: count() })
      .from(proposals)
      .innerJoin(projects, eq(projects.id, proposals.projectId))
      .innerJoin(clients, eq(clients.id, projects.clientId))
      .where(whereClause)
  ])

  return {
    rows: rows.map((row) => toProposalOverviewItem(row, defaultCurrency)),
    rowCount: totalRows[0]?.value ?? 0
  }
}

export async function getProposalDetail(input: unknown): Promise<ProposalDetail | null> {
  const parsed = proposalIdSchema.safeParse(input)

  if (!parsed.success) return null

  const proposal = await database.query.proposals.findFirst({
    where: and(eq(proposals.id, parsed.data.id), isNull(proposals.deletedAt))
  })

  if (!proposal) return null

  const [project, template, rows, defaults] = await Promise.all([
    database.query.projects.findFirst({
      where: eq(projects.id, proposal.projectId),
      columns: { name: true }
    }),
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
    projectName: project?.name ?? "",
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
    // The token exists from creation, but exposing it before the proposal is issued would hand out a
    // live client URL for a document the client is not meant to have seen yet.
    publicPath: proposal.issuedAt ? `/p/${proposal.publicToken}` : null,
    lineItems: rows.map(toProposalDetailLineItem),
    defaults
  }
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
    columns: { id: true, projectId: true, templateId: true, number: true }
  })

  if (!proposal) return null

  const [project, template, existingContract] = await Promise.all([
    database.query.projects.findFirst({
      where: eq(projects.id, proposal.projectId),
      columns: { name: true }
    }),
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

  return {
    id: proposal.id,
    projectId: proposal.projectId,
    templateId: proposal.templateId,
    blocks: blocks.success ? blocks.data : [],
    title: project ? `${proposal.number} - ${project.name}` : proposal.number
  }
}

export async function getProposalEditorData(input: unknown): Promise<ProposalEditorData | null> {
  const parsed = proposalListParamsSchema.safeParse(input)

  if (!parsed.success) return null

  const project = await database.query.projects.findFirst({
    where: and(eq(projects.id, parsed.data.projectId), isNull(projects.deletedAt)),
    columns: { id: true, name: true }
  })

  if (!project) return null

  const [defaults, taxRateOptions, templateOptions] = await Promise.all([
    getProposalDefaults(),
    listProposalTaxRates(),
    listProposalTemplates()
  ])

  return {
    projectId: project.id,
    projectName: project.name,
    defaults,
    taxRates: taxRateOptions,
    templates: templateOptions
  }
}

async function getProposalOverviewSummary(
  defaultCurrency: string
): Promise<ProposalsSummaryResult> {
  const rows = await database
    .select({
      status: proposals.status,
      currency: proposals.currency,
      totalCents: proposals.totalCents
    })
    .from(proposals)
    .innerJoin(projects, eq(projects.id, proposals.projectId))
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(getProposalOverviewBaseCondition())

  return summarizeProposals(
    rows.map((row) => ({
      status: row.status,
      currency: row.currency ?? defaultCurrency,
      totalCents: Number(row.totalCents)
    }))
  )
}

async function getProposalOverviewFilterOptions(): Promise<ProposalOverviewFilterOptions> {
  const rows = await database
    .select({ id: clients.id, name: clients.name })
    .from(proposals)
    .innerJoin(projects, eq(projects.id, proposals.projectId))
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(getProposalOverviewBaseCondition())
    .groupBy(clients.id, clients.name)
    .orderBy(asc(clients.name))

  return { clients: rows }
}

// A proposal is only reachable through its project (`/projects/[projectId]/proposals/[proposalId]`),
// and both that route and the project and client detail routes resolve live records only. Listing a
// proposal whose project or client has been soft-deleted would therefore render a row whose every
// link and row-click lands on a 404, so the whole parent chain has to be live. The summary counters
// and the client filter options run against this same condition, so the band always describes the
// population the table is paging through.
function getProposalOverviewBaseCondition(): SQL | undefined {
  return and(isNull(proposals.deletedAt), isNull(projects.deletedAt), isNull(clients.deletedAt))
}

function getProposalOverviewWhereClause(query: ProposalListQuery): SQL | undefined {
  const baseCondition = getProposalOverviewBaseCondition()
  const conditions: SQL[] = baseCondition ? [baseCondition] : []

  if (query.search) {
    const searchPattern = `%${query.search}%`
    const searchCondition = or(
      ilike(proposals.number, searchPattern),
      ilike(projects.name, searchPattern),
      ilike(clients.name, searchPattern)
    )

    if (searchCondition) conditions.push(searchCondition)
  }

  if (query.statuses.length > 0) conditions.push(inArray(proposals.status, query.statuses))
  if (query.clientIds.length > 0) conditions.push(inArray(projects.clientId, query.clientIds))

  if (query.totalMin !== null) conditions.push(gte(proposals.totalCents, query.totalMin))
  if (query.totalMax !== null) conditions.push(lte(proposals.totalCents, query.totalMax))

  if (query.validUntilFrom) conditions.push(gte(proposals.validUntil, query.validUntilFrom))
  if (query.validUntilTo) conditions.push(lte(proposals.validUntil, query.validUntilTo))

  return and(...conditions)
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

function toProposalOverviewItem(
  row: ProposalOverviewRow,
  defaultCurrency: string
): ProposalOverviewItem {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    currency: row.currency ?? defaultCurrency,
    totalCents: Number(row.totalCents),
    validUntil: row.validUntil,
    issuedAt: row.issuedAt,
    createdAt: row.createdAt,
    projectId: row.projectId,
    projectName: row.projectName,
    clientId: row.clientId,
    clientName: row.clientName
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
