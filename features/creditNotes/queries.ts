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
import { clients, creditNotes, invoices, lineItems, projects, taxRates } from "@/database/schema"

import {
  creditNoteIdSchema,
  invoiceCreditNotesParamsSchema,
  parseCreditNoteOverviewQuery,
  CREDIT_NOTE_OVERVIEW_DEFAULT_SORT,
  type CreditNoteOverviewQuery,
  type CreditNoteOverviewSortField
} from "./schemas"
import {
  computeInvoiceOutstandingAfterCredits,
  sumCreditNoteTotalCents,
  summarizeCreditNotes,
  type CreditNotesSummaryResult
} from "./services"
import {
  type CreditNoteDefaults,
  type CreditNoteDetail,
  type CreditNoteDetailLineItem,
  type CreditNoteEditorData,
  type CreditNoteListItem,
  type CreditNoteOverviewFilterOptions,
  type CreditNoteOverviewItem,
  type CreditNoteOverviewPageData,
  type CreditNoteTaxRateOption
} from "./types"

// The client of a project-scoped invoice, reached through its project. Aliased because the same
// `clients` table is also joined directly for an invoice raised straight against a client, and an
// invoice may have either link, or both.
const projectClients = alias(clients, "credit_note_project_clients")

type LineItemRow = typeof lineItems.$inferSelect

export async function getCreditNoteDefaults(): Promise<CreditNoteDefaults> {
  const row = await database.query.settings.findFirst({
    columns: { defaultCurrency: true, defaultLocale: true, defaultTimezone: true }
  })

  return {
    defaultCurrency: row?.defaultCurrency ?? "EUR",
    defaultLocale: row?.defaultLocale ?? "en",
    defaultTimezone: row?.defaultTimezone ?? "UTC"
  }
}

// Newest first, with `createdAt` breaking the tie so two notes issued the same instant keep the
// order they were written in rather than an arbitrary one.
export async function listInvoiceCreditNotes(input: unknown): Promise<CreditNoteListItem[]> {
  const parsed = invoiceCreditNotesParamsSchema.safeParse(input)

  if (!parsed.success) return []

  const rows = await database
    .select()
    .from(creditNotes)
    .where(and(eq(creditNotes.invoiceId, parsed.data.invoiceId), isNull(creditNotes.deletedAt)))
    .orderBy(desc(creditNotes.issuedAt), desc(creditNotes.createdAt))

  return rows.map((row) => ({
    id: row.id,
    invoiceId: row.invoiceId,
    number: row.number,
    reason: row.reason ?? "",
    currency: row.currency,
    totalCents: Number(row.totalCents),
    issuedAt: row.issuedAt
  }))
}

export async function getCreditNoteDetail(input: unknown): Promise<CreditNoteDetail | null> {
  const parsed = creditNoteIdSchema.safeParse(input)

  if (!parsed.success) return null

  const row = await database
    .select({
      creditNote: creditNotes,
      invoiceNumber: invoices.number,
      projectId: invoices.projectId,
      directClientId: invoices.clientId,
      directClientName: clients.name,
      projectClientId: projects.clientId,
      projectClientName: projectClients.name
    })
    .from(creditNotes)
    .innerJoin(invoices, eq(invoices.id, creditNotes.invoiceId))
    .leftJoin(projects, eq(projects.id, invoices.projectId))
    .leftJoin(clients, eq(clients.id, invoices.clientId))
    .leftJoin(projectClients, eq(projectClients.id, projects.clientId))
    .where(and(eq(creditNotes.id, parsed.data.id), isNull(creditNotes.deletedAt)))
    .limit(1)

  const found = row[0]

  if (!found) return null

  const [rows, defaults] = await Promise.all([
    listCreditNoteLineItems(found.creditNote.id),
    getCreditNoteDefaults()
  ])

  return {
    id: found.creditNote.id,
    invoiceId: found.creditNote.invoiceId,
    invoiceNumber: found.invoiceNumber,
    projectId: found.projectId,
    clientId: found.directClientId ?? found.projectClientId,
    clientName: found.directClientName ?? found.projectClientName ?? "",
    number: found.creditNote.number,
    reason: found.creditNote.reason ?? "",
    currency: found.creditNote.currency,
    subtotalCents: Number(found.creditNote.subtotalCents),
    taxAmountCents: Number(found.creditNote.taxAmountCents),
    totalCents: Number(found.creditNote.totalCents),
    issuedAt: found.creditNote.issuedAt,
    lineItems: rows.map(toCreditNoteDetailLineItem),
    defaults
  }
}

// The invoice tables are read directly rather than through `@/features/invoices/server`: that module
// already imports this feature's server barrel for the credit-note figures on its detail surface, so
// an arrow back the other way would make the two modules mutually dependent (`import/no-cycle`).
// Database schema is shared substrate, so this is a read of the substrate rather than a reach into
// another feature's code (architecture.md, boundary rule).
export async function getCreditNoteEditorData(
  input: unknown
): Promise<CreditNoteEditorData | null> {
  const parsed = invoiceCreditNotesParamsSchema.safeParse(input)

  if (!parsed.success) return null

  const row = await database
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      currency: invoices.currency,
      totalCents: invoices.totalCents,
      amountPaidCents: invoices.amountPaidCents,
      projectId: invoices.projectId,
      directClientName: clients.name,
      projectClientName: projectClients.name
    })
    .from(invoices)
    .leftJoin(projects, eq(projects.id, invoices.projectId))
    .leftJoin(clients, eq(clients.id, invoices.clientId))
    .leftJoin(projectClients, eq(projectClients.id, projects.clientId))
    .where(and(eq(invoices.id, parsed.data.invoiceId), isNull(invoices.deletedAt)))
    .limit(1)

  const invoice = row[0]

  // A draft cannot be credited — `createCreditNote` rejects it — so the editor refuses to open
  // rather than letting the form be filled in and then bounced by the action.
  if (!invoice || invoice.status === "draft") return null

  const [existing, taxRateOptions, defaults] = await Promise.all([
    listInvoiceCreditNotes({ invoiceId: invoice.id }),
    listCreditNoteTaxRates(),
    getCreditNoteDefaults()
  ])

  const creditNoteTotals = existing.map((creditNote) => creditNote.totalCents)
  const totalCents = Number(invoice.totalCents)

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    projectId: invoice.projectId,
    clientName: invoice.directClientName ?? invoice.projectClientName ?? "",
    currency: invoice.currency,
    invoiceTotalCents: totalCents,
    creditedCents: sumCreditNoteTotalCents(creditNoteTotals),
    outstandingCents: computeInvoiceOutstandingAfterCredits(
      { totalCents, amountPaidCents: Number(invoice.amountPaidCents) },
      creditNoteTotals
    ),
    taxRates: taxRateOptions,
    defaults
  }
}

// Instance-wide, because a credit note outlives the project its invoice was raised under and the
// question this page answers — what have I credited, and against what — is not per-project. Soft
// deleted notes are excluded; a soft-deleted invoice's notes are not, for the same reason the
// invoice overview keeps invoices whose project has gone: the money moved either way.
export async function getCreditNotesOverviewPageData(
  input: unknown
): Promise<CreditNoteOverviewPageData> {
  const query = parseCreditNoteOverviewQuery(input)

  // All four reads are independent. The invoice overview awaits its defaults first because its
  // currency fallback feeds the row mapper; nothing here consumes the defaults, so they run with
  // the rest rather than adding a round trip ahead of them.
  const [list, summary, filterOptions, defaults] = await Promise.all([
    listCreditNoteOverview(query),
    getCreditNoteOverviewSummary(),
    getCreditNoteOverviewFilterOptions(),
    getCreditNoteDefaults()
  ])

  return {
    creditNotes: list.rows,
    rowCount: list.rowCount,
    summary,
    filterOptions,
    defaults
  }
}

async function listCreditNoteOverview(
  query: CreditNoteOverviewQuery
): Promise<{ rows: CreditNoteOverviewItem[]; rowCount: number }> {
  const whereClause = getCreditNoteOverviewWhereClause(query)

  const sortColumns: Record<CreditNoteOverviewSortField, AnyColumn | SQL> = {
    number: creditNotes.number,
    invoice: invoices.number,
    client: sql`coalesce(${clients.name}, ${projectClients.name})`,
    issuedAt: creditNotes.issuedAt,
    total: creditNotes.totalCents
  }

  const sort = query.sort.length > 0 ? query.sort : [...CREDIT_NOTE_OVERVIEW_DEFAULT_SORT]
  const orderBy = [
    ...sort.map((item) => (item.desc ? desc(sortColumns[item.id]) : asc(sortColumns[item.id]))),
    desc(creditNotes.createdAt)
  ]

  const [rows, totalRows] = await Promise.all([
    database
      .select({
        id: creditNotes.id,
        number: creditNotes.number,
        currency: creditNotes.currency,
        totalCents: creditNotes.totalCents,
        issuedAt: creditNotes.issuedAt,
        invoiceId: creditNotes.invoiceId,
        invoiceNumber: invoices.number,
        projectId: invoices.projectId,
        directClientId: invoices.clientId,
        directClientName: clients.name,
        projectClientId: projects.clientId,
        projectClientName: projectClients.name
      })
      .from(creditNotes)
      .innerJoin(invoices, eq(invoices.id, creditNotes.invoiceId))
      .leftJoin(projects, eq(projects.id, invoices.projectId))
      .leftJoin(clients, eq(clients.id, invoices.clientId))
      .leftJoin(projectClients, eq(projectClients.id, projects.clientId))
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage),
    database
      .select({ value: count() })
      .from(creditNotes)
      .innerJoin(invoices, eq(invoices.id, creditNotes.invoiceId))
      .leftJoin(projects, eq(projects.id, invoices.projectId))
      .leftJoin(clients, eq(clients.id, invoices.clientId))
      .leftJoin(projectClients, eq(projectClients.id, projects.clientId))
      .where(whereClause)
  ])

  return {
    rows: rows.map((row) => ({
      id: row.id,
      number: row.number,
      invoiceId: row.invoiceId,
      invoiceNumber: row.invoiceNumber,
      projectId: row.projectId,
      clientId: row.directClientId ?? row.projectClientId,
      clientName: row.directClientName ?? row.projectClientName ?? "",
      currency: row.currency,
      totalCents: Number(row.totalCents),
      issuedAt: row.issuedAt
    })),
    rowCount: totalRows[0]?.value ?? 0
  }
}

// Deliberately unfiltered: the band reports what the instance has credited in total, so narrowing
// the table must not move the figures above it.
async function getCreditNoteOverviewSummary(): Promise<CreditNotesSummaryResult> {
  const rows = await database
    .select({
      invoiceId: creditNotes.invoiceId,
      currency: creditNotes.currency,
      totalCents: creditNotes.totalCents
    })
    .from(creditNotes)
    .where(isNull(creditNotes.deletedAt))

  return summarizeCreditNotes(
    rows.map((row) => ({
      invoiceId: row.invoiceId,
      currency: row.currency,
      totalCents: Number(row.totalCents)
    }))
  )
}

async function getCreditNoteOverviewFilterOptions(): Promise<CreditNoteOverviewFilterOptions> {
  const [directRows, projectRows] = await Promise.all([
    database
      .selectDistinct({ id: clients.id, name: clients.name })
      .from(creditNotes)
      .innerJoin(invoices, eq(invoices.id, creditNotes.invoiceId))
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .where(isNull(creditNotes.deletedAt)),
    database
      .selectDistinct({ id: projectClients.id, name: projectClients.name })
      .from(creditNotes)
      .innerJoin(invoices, eq(invoices.id, creditNotes.invoiceId))
      .innerJoin(projects, eq(projects.id, invoices.projectId))
      .innerJoin(projectClients, eq(projectClients.id, projects.clientId))
      .where(isNull(creditNotes.deletedAt))
  ])

  const byId = new Map([...directRows, ...projectRows].map((row) => [row.id, row]))

  return {
    clients: Array.from(byId.values()).sort((first, second) =>
      first.name.localeCompare(second.name)
    )
  }
}

function getCreditNoteOverviewWhereClause(query: CreditNoteOverviewQuery): SQL | undefined {
  const conditions: SQL[] = [isNull(creditNotes.deletedAt)]

  if (query.search) {
    const searchPattern = `%${query.search}%`
    const searchCondition = or(
      ilike(creditNotes.number, searchPattern),
      ilike(creditNotes.reason, searchPattern),
      ilike(invoices.number, searchPattern),
      ilike(clients.name, searchPattern),
      ilike(projectClients.name, searchPattern)
    )

    if (searchCondition) conditions.push(searchCondition)
  }

  if (query.clientIds.length > 0) {
    const clientCondition = or(
      inArray(invoices.clientId, query.clientIds),
      inArray(projects.clientId, query.clientIds)
    )

    if (clientCondition) conditions.push(clientCondition)
  }

  if (query.totalMin !== null) conditions.push(gte(creditNotes.totalCents, query.totalMin))
  if (query.totalMax !== null) conditions.push(lte(creditNotes.totalCents, query.totalMax))

  if (query.issuedFrom) conditions.push(gte(creditNotes.issuedAt, query.issuedFrom))
  if (query.issuedTo) conditions.push(lte(creditNotes.issuedAt, query.issuedTo))

  return and(...conditions)
}

async function listCreditNoteLineItems(creditNoteId: string): Promise<LineItemRow[]> {
  return database
    .select()
    .from(lineItems)
    .where(and(eq(lineItems.creditNoteId, creditNoteId), isNull(lineItems.deletedAt)))
    .orderBy(asc(lineItems.position))
}

async function listCreditNoteTaxRates(): Promise<CreditNoteTaxRateOption[]> {
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

function toCreditNoteDetailLineItem(row: LineItemRow): CreditNoteDetailLineItem {
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
