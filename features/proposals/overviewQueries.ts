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
  sql,
  type AnyColumn,
  type SQL
} from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import { database } from "@/database"
import { clients, projects, proposals } from "@/database/schema"

import { getProposalDefaults } from "./queries"
import {
  parseProposalListQuery,
  PROPOSAL_DEFAULT_SORT,
  type ProposalListQuery,
  type ProposalSortField,
  type ProposalStatus
} from "./schemas"
import { summarizeProposals, type ProposalsSummaryResult } from "./services"
import {
  type ProposalOverviewFilterOptions,
  type ProposalOverviewItem,
  type ProposalOverviewPageData
} from "./types"

// The instance-wide proposal list, split out of queries.ts along the seam the read models already
// draw: everything here answers "every proposal in this instance", joins both parents for labels
// and filtering, and is consumed only by `/proposals`. The project-scoped reads, the detail read,
// and the editor read stay in queries.ts, which is at the file-length ceiling.

type ProposalOverviewRow = {
  id: string
  projectId: string | null
  number: string
  status: ProposalStatus
  currency: string
  totalCents: number
  validUntil: Date | null
  issuedAt: Date | null
  createdAt: Date
  projectName: string | null
  clientId: string | null
  clientName: string | null
  projectClientId: string | null
  projectClientName: string | null
}

// The client a project-level proposal belongs to, reached through its project. Aliased because the
// same `clients` table is also joined directly for a client-level proposal, and a row has one shape
// or the other, never both.
const projectClients = alias(clients, "project_clients")

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
  clientId: proposals.clientId,
  clientName: clients.name,
  projectClientId: projects.clientId,
  projectClientName: projectClients.name
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
    // Coalesced, unlike the project column: the client of a project-level proposal is reached
    // through the project, so sorting on the direct join alone would sort every such row as null.
    client: sql`coalesce(${clients.name}, ${projectClients.name})`,
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
      .leftJoin(projects, eq(projects.id, proposals.projectId))
      .leftJoin(clients, eq(clients.id, proposals.clientId))
      .leftJoin(projectClients, eq(projectClients.id, projects.clientId))
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage),
    database
      .select({ value: count() })
      .from(proposals)
      .leftJoin(projects, eq(projects.id, proposals.projectId))
      .leftJoin(clients, eq(clients.id, proposals.clientId))
      .leftJoin(projectClients, eq(projectClients.id, projects.clientId))
      .where(whereClause)
  ])

  return {
    rows: rows.map((row) => toProposalOverviewItem(row, defaultCurrency)),
    rowCount: totalRows[0]?.value ?? 0
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
  const [directRows, projectRows] = await Promise.all([
    database
      .selectDistinct({ id: clients.id, name: clients.name })
      .from(proposals)
      .innerJoin(clients, eq(clients.id, proposals.clientId))
      .where(getProposalOverviewBaseCondition()),
    database
      .selectDistinct({ id: projectClients.id, name: projectClients.name })
      .from(proposals)
      .innerJoin(projects, eq(projects.id, proposals.projectId))
      .innerJoin(projectClients, eq(projectClients.id, projects.clientId))
      .where(getProposalOverviewBaseCondition())
  ])

  const byId = new Map([...directRows, ...projectRows].map((row) => [row.id, row]))

  return { clients: Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name)) }
}

// A proposal outlives its parents: both parent columns are nullable, both are nulled rather than
// cascaded when a parent goes away, and `/proposals/[proposalId]` resolves a proposal on its own id.
// So the parent chain is left-joined for labels and filtering only and never narrows the population
// — before stage 29 it did, because a proposal was reachable only through its project. The summary
// counters and the client filter options run against this same condition, so the band always
// describes the population the table is paging through.
function getProposalOverviewBaseCondition(): SQL | undefined {
  return isNull(proposals.deletedAt)
}

function getProposalOverviewWhereClause(query: ProposalListQuery): SQL | undefined {
  const baseCondition = getProposalOverviewBaseCondition()
  const conditions: SQL[] = baseCondition ? [baseCondition] : []

  if (query.search) {
    const searchPattern = `%${query.search}%`
    const searchCondition = or(
      ilike(proposals.number, searchPattern),
      ilike(projects.name, searchPattern),
      ilike(clients.name, searchPattern),
      ilike(projectClients.name, searchPattern)
    )

    if (searchCondition) conditions.push(searchCondition)
  }

  if (query.statuses.length > 0) conditions.push(inArray(proposals.status, query.statuses))

  if (query.clientIds.length > 0) {
    const clientCondition = or(
      inArray(proposals.clientId, query.clientIds),
      inArray(projects.clientId, query.clientIds)
    )

    if (clientCondition) conditions.push(clientCondition)
  }

  if (query.totalMin !== null) conditions.push(gte(proposals.totalCents, query.totalMin))
  if (query.totalMax !== null) conditions.push(lte(proposals.totalCents, query.totalMax))

  if (query.validUntilFrom) conditions.push(gte(proposals.validUntil, query.validUntilFrom))
  if (query.validUntilTo) conditions.push(lte(proposals.validUntil, query.validUntilTo))

  return and(...conditions)
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
    clientId: row.clientId ?? row.projectClientId,
    clientName: row.clientName ?? row.projectClientName
  }
}
