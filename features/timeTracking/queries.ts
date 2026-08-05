import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  type AnyColumn,
  type SQL
} from "drizzle-orm"

import { getSession } from "@/lib/auth/session"

import { formatCentsForInput } from "@/lib/utils"

import { database } from "@/database"
import { clients, projects, tasks, timeEntries } from "@/database/schema"

import {
  parseTimeEntryListQuery,
  timeEntryIdSchema,
  type TimeEntryListQuery,
  type TimeEntrySortField
} from "./schemas"
import { aggregateBillableHours, calculateEntryAmountCents } from "./services"
import {
  type RunningTimer,
  type TimeEntryFormData,
  type TimeEntryListItem,
  type TimeTrackingDefaults,
  type TimeTrackingPageData,
  type TimeTrackingProjectOption,
  type TimeTrackingSummary,
  type TimeTrackingTaskOption
} from "./types"

type TimeEntryRow = {
  id: string
  projectId: string
  projectName: string
  projectCurrency: string | null
  clientName: string
  taskId: string | null
  taskTitle: string | null
  description: string | null
  startedAt: Date
  endedAt: Date | null
  durationSeconds: number | null
  billable: boolean
  hourlyRateOverrideCents: number | null
  hourlyRateSnapshotCents: number
  source: TimeEntryListItem["source"]
  invoicedInId: string | null
  deletedAt: Date | null
}

const timeEntryListColumns = {
  id: timeEntries.id,
  projectId: timeEntries.projectId,
  projectName: projects.name,
  projectCurrency: projects.currency,
  clientName: clients.name,
  taskId: timeEntries.taskId,
  taskTitle: tasks.title,
  description: timeEntries.description,
  startedAt: timeEntries.startedAt,
  endedAt: timeEntries.endedAt,
  durationSeconds: timeEntries.durationSeconds,
  billable: timeEntries.billable,
  hourlyRateOverrideCents: timeEntries.hourlyRateOverrideCents,
  hourlyRateSnapshotCents: timeEntries.hourlyRateSnapshotCents,
  source: timeEntries.source,
  invoicedInId: timeEntries.invoicedInId,
  deletedAt: timeEntries.deletedAt
}

export async function getTimeTrackingPageData(input: unknown): Promise<TimeTrackingPageData> {
  const query = parseTimeEntryListQuery(input)
  const session = await getSession()
  const defaults = await getTimeTrackingDefaults()

  const [list, runningTimer, summary, projectOptions, taskOptions] = await Promise.all([
    listTimeEntries(query, defaults.defaultCurrency),
    getRunningTimer(session?.user.id ?? null, defaults.defaultCurrency),
    getTimeTrackingSummary(defaults.defaultCurrency),
    listTimeTrackingProjectOptions(defaults.defaultCurrency),
    listTimeTrackingTaskOptions()
  ])

  return {
    entries: list.rows,
    rowCount: list.rowCount,
    runningTimer,
    summary,
    query,
    projectOptions,
    taskOptions,
    defaults
  }
}

export async function listTimeEntries(
  query: TimeEntryListQuery,
  defaultCurrency = "EUR"
): Promise<{ rows: TimeEntryListItem[]; rowCount: number }> {
  const whereClause = getTimeEntryWhereClause(query)

  const sortColumns: Record<TimeEntrySortField, AnyColumn> = {
    started: timeEntries.startedAt,
    duration: timeEntries.durationSeconds,
    project: projects.name
  }

  const orderBy =
    query.sort.length > 0
      ? query.sort.map((item) =>
          item.desc ? desc(sortColumns[item.id]) : asc(sortColumns[item.id])
        )
      : [desc(timeEntries.startedAt)]

  const [rows, totalRows] = await Promise.all([
    database
      .select(timeEntryListColumns)
      .from(timeEntries)
      .innerJoin(projects, eq(projects.id, timeEntries.projectId))
      .innerJoin(clients, eq(clients.id, projects.clientId))
      .leftJoin(tasks, eq(tasks.id, timeEntries.taskId))
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage),
    database
      .select({ value: count() })
      .from(timeEntries)
      .innerJoin(projects, eq(projects.id, timeEntries.projectId))
      .innerJoin(clients, eq(clients.id, projects.clientId))
      .leftJoin(tasks, eq(tasks.id, timeEntries.taskId))
      .where(whereClause)
  ])

  return {
    rows: rows.map((row) => toTimeEntryListItem(row, defaultCurrency)),
    rowCount: totalRows[0]?.value ?? 0
  }
}

// Scoped to one user because the running timer is that user's, not the instance's: the single-timer
// rule in `mutations.ts` is per user, and the widget must not offer to stop somebody else's clock.
export async function getRunningTimer(
  userId: string | null,
  defaultCurrency = "EUR"
): Promise<RunningTimer | null> {
  if (!userId) return null

  const [row] = await database
    .select({
      id: timeEntries.id,
      projectId: timeEntries.projectId,
      projectName: projects.name,
      projectCurrency: projects.currency,
      taskId: timeEntries.taskId,
      taskTitle: tasks.title,
      description: timeEntries.description,
      startedAt: timeEntries.startedAt,
      billable: timeEntries.billable,
      hourlyRateSnapshotCents: timeEntries.hourlyRateSnapshotCents
    })
    .from(timeEntries)
    .innerJoin(projects, eq(projects.id, timeEntries.projectId))
    .leftJoin(tasks, eq(tasks.id, timeEntries.taskId))
    .where(
      and(
        eq(timeEntries.userId, userId),
        isNull(timeEntries.endedAt),
        isNull(timeEntries.deletedAt)
      )
    )
    .limit(1)

  if (!row) return null

  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.projectName,
    taskId: row.taskId,
    taskTitle: row.taskTitle,
    description: row.description ?? "",
    startedAt: row.startedAt,
    billable: row.billable,
    hourlyRateSnapshotCents: Number(row.hourlyRateSnapshotCents),
    currency: row.projectCurrency ?? defaultCurrency
  }
}

export async function getTimeEntryForEdit(input: unknown): Promise<TimeEntryFormData | null> {
  const parsed = timeEntryIdSchema.safeParse(input)

  if (!parsed.success) return null

  const row = await database.query.timeEntries.findFirst({
    where: and(eq(timeEntries.id, parsed.data.id), isNull(timeEntries.deletedAt))
  })

  if (!row?.endedAt) return null

  return {
    id: row.id,
    projectId: row.projectId,
    taskId: row.taskId ?? "",
    description: row.description ?? "",
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt.toISOString(),
    billable: row.billable,
    hourlyRate: formatCentsForInput(row.hourlyRateOverrideCents)
  }
}

export async function getTimeTrackingDefaults(): Promise<TimeTrackingDefaults> {
  const row = await database.query.settings.findFirst({
    columns: {
      defaultCurrency: true,
      defaultLocale: true,
      defaultTimezone: true
    }
  })

  return {
    defaultCurrency: row?.defaultCurrency ?? "EUR",
    defaultLocale: row?.defaultLocale ?? "en",
    defaultTimezone: row?.defaultTimezone ?? "UTC"
  }
}

async function getTimeTrackingSummary(defaultCurrency: string): Promise<TimeTrackingSummary> {
  const rows = await database
    .select({
      durationSeconds: timeEntries.durationSeconds,
      billable: timeEntries.billable,
      invoicedInId: timeEntries.invoicedInId,
      hourlyRateSnapshotCents: timeEntries.hourlyRateSnapshotCents,
      currency: projects.currency
    })
    .from(timeEntries)
    .innerJoin(projects, eq(projects.id, timeEntries.projectId))
    .where(isNull(timeEntries.deletedAt))

  const aggregate = aggregateBillableHours(
    rows.map((row) => ({
      durationSeconds: row.durationSeconds,
      billable: row.billable,
      invoicedInId: row.invoicedInId,
      hourlyRateSnapshotCents: Number(row.hourlyRateSnapshotCents),
      currency: row.currency ?? defaultCurrency
    }))
  )

  return {
    totalSeconds: aggregate.totalSeconds,
    billableSeconds: aggregate.billableSeconds,
    unbilledSeconds: aggregate.unbilledSeconds,
    unbilledAmountCents: aggregate.unbilledAmountCentsByCurrency[defaultCurrency] ?? 0,
    unbilledCurrency: defaultCurrency
  }
}

async function listTimeTrackingProjectOptions(
  defaultCurrency: string
): Promise<TimeTrackingProjectOption[]> {
  const rows = await database
    .select({
      id: projects.id,
      name: projects.name,
      currency: projects.currency,
      clientName: clients.name
    })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(and(isNull(projects.deletedAt), isNull(clients.deletedAt)))
    .orderBy(asc(clients.name), asc(projects.name))

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    clientName: row.clientName,
    currency: row.currency ?? defaultCurrency
  }))
}

async function listTimeTrackingTaskOptions(): Promise<TimeTrackingTaskOption[]> {
  const rows = await database
    .select({ id: tasks.id, projectId: tasks.projectId, title: tasks.title })
    .from(tasks)
    .where(isNull(tasks.deletedAt))
    .orderBy(asc(tasks.title))

  return rows.map((row) => ({ id: row.id, projectId: row.projectId, title: row.title }))
}

function getTimeEntryWhereClause(query: TimeEntryListQuery): SQL | undefined {
  const conditions: SQL[] = []

  if (query.status === "active") conditions.push(isNull(timeEntries.deletedAt))
  if (query.status === "deleted") conditions.push(isNotNull(timeEntries.deletedAt))

  if (query.search) {
    const searchPattern = `%${query.search}%`
    const searchCondition = or(
      ilike(timeEntries.description, searchPattern),
      ilike(projects.name, searchPattern),
      ilike(tasks.title, searchPattern)
    )

    if (searchCondition) conditions.push(searchCondition)
  }

  if (query.projectIds.length > 0) {
    conditions.push(inArray(timeEntries.projectId, query.projectIds))
  }

  if (query.taskIds.length > 0) conditions.push(inArray(timeEntries.taskId, query.taskIds))

  const billableCondition = getBillableCondition(query.billable)

  if (billableCondition) conditions.push(billableCondition)

  const invoicedCondition = getInvoicedCondition(query.invoiced)

  if (invoicedCondition) conditions.push(invoicedCondition)

  if (query.startedFrom) conditions.push(gte(timeEntries.startedAt, query.startedFrom))
  if (query.startedTo) conditions.push(lte(timeEntries.startedAt, query.startedTo))

  return and(...conditions)
}

// Both filters return undefined when every option is selected as well as when none is, because
// selecting the whole set narrows nothing and the extra predicate would only cost an index scan.
function getBillableCondition(values: TimeEntryListQuery["billable"]): SQL | undefined {
  if (values.length === 0 || values.length === 2) return undefined

  return eq(timeEntries.billable, values[0] === "billable")
}

function getInvoicedCondition(values: TimeEntryListQuery["invoiced"]): SQL | undefined {
  if (values.length === 0 || values.length === 2) return undefined

  return values[0] === "unbilled"
    ? isNull(timeEntries.invoicedInId)
    : isNotNull(timeEntries.invoicedInId)
}

function toTimeEntryListItem(row: TimeEntryRow, defaultCurrency: string): TimeEntryListItem {
  const hourlyRateSnapshotCents = Number(row.hourlyRateSnapshotCents)

  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.projectName,
    clientName: row.clientName,
    taskId: row.taskId,
    taskTitle: row.taskTitle,
    description: row.description ?? "",
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    durationSeconds: row.durationSeconds,
    billable: row.billable,
    hourlyRateOverrideCents:
      row.hourlyRateOverrideCents === null ? null : Number(row.hourlyRateOverrideCents),
    hourlyRateSnapshotCents,
    amountCents: calculateEntryAmountCents(row.durationSeconds, hourlyRateSnapshotCents),
    currency: row.projectCurrency ?? defaultCurrency,
    source: row.source,
    invoicedInId: row.invoicedInId,
    deletedAt: row.deletedAt
  }
}
