import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  type AnyColumn,
  type SQL
} from "drizzle-orm"

import { database } from "@/database"
import { clients, projects } from "@/database/schema"

import {
  parseProjectListQuery,
  projectIdSchema,
  type ProjectListQuery,
  type ProjectSortField
} from "./schemas"
import { summarizeProjects, toProjectFormData, type ProjectsSummary } from "./services"
import {
  type ProjectDefaults,
  type ProjectDetail,
  type ProjectFormData,
  type ProjectListItem,
  type ProjectListPageData
} from "./types"

const projectListColumns = {
  id: projects.id,
  name: projects.name,
  clientId: projects.clientId,
  clientName: clients.name,
  status: projects.status,
  currency: projects.currency,
  budgetCents: projects.budgetCents,
  hourlyRateCents: projects.hourlyRateCents,
  startDate: projects.startDate,
  endDate: projects.endDate,
  createdAt: projects.createdAt,
  deletedAt: projects.deletedAt
}

const projectDetailColumns = {
  ...projectListColumns,
  description: projects.description,
  updatedAt: projects.updatedAt
}

type ProjectListRow = {
  id: string
  name: string
  clientId: string
  clientName: string
  status: ProjectListItem["status"]
  currency: string | null
  budgetCents: number | null
  hourlyRateCents: number | null
  startDate: Date | null
  endDate: Date | null
  createdAt: Date
  deletedAt: Date | null
}

type ProjectDetailRow = ProjectListRow & {
  description: string | null
  updatedAt: Date
}

export async function getProjectsPageData(input: unknown): Promise<ProjectListPageData> {
  const query = parseProjectListQuery(input)
  const defaults = await getProjectDefaults()
  const [list, summary] = await Promise.all([
    listProjects(query, defaults.defaultCurrency),
    getProjectsSummary()
  ])

  return {
    projects: list.rows,
    rowCount: list.rowCount,
    summary,
    query,
    defaults
  }
}

export async function listProjects(
  query: ProjectListQuery,
  defaultCurrency = "EUR"
): Promise<{ rows: ProjectListItem[]; rowCount: number }> {
  const whereClause = getProjectListWhereClause(query)

  const sortColumns: Record<ProjectSortField, AnyColumn | SQL> = {
    name: projects.name,
    client: clients.name,
    status: projects.status,
    created: projects.createdAt
  }

  const orderBy =
    query.sort.length > 0
      ? query.sort.map((item) =>
          item.desc ? desc(sortColumns[item.id]) : asc(sortColumns[item.id])
        )
      : [desc(projects.createdAt)]

  const [rows, totalRows] = await Promise.all([
    database
      .select(projectListColumns)
      .from(projects)
      .innerJoin(clients, eq(clients.id, projects.clientId))
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage),
    database
      .select({ value: count() })
      .from(projects)
      .innerJoin(clients, eq(clients.id, projects.clientId))
      .where(whereClause)
  ])

  return {
    rows: rows.map((row) => toProjectListItem(row, defaultCurrency)),
    rowCount: totalRows[0]?.value ?? 0
  }
}

export async function listProjectsByClient(
  clientId: string,
  defaultCurrency = "EUR"
): Promise<ProjectListItem[]> {
  const rows = await database
    .select(projectListColumns)
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(and(eq(projects.clientId, clientId), isNull(projects.deletedAt)))
    .orderBy(desc(projects.createdAt))

  return rows.map((row) => toProjectListItem(row, defaultCurrency))
}

export async function getProjectsSummary(): Promise<ProjectsSummary> {
  const rows = await database
    .select({
      status: projects.status,
      createdAt: projects.createdAt
    })
    .from(projects)
    .where(isNull(projects.deletedAt))

  return summarizeProjects(rows, new Date())
}

export async function getProjectDefaults(): Promise<ProjectDefaults> {
  const row = await database.query.settings.findFirst({
    columns: {
      defaultCurrency: true,
      defaultLocale: true
    }
  })

  return {
    defaultCurrency: row?.defaultCurrency ?? "EUR",
    defaultLocale: row?.defaultLocale ?? "en"
  }
}

export async function getProjectDetail(input: unknown): Promise<ProjectDetail | null> {
  const parsed = projectIdSchema.safeParse(input)

  if (!parsed.success) return null

  const [row, defaults] = await Promise.all([
    database
      .select(projectDetailColumns)
      .from(projects)
      .innerJoin(clients, eq(clients.id, projects.clientId))
      .where(and(eq(projects.id, parsed.data.id), isNull(projects.deletedAt)))
      .limit(1),
    getProjectDefaults()
  ])

  const detailRow = row[0]

  return detailRow ? toProjectDetail(detailRow, defaults.defaultCurrency) : null
}

export async function getProjectForEdit(input: unknown): Promise<ProjectFormData | null> {
  const detail = await getProjectDetail(input)

  return detail ? toProjectFormData(detail) : null
}

function getProjectListWhereClause(query: ProjectListQuery): SQL | undefined {
  const conditions: SQL[] = []

  if (query.status === "active") conditions.push(isNull(projects.deletedAt))
  if (query.status === "deleted") conditions.push(isNotNull(projects.deletedAt))

  if (query.search) {
    const searchPattern = `%${query.search}%`
    const searchCondition = or(
      ilike(projects.name, searchPattern),
      ilike(clients.name, searchPattern)
    )

    if (searchCondition) conditions.push(searchCondition)
  }

  if (query.stages.length > 0) conditions.push(inArray(projects.status, query.stages))

  return and(...conditions)
}

function toProjectListItem(row: ProjectListRow, defaultCurrency: string): ProjectListItem {
  return {
    id: row.id,
    name: row.name,
    clientId: row.clientId,
    clientName: row.clientName,
    status: row.status,
    currency: row.currency ?? defaultCurrency,
    budgetCents: row.budgetCents ?? null,
    hourlyRateCents: row.hourlyRateCents ?? null,
    startDate: row.startDate,
    endDate: row.endDate,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt
  }
}

function toProjectDetail(row: ProjectDetailRow, defaultCurrency: string): ProjectDetail {
  return {
    id: row.id,
    name: row.name,
    clientId: row.clientId,
    clientName: row.clientName,
    status: row.status,
    currency: row.currency ?? defaultCurrency,
    budgetCents: row.budgetCents ?? null,
    hourlyRateCents: row.hourlyRateCents ?? null,
    startDate: row.startDate,
    endDate: row.endDate,
    description: row.description ?? "",
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}
