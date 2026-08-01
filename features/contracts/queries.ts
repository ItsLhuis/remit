import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  type AnyColumn,
  type SQL
} from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import { logger } from "@/lib/logger"

import { database } from "@/database"
import { clients, contractSignatures, contracts, projects, templates } from "@/database/schema"

import { blocksSchema, type Blocks } from "@/features/templates"

import {
  contractIdSchema,
  parseContractListQuery,
  CONTRACT_DEFAULT_SORT,
  type ContractListQuery,
  type ContractSortField
} from "./schemas"
import { resolveContractDisplayStatus, summarizeContracts, type ContractsSummary } from "./services"
import {
  type ContractDefaults,
  type ContractDetail,
  type ContractFilterOptions,
  type ContractFormData,
  type ContractListItem,
  type ContractParentOptions,
  type ContractsPageData
} from "./types"

// The client a project-level contract belongs to, reached through its project. Aliased because the
// same `clients` table is also joined directly for a client-level contract, and a row has one shape
// or the other, never both.
const projectClients = alias(clients, "project_clients")

const contractListColumns = {
  id: contracts.id,
  number: contracts.number,
  title: contracts.title,
  status: contracts.status,
  projectId: contracts.projectId,
  clientId: contracts.clientId,
  issuedAt: contracts.issuedAt,
  effectiveFrom: contracts.effectiveFrom,
  effectiveUntil: contracts.effectiveUntil,
  createdAt: contracts.createdAt,
  projectName: projects.name,
  projectClientId: projects.clientId,
  clientName: clients.name
}

type ContractListRow = {
  id: string
  number: string
  title: string
  status: ContractListItem["status"]
  projectId: string | null
  clientId: string | null
  issuedAt: Date | null
  effectiveFrom: Date | null
  effectiveUntil: Date | null
  createdAt: Date
  projectName: string | null
  projectClientId: string | null
  clientName: string | null
}

export async function getContractDefaults(): Promise<ContractDefaults> {
  const row = await database.query.settings.findFirst({
    columns: { defaultLocale: true, defaultTimezone: true }
  })

  return {
    defaultLocale: row?.defaultLocale ?? "en",
    defaultTimezone: row?.defaultTimezone ?? "UTC"
  }
}

export async function getContractsPageData(input: unknown): Promise<ContractsPageData> {
  const query = parseContractListQuery(input)
  const [list, summary, filterOptions, defaults] = await Promise.all([
    listContracts(query),
    getContractsSummary(),
    getContractFilterOptions(),
    getContractDefaults()
  ])

  return {
    contracts: list.rows,
    rowCount: list.rowCount,
    summary,
    query,
    filterOptions,
    defaults
  }
}

export async function listContracts(
  query: ContractListQuery
): Promise<{ rows: ContractListItem[]; rowCount: number }> {
  const whereClause = getContractWhereClause(query)

  const sortColumns: Record<ContractSortField, AnyColumn | SQL> = {
    number: contracts.number,
    title: contracts.title,
    parent: projects.name,
    effective: contracts.effectiveFrom,
    created: contracts.createdAt
  }

  const sort = query.sort.length > 0 ? query.sort : [...CONTRACT_DEFAULT_SORT]
  const orderBy = [
    ...sort.map((item) => (item.desc ? desc(sortColumns[item.id]) : asc(sortColumns[item.id]))),
    desc(contracts.createdAt)
  ]

  const [rows, totalRows] = await Promise.all([
    database
      .select(contractListColumns)
      .from(contracts)
      .leftJoin(projects, eq(projects.id, contracts.projectId))
      .leftJoin(clients, eq(clients.id, contracts.clientId))
      .leftJoin(projectClients, eq(projectClients.id, projects.clientId))
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage),
    database
      .select({ value: count() })
      .from(contracts)
      .leftJoin(projects, eq(projects.id, contracts.projectId))
      .leftJoin(clients, eq(clients.id, contracts.clientId))
      .leftJoin(projectClients, eq(projectClients.id, projects.clientId))
      .where(whereClause)
  ])

  const now = new Date()

  return {
    rows: rows.map((row) => toContractListItem(row, now)),
    rowCount: totalRows[0]?.value ?? 0
  }
}

export async function getContractDetail(input: unknown): Promise<ContractDetail | null> {
  const parsed = contractIdSchema.safeParse(input)

  if (!parsed.success) return null

  const contract = await database.query.contracts.findFirst({
    where: and(eq(contracts.id, parsed.data.id), isNull(contracts.deletedAt))
  })

  if (!contract) return null

  const [project, client, signature] = await Promise.all([
    contract.projectId
      ? database.query.projects.findFirst({
          where: eq(projects.id, contract.projectId),
          columns: { name: true }
        })
      : Promise.resolve(undefined),
    contract.clientId
      ? database.query.clients.findFirst({
          where: eq(clients.id, contract.clientId),
          columns: { name: true }
        })
      : Promise.resolve(undefined),
    database
      .select({ id: contractSignatures.id })
      .from(contractSignatures)
      .where(eq(contractSignatures.contractId, contract.id))
      .limit(1)
  ])

  return {
    id: contract.id,
    number: contract.number,
    title: contract.title,
    status: contract.status,
    displayStatus: resolveContractDisplayStatus(
      contract.status,
      contract.effectiveUntil,
      new Date()
    ),
    projectId: contract.projectId,
    clientId: contract.clientId,
    templateId: contract.templateId,
    proposalId: contract.proposalId,
    blocks: toContractBlocks(contract.blocks, contract.id),
    effectiveFrom: contract.effectiveFrom,
    effectiveUntil: contract.effectiveUntil,
    issuedAt: contract.issuedAt,
    terminatedAt: contract.terminatedAt,
    terminationReason: contract.terminationReason,
    projectName: project?.name ?? null,
    clientName: client?.name ?? null,
    hasSignature: signature.length > 0
  }
}

export async function getContractForEdit(input: unknown): Promise<ContractFormData | null> {
  const parsed = contractIdSchema.safeParse(input)

  if (!parsed.success) return null

  const contract = await database.query.contracts.findFirst({
    where: and(eq(contracts.id, parsed.data.id), isNull(contracts.deletedAt))
  })

  if (!contract) return null

  return {
    id: contract.id,
    number: contract.number,
    title: contract.title,
    status: contract.status,
    projectId: contract.projectId,
    clientId: contract.clientId,
    templateId: contract.templateId,
    proposalId: contract.proposalId,
    blocks: toContractBlocks(contract.blocks, contract.id),
    effectiveFrom: contract.effectiveFrom,
    effectiveUntil: contract.effectiveUntil
  }
}

export async function getContractParentOptions(): Promise<ContractParentOptions> {
  const [projectRows, clientRows, templateRows] = await Promise.all([
    database
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(isNull(projects.deletedAt))
      .orderBy(asc(projects.name)),
    database
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(isNull(clients.deletedAt))
      .orderBy(asc(clients.name)),
    database
      .select({ id: templates.id, name: templates.name, blocks: templates.blocks })
      .from(templates)
      .where(and(eq(templates.type, "contract"), isNull(templates.deletedAt)))
      .orderBy(desc(templates.isDefault), asc(templates.name))
  ])

  return {
    projects: projectRows,
    clients: clientRows,
    templates: templateRows.map((row) => ({
      id: row.id,
      name: row.name,
      blocks: toContractBlocks(row.blocks, row.id)
    }))
  }
}

async function getContractsSummary(): Promise<ContractsSummary> {
  const rows = await database
    .select({ status: contracts.status, effectiveUntil: contracts.effectiveUntil })
    .from(contracts)
    .where(isNull(contracts.deletedAt))

  return summarizeContracts(rows, new Date())
}

async function getContractFilterOptions(): Promise<ContractFilterOptions> {
  const [directRows, projectRows] = await Promise.all([
    database
      .selectDistinct({ id: clients.id, name: clients.name })
      .from(contracts)
      .innerJoin(clients, eq(clients.id, contracts.clientId))
      .where(isNull(contracts.deletedAt)),
    database
      .selectDistinct({ id: projectClients.id, name: projectClients.name })
      .from(contracts)
      .innerJoin(projects, eq(projects.id, contracts.projectId))
      .innerJoin(projectClients, eq(projectClients.id, projects.clientId))
      .where(isNull(contracts.deletedAt))
  ])

  const byId = new Map([...directRows, ...projectRows].map((row) => [row.id, row]))

  return { clients: Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name)) }
}

// A contract survives its parent: `projects` and `clients` are `ON DELETE SET NULL` and a contract
// may legitimately have neither a live project nor a live client, which is exactly why the canonical
// list is top-level rather than nested under a parent record. So unlike the proposal overview, the
// parent chain is left-joined for labels and filtering only and never narrows the population.
function getContractWhereClause(query: ContractListQuery): SQL | undefined {
  const conditions: SQL[] = [isNull(contracts.deletedAt)]

  if (query.search) {
    const searchPattern = `%${query.search}%`
    const searchCondition = or(
      ilike(contracts.number, searchPattern),
      ilike(contracts.title, searchPattern),
      ilike(projects.name, searchPattern),
      ilike(clients.name, searchPattern),
      ilike(projectClients.name, searchPattern)
    )

    if (searchCondition) conditions.push(searchCondition)
  }

  if (query.statuses.length > 0) conditions.push(inArray(contracts.status, query.statuses))

  if (query.clientIds.length > 0) {
    const clientCondition = or(
      inArray(contracts.clientId, query.clientIds),
      inArray(projects.clientId, query.clientIds)
    )

    if (clientCondition) conditions.push(clientCondition)
  }

  return and(...conditions)
}

// A corrupt snapshot degrades to an empty document rather than throwing: `blocks` is jsonb, so a row
// written by a restore or a script can reach a read path unparseable, and a whole page failing to
// render is a worse outcome than a contract that shows no content and is logged for the operator.
// `sourceId` is the contract or the template the snapshot came from, whichever this read is mapping.
export function toContractBlocks(value: unknown, sourceId: string): Blocks {
  const parsed = blocksSchema.safeParse(value)

  if (parsed.success) return parsed.data

  logger.error(
    { action: "contracts.readBlocks", sourceId },
    "Contract block snapshot failed validation"
  )

  return []
}

function toContractListItem(row: ContractListRow, now: Date): ContractListItem {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    status: row.status,
    displayStatus: resolveContractDisplayStatus(row.status, row.effectiveUntil, now),
    parentLabel: row.projectName ?? row.clientName ?? "",
    projectId: row.projectId,
    clientId: row.clientId ?? row.projectClientId,
    issuedAt: row.issuedAt,
    effectiveFrom: row.effectiveFrom,
    effectiveUntil: row.effectiveUntil,
    createdAt: row.createdAt
  }
}
