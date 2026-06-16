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
  sql,
  type AnyColumn,
  type SQL
} from "drizzle-orm"

import { database } from "@/database"
import { leads } from "@/database/schema"

import { formatLeadName, summarizeLeads, type LeadsSummary } from "./services"
import { leadIdSchema, parseLeadListQuery, type LeadListQuery, type LeadSortField } from "./schemas"
import {
  type LeadDefaults,
  type LeadDetail,
  type LeadFormData,
  type LeadListItem,
  type LeadListPageData
} from "./types"

type LeadRow = typeof leads.$inferSelect

export async function getLeadsPageData(input: unknown): Promise<LeadListPageData> {
  const query = parseLeadListQuery(input)
  const [list, summary, defaults] = await Promise.all([
    listLeads(query),
    getLeadsSummary(),
    getLeadDefaults()
  ])

  return {
    leads: list.rows,
    rowCount: list.rowCount,
    summary,
    query,
    defaults
  }
}

export async function listLeads(
  query: LeadListQuery
): Promise<{ rows: LeadListItem[]; rowCount: number }> {
  const whereClause = getLeadListWhereClause(query)

  const sortColumns: Record<LeadSortField, AnyColumn | SQL> = {
    name: sql`coalesce(nullif(trim(concat_ws(' ', ${leads.firstName}, ${leads.lastName})), ''), ${leads.company}, ${leads.email})`,
    company: leads.company,
    status: leads.status,
    created: leads.createdAt
  }

  const orderBy =
    query.sort.length > 0
      ? query.sort.map((item) =>
          item.desc ? desc(sortColumns[item.id]) : asc(sortColumns[item.id])
        )
      : [desc(leads.createdAt)]

  const [rows, totalRows] = await Promise.all([
    database
      .select()
      .from(leads)
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage),
    database.select({ value: count() }).from(leads).where(whereClause)
  ])

  return {
    rows: rows.map(toLeadListItem),
    rowCount: totalRows[0]?.value ?? 0
  }
}

export async function getLeadsSummary(): Promise<LeadsSummary> {
  const rows = await database
    .select({
      status: leads.status,
      createdAt: leads.createdAt,
      convertedAt: leads.convertedAt
    })
    .from(leads)
    .where(isNull(leads.deletedAt))

  return summarizeLeads(rows, new Date())
}

export async function getLeadDefaults(): Promise<LeadDefaults> {
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

export async function getLeadDetail(input: unknown): Promise<LeadDetail | null> {
  const parsed = leadIdSchema.safeParse(input)

  if (!parsed.success) return null

  const row = await database.query.leads.findFirst({
    where: and(eq(leads.id, parsed.data.id), isNull(leads.deletedAt))
  })

  return row ? toLeadDetail(row) : null
}

export async function getLeadForEdit(input: unknown): Promise<LeadFormData | null> {
  const parsed = leadIdSchema.safeParse(input)

  if (!parsed.success) return null

  const row = await database.query.leads.findFirst({
    where: and(eq(leads.id, parsed.data.id), isNull(leads.deletedAt))
  })

  return row ? toLeadFormData(row) : null
}

export function toLeadFormData(row: LeadRow): LeadFormData {
  return {
    id: row.id,
    firstName: row.firstName ?? "",
    lastName: row.lastName ?? "",
    company: row.company ?? "",
    email: row.email,
    phone: row.phone ?? "",
    source: row.source ?? "",
    notes: row.notes ?? "",
    lostReason: row.lostReason ?? ""
  }
}

function getLeadListWhereClause(query: LeadListQuery): SQL | undefined {
  const conditions: SQL[] = []

  if (query.status === "active") conditions.push(isNull(leads.deletedAt))
  if (query.status === "deleted") conditions.push(isNotNull(leads.deletedAt))

  if (query.search) {
    const searchPattern = `%${query.search}%`
    const searchCondition = or(
      ilike(leads.firstName, searchPattern),
      ilike(leads.lastName, searchPattern),
      ilike(leads.company, searchPattern),
      ilike(leads.email, searchPattern)
    )

    if (searchCondition) conditions.push(searchCondition)
  }

  if (query.stages.length > 0) conditions.push(inArray(leads.status, query.stages))

  return and(...conditions)
}

function toLeadListItem(row: LeadRow): LeadListItem {
  const firstName = row.firstName ?? ""
  const lastName = row.lastName ?? ""
  const company = row.company ?? ""

  return {
    id: row.id,
    firstName,
    lastName,
    company,
    displayName: formatLeadName({ firstName, lastName, company, email: row.email }),
    email: row.email,
    phone: row.phone ?? "",
    source: row.source ?? "",
    status: row.status,
    convertedAt: row.convertedAt,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt
  }
}

function toLeadDetail(row: LeadRow): LeadDetail {
  const firstName = row.firstName ?? ""
  const lastName = row.lastName ?? ""
  const company = row.company ?? ""

  return {
    id: row.id,
    firstName,
    lastName,
    company,
    displayName: formatLeadName({ firstName, lastName, company, email: row.email }),
    email: row.email,
    phone: row.phone ?? "",
    source: row.source ?? "",
    status: row.status,
    notes: row.notes ?? "",
    lostReason: row.lostReason ?? "",
    convertedAt: row.convertedAt,
    convertedToClientId: row.convertedToClientId,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}
