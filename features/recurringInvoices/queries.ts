import { and, asc, count, desc, eq, ilike, inArray, isNull, lte, or, type SQL } from "drizzle-orm"

import { logger } from "@/lib/logger"

import { database } from "@/database"
import {
  clients,
  invoices,
  projects,
  recurringInvoices,
  taxRates,
  templates
} from "@/database/schema"

import {
  parseRecurringInvoiceOverviewQuery,
  recurringInvoiceBlueprintSchema,
  recurringInvoiceIdSchema,
  type RecurringInvoiceBlueprintLine,
  type RecurringInvoiceOverviewQuery
} from "./schemas"
import {
  type RecurringInvoiceClientOption,
  type RecurringInvoiceDefaults,
  type RecurringInvoiceDetail,
  type RecurringInvoiceEditorData,
  type RecurringInvoiceListItem,
  type RecurringInvoiceListPageData,
  type RecurringInvoiceProjectOption,
  type RecurringInvoiceTaxRateOption,
  type RecurringInvoiceTemplateOption
} from "./types"

export type DueRecurringInvoice = {
  id: string
  nextRunAt: Date
}

export async function getRecurringInvoiceDefaults(): Promise<RecurringInvoiceDefaults> {
  const row = await database.query.settings.findFirst({
    columns: { defaultCurrency: true, defaultLocale: true, defaultTimezone: true }
  })

  return {
    defaultCurrency: row?.defaultCurrency ?? "EUR",
    defaultLocale: row?.defaultLocale ?? "en",
    defaultTimezone: row?.defaultTimezone ?? "UTC"
  }
}

export async function getRecurringInvoicesPageData(
  input: unknown
): Promise<RecurringInvoiceListPageData> {
  const query = parseRecurringInvoiceOverviewQuery(input)
  const where = buildRecurringInvoiceWhere(query)

  const [rows, [total], clientOptions, defaults] = await Promise.all([
    database
      .select({
        id: recurringInvoices.id,
        name: recurringInvoices.name,
        clientId: recurringInvoices.clientId,
        clientName: clients.name,
        projectName: projects.name,
        status: recurringInvoices.status,
        cadence: recurringInvoices.cadence,
        nextRunAt: recurringInvoices.nextRunAt,
        lastRunAt: recurringInvoices.lastRunAt,
        occurrencesGenerated: recurringInvoices.occurrencesGenerated,
        endAfterCount: recurringInvoices.endAfterCount,
        endByDate: recurringInvoices.endByDate,
        autoSend: recurringInvoices.autoSend,
        includedHours: recurringInvoices.includedHours,
        currency: recurringInvoices.currency
      })
      .from(recurringInvoices)
      .innerJoin(clients, eq(recurringInvoices.clientId, clients.id))
      .leftJoin(projects, eq(recurringInvoices.projectId, projects.id))
      .where(where)
      .orderBy(...buildRecurringInvoiceOrderBy(query))
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage),
    database
      .select({ value: count() })
      .from(recurringInvoices)
      .innerJoin(clients, eq(recurringInvoices.clientId, clients.id))
      .leftJoin(projects, eq(recurringInvoices.projectId, projects.id))
      .where(where),
    listRecurringInvoiceClientOptions(),
    getRecurringInvoiceDefaults()
  ])

  const rowCount = total?.value ?? 0

  return {
    rows: rows.map((row) => toRecurringInvoiceListItem(row, defaults.defaultCurrency)),
    rowCount,
    pageCount: Math.ceil(rowCount / query.perPage),
    clientOptions,
    defaults
  }
}

export async function getRecurringInvoiceDetail(
  input: unknown
): Promise<RecurringInvoiceDetail | null> {
  const parsed = recurringInvoiceIdSchema.safeParse(input)

  if (!parsed.success) return null

  const [row] = await database
    .select({
      schedule: recurringInvoices,
      clientName: clients.name,
      projectName: projects.name
    })
    .from(recurringInvoices)
    .innerJoin(clients, eq(recurringInvoices.clientId, clients.id))
    .leftJoin(projects, eq(recurringInvoices.projectId, projects.id))
    .where(and(eq(recurringInvoices.id, parsed.data.id), isNull(recurringInvoices.deletedAt)))
    .limit(1)

  if (!row) return null

  const generated = await database
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      issueDate: invoices.issueDate,
      totalCents: invoices.totalCents,
      currency: invoices.currency
    })
    .from(invoices)
    .where(and(eq(invoices.recurringInvoiceId, parsed.data.id), isNull(invoices.deletedAt)))
    .orderBy(desc(invoices.createdAt))

  const { schedule } = row

  return {
    id: schedule.id,
    name: schedule.name,
    clientId: schedule.clientId,
    clientName: row.clientName,
    projectId: schedule.projectId,
    projectName: row.projectName,
    templateId: schedule.templateId,
    status: schedule.status,
    cadence: schedule.cadence,
    cadenceDay: schedule.cadenceDay,
    nextRunAt: schedule.nextRunAt,
    lastRunAt: schedule.lastRunAt,
    endAfterCount: schedule.endAfterCount,
    endByDate: schedule.endByDate,
    occurrencesGenerated: schedule.occurrencesGenerated,
    autoSend: schedule.autoSend,
    currency: schedule.currency,
    includedHours: schedule.includedHours,
    overageRateCents: schedule.overageRateCents,
    notes: schedule.notes ?? "",
    lineItems: readBlueprint(schedule.id, schedule.lineItemsBlueprint),
    invoices: generated.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      issueDate: invoice.issueDate,
      totalCents: Number(invoice.totalCents),
      currency: invoice.currency
    }))
  }
}

export async function getRecurringInvoiceEditorData(
  input?: unknown
): Promise<RecurringInvoiceEditorData> {
  const [schedule, clientOptions, projectOptions, templateOptions, taxRateOptions, defaults] =
    await Promise.all([
      input === undefined ? Promise.resolve(null) : getRecurringInvoiceDetail(input),
      listRecurringInvoiceClientOptions(),
      listRecurringInvoiceProjectOptions(),
      listRecurringInvoiceTemplateOptions(),
      listRecurringInvoiceTaxRateOptions(),
      getRecurringInvoiceDefaults()
    ])

  return { schedule, clientOptions, projectOptions, templateOptions, taxRateOptions, defaults }
}

// The candidate set for the nightly sweep. It deliberately does not apply the end conditions —
// `shouldGenerateInvoice` owns that decision, and it runs again inside the per-schedule job under a
// row lock. Filtering here would duplicate the rule in SQL, where the two copies could drift.
export async function listDueRecurringInvoices(asOf: Date): Promise<DueRecurringInvoice[]> {
  return database
    .select({ id: recurringInvoices.id, nextRunAt: recurringInvoices.nextRunAt })
    .from(recurringInvoices)
    .where(
      and(
        eq(recurringInvoices.status, "active"),
        lte(recurringInvoices.nextRunAt, asOf),
        isNull(recurringInvoices.deletedAt)
      )
    )
    .orderBy(asc(recurringInvoices.nextRunAt))
}

type RecurringInvoiceListRow = {
  id: string
  name: string
  clientId: string
  clientName: string
  projectName: string | null
  status: RecurringInvoiceListItem["status"]
  cadence: RecurringInvoiceListItem["cadence"]
  nextRunAt: Date
  lastRunAt: Date | null
  occurrencesGenerated: number
  endAfterCount: number | null
  endByDate: Date | null
  autoSend: boolean
  includedHours: number | null
  currency: string
}

function toRecurringInvoiceListItem(
  row: RecurringInvoiceListRow,
  defaultCurrency: string
): RecurringInvoiceListItem {
  return {
    id: row.id,
    name: row.name,
    clientId: row.clientId,
    clientName: row.clientName,
    projectName: row.projectName,
    status: row.status,
    cadence: row.cadence,
    nextRunAt: row.nextRunAt,
    lastRunAt: row.lastRunAt,
    occurrencesGenerated: row.occurrencesGenerated,
    endAfterCount: row.endAfterCount,
    endByDate: row.endByDate,
    autoSend: row.autoSend,
    isRetainer: row.includedHours !== null,
    currency: row.currency || defaultCurrency
  }
}

// `line_items_blueprint` is jsonb with no shape enforced by the database, so a row edited by hand or
// written by an older version of this feature can be any JSON at all. A malformed blueprint degrades
// to an empty line list rather than throwing: the schedule still renders, and the generation job
// refuses to bill an empty blueprint anyway.
function readBlueprint(scheduleId: string, value: unknown): RecurringInvoiceBlueprintLine[] {
  const parsed = recurringInvoiceBlueprintSchema.safeParse(value)

  if (parsed.success) return parsed.data

  logger.error(
    { action: "readBlueprint", recurringInvoiceId: scheduleId, issues: parsed.error.issues },
    "Recurring invoice blueprint failed validation"
  )

  return []
}

function buildRecurringInvoiceWhere(query: RecurringInvoiceOverviewQuery): SQL | undefined {
  const filters: (SQL | undefined)[] = [isNull(recurringInvoices.deletedAt)]

  if (query.search) {
    filters.push(
      or(
        ilike(recurringInvoices.name, `%${query.search}%`),
        ilike(clients.name, `%${query.search}%`)
      )
    )
  }

  if (query.clientIds.length > 0) {
    filters.push(inArray(recurringInvoices.clientId, query.clientIds))
  }

  if (query.statuses.length > 0) {
    filters.push(inArray(recurringInvoices.status, query.statuses))
  }

  if (query.cadences.length > 0) {
    filters.push(inArray(recurringInvoices.cadence, query.cadences))
  }

  return and(...filters)
}

function buildRecurringInvoiceOrderBy(query: RecurringInvoiceOverviewQuery): SQL[] {
  const columns = {
    name: recurringInvoices.name,
    client: clients.name,
    cadence: recurringInvoices.cadence,
    nextRunAt: recurringInvoices.nextRunAt,
    status: recurringInvoices.status
  }

  const ordered = query.sort.map((item) =>
    item.desc ? desc(columns[item.id]) : asc(columns[item.id])
  )

  // `id` breaks every tie, so a page boundary cannot show the same schedule twice or skip one when
  // two rows share the sorted value.
  return [...ordered, asc(recurringInvoices.id)]
}

async function listRecurringInvoiceClientOptions(): Promise<RecurringInvoiceClientOption[]> {
  return database
    .select({ id: clients.id, name: clients.name, currency: clients.currency })
    .from(clients)
    .where(isNull(clients.deletedAt))
    .orderBy(asc(clients.name))
}

async function listRecurringInvoiceProjectOptions(): Promise<RecurringInvoiceProjectOption[]> {
  return database
    .select({ id: projects.id, name: projects.name, clientId: projects.clientId })
    .from(projects)
    .where(isNull(projects.deletedAt))
    .orderBy(asc(projects.name))
}

async function listRecurringInvoiceTemplateOptions(): Promise<RecurringInvoiceTemplateOption[]> {
  return database
    .select({ id: templates.id, name: templates.name })
    .from(templates)
    .where(and(eq(templates.type, "invoice"), isNull(templates.deletedAt)))
    .orderBy(desc(templates.isDefault), asc(templates.name))
}

async function listRecurringInvoiceTaxRateOptions(): Promise<RecurringInvoiceTaxRateOption[]> {
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
