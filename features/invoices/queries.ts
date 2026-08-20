import { and, asc, desc, eq, isNull } from "drizzle-orm"

import { formatCentsForInput } from "@/lib/utils"

import { database } from "@/database"
import {
  clients,
  invoices,
  lineItems,
  projects,
  proposals,
  taxRates,
  templates
} from "@/database/schema"

import {
  invoiceIdSchema,
  invoiceListParamsSchema,
  type InvoiceDiscountKind,
  type InvoiceStatus
} from "./schemas"
import { summarizeInvoices } from "./services"
import {
  type ConvertibleProposalOption,
  type InvoiceDefaults,
  type InvoiceDetail,
  type InvoiceDetailLineItem,
  type InvoiceEditorData,
  type InvoiceFormData,
  type InvoiceListItem,
  type InvoiceListPageData,
  type InvoiceTaxRateOption,
  type InvoiceTemplateOption,
  type ProposalInvoiceSnapshot
} from "./types"

const invoiceListColumns = {
  id: invoices.id,
  projectId: invoices.projectId,
  number: invoices.number,
  status: invoices.status,
  currency: invoices.currency,
  totalCents: invoices.totalCents,
  amountPaidCents: invoices.amountPaidCents,
  issueDate: invoices.issueDate,
  dueDate: invoices.dueDate,
  paidAt: invoices.paidAt,
  createdAt: invoices.createdAt
}

type InvoiceListRow = {
  id: string
  projectId: string | null
  number: string
  status: InvoiceStatus
  currency: string
  totalCents: number
  amountPaidCents: number
  issueDate: Date | null
  dueDate: Date | null
  paidAt: Date | null
  createdAt: Date
}

type LineItemRow = typeof lineItems.$inferSelect

export async function getInvoiceDefaults(): Promise<InvoiceDefaults> {
  const row = await database.query.settings.findFirst({
    columns: {
      defaultCurrency: true,
      defaultLocale: true,
      defaultTimezone: true,
      paymentTermsDays: true,
      defaultNotesInvoice: true
    }
  })

  return {
    defaultCurrency: row?.defaultCurrency ?? "EUR",
    defaultLocale: row?.defaultLocale ?? "en",
    defaultTimezone: row?.defaultTimezone ?? "UTC",
    paymentTermsDays: row?.paymentTermsDays ?? 30,
    defaultNotesInvoice: row?.defaultNotesInvoice ?? ""
  }
}

export async function listInvoicesByProject(
  projectId: string,
  defaultCurrency = "EUR"
): Promise<InvoiceListItem[]> {
  const rows = await database
    .select(invoiceListColumns)
    .from(invoices)
    .where(and(eq(invoices.projectId, projectId), isNull(invoices.deletedAt)))
    .orderBy(desc(invoices.createdAt))

  return rows.map((row) => toInvoiceListItem(row, defaultCurrency))
}

export async function getInvoicesPageData(input: unknown): Promise<InvoiceListPageData | null> {
  const parsed = invoiceListParamsSchema.safeParse(input)

  if (!parsed.success) return null

  const project = await database.query.projects.findFirst({
    where: and(eq(projects.id, parsed.data.projectId), isNull(projects.deletedAt)),
    columns: { id: true, name: true, currency: true }
  })

  if (!project) return null

  const defaults = await getInvoiceDefaults()
  const currency = project.currency ?? defaults.defaultCurrency
  const invoiceList = await listInvoicesByProject(project.id, currency)

  return {
    projectId: project.id,
    projectName: project.name,
    currency,
    invoices: invoiceList,
    summary: summarizeInvoices(invoiceList, new Date()),
    defaults
  }
}

export async function getInvoiceDetail(input: unknown): Promise<InvoiceDetail | null> {
  const parsed = invoiceIdSchema.safeParse(input)

  if (!parsed.success) return null

  const invoice = await database.query.invoices.findFirst({
    where: and(eq(invoices.id, parsed.data.id), isNull(invoices.deletedAt))
  })

  if (!invoice) return null

  const [project, client, template, rows, defaults] = await Promise.all([
    invoice.projectId
      ? database.query.projects.findFirst({
          where: eq(projects.id, invoice.projectId),
          columns: { name: true }
        })
      : Promise.resolve(undefined),
    invoice.clientId
      ? database.query.clients.findFirst({
          where: eq(clients.id, invoice.clientId),
          columns: { name: true }
        })
      : Promise.resolve(undefined),
    invoice.templateId
      ? database.query.templates.findFirst({
          where: eq(templates.id, invoice.templateId),
          columns: { name: true }
        })
      : Promise.resolve(undefined),
    listInvoiceLineItems(invoice.id),
    getInvoiceDefaults()
  ])

  return {
    id: invoice.id,
    projectId: invoice.projectId,
    projectName: project?.name ?? "",
    clientId: invoice.clientId,
    clientName: client?.name ?? "",
    proposalId: invoice.proposalId,
    number: invoice.number,
    status: invoice.status,
    currency: invoice.currency,
    subtotalCents: Number(invoice.subtotalCents),
    discountAmountTotalCents: Number(invoice.discountAmountTotalCents),
    taxAmountCents: Number(invoice.taxAmountCents),
    totalCents: Number(invoice.totalCents),
    amountPaidCents: Number(invoice.amountPaidCents),
    discountPercentage:
      invoice.discountPercentage === null ? null : Number(invoice.discountPercentage),
    discountAmountCents:
      invoice.discountAmountCents === null ? null : Number(invoice.discountAmountCents),
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    paidAt: invoice.paidAt,
    notes: invoice.notes ?? "",
    viewCount: invoice.viewCount,
    templateName: template?.name ?? null,
    // The token exists from creation, but exposing it before the invoice is sent would hand out a
    // live client URL for a document the client is not meant to have seen yet. The test is the
    // status rather than `issueDate`, because a draft may already carry an issue date from the form
    // and `getPublicInvoice` in publicQueries.ts admits sent and paid invoices only — a link offered
    // for a draft would resolve to the "unavailable" panel.
    publicPath: invoice.status === "draft" ? null : `/i/${invoice.publicToken}`,
    lineItems: rows.map(toInvoiceDetailLineItem),
    defaults
  }
}

export async function getInvoiceForEdit(input: unknown): Promise<InvoiceFormData | null> {
  const parsed = invoiceIdSchema.safeParse(input)

  if (!parsed.success) return null

  const invoice = await database.query.invoices.findFirst({
    where: and(eq(invoices.id, parsed.data.id), isNull(invoices.deletedAt))
  })

  if (!invoice) return null

  const rows = await listInvoiceLineItems(invoice.id)

  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    currency: invoice.currency,
    templateId: invoice.templateId ?? "",
    issueDate: toDateInput(invoice.issueDate),
    dueDate: toDateInput(invoice.dueDate),
    notes: invoice.notes ?? "",
    discountKind: toDiscountKind(invoice.discountType),
    discountPercentage:
      invoice.discountPercentage === null ? "" : String(Number(invoice.discountPercentage)),
    discountAmount: formatCentsForInput(invoice.discountAmountCents),
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

export async function getInvoiceEditorData(input: unknown): Promise<InvoiceEditorData | null> {
  const parsed = invoiceListParamsSchema.safeParse(input)

  if (!parsed.success) return null

  const project = await database.query.projects.findFirst({
    where: and(eq(projects.id, parsed.data.projectId), isNull(projects.deletedAt)),
    columns: { id: true, name: true }
  })

  if (!project) return null

  const [defaults, taxRateOptions, templateOptions] = await Promise.all([
    getInvoiceDefaults(),
    listInvoiceTaxRates(),
    listInvoiceTemplates()
  ])

  return {
    projectId: project.id,
    projectName: project.name,
    defaults,
    taxRates: taxRateOptions,
    templates: templateOptions
  }
}

// The proposal tables are read directly rather than through `@/features/proposals/server` because
// the shape needed here is invoice-specific: the "not yet invoiced" test is a lookup on
// `invoices.proposal_id`, which the proposals module has no reason to know about. Database schema is
// shared substrate, so this is a read of the substrate, not a reach into another feature's code
// (architecture.md, boundary rule).
export async function listConvertibleProposals(
  input: unknown
): Promise<ConvertibleProposalOption[]> {
  const parsed = invoiceListParamsSchema.safeParse(input)

  if (!parsed.success) return []

  const rows = await database
    .select({
      id: proposals.id,
      number: proposals.number,
      currency: proposals.currency,
      totalCents: proposals.totalCents,
      invoiceId: invoices.id
    })
    .from(proposals)
    .leftJoin(invoices, and(eq(invoices.proposalId, proposals.id), isNull(invoices.deletedAt)))
    .where(
      and(
        eq(proposals.projectId, parsed.data.projectId),
        eq(proposals.status, "accepted"),
        isNull(proposals.deletedAt)
      )
    )
    .orderBy(desc(proposals.issuedAt))

  return rows
    .filter((row) => row.invoiceId === null)
    .map((row) => ({
      id: row.id,
      number: row.number,
      currency: row.currency,
      totalCents: Number(row.totalCents)
    }))
}

export async function getProposalInvoiceSnapshot(
  proposalId: string
): Promise<ProposalInvoiceSnapshot | null> {
  const proposal = await database.query.proposals.findFirst({
    where: and(
      eq(proposals.id, proposalId),
      eq(proposals.status, "accepted"),
      isNull(proposals.deletedAt)
    )
  })

  if (!proposal) return null

  const rows = await database
    .select()
    .from(lineItems)
    .where(and(eq(lineItems.proposalId, proposal.id), isNull(lineItems.deletedAt)))
    .orderBy(asc(lineItems.position))

  return {
    id: proposal.id,
    projectId: proposal.projectId,
    // Read straight off the proposal rather than joined through its project: since stage 29 the
    // proposal carries its own `client_id`, and `fk_proposals_project_client` keeps the two in
    // agreement, so the join would only re-derive what the column already says.
    clientId: proposal.clientId,
    currency: proposal.currency,
    notes: proposal.notes,
    discountType: proposal.discountType,
    discountPercentage: proposal.discountPercentage,
    discountAmountCents:
      proposal.discountAmountCents === null ? null : Number(proposal.discountAmountCents),
    lineItems: rows.map((row) => ({
      description: row.description,
      unit: row.unit,
      quantity: row.quantity,
      unitPriceCents: Number(row.unitPriceCents),
      discountType: row.discountType,
      discountPercentage: row.discountPercentage,
      discountAmountCents:
        row.discountAmountCents === null ? null : Number(row.discountAmountCents),
      taxRateId: row.taxRateId,
      taxPercentage: Number(row.taxPercentageSnapshot)
    }))
  }
}

export async function listInvoiceLineItems(invoiceId: string): Promise<LineItemRow[]> {
  return database
    .select()
    .from(lineItems)
    .where(and(eq(lineItems.invoiceId, invoiceId), isNull(lineItems.deletedAt)))
    .orderBy(asc(lineItems.position))
}

async function listInvoiceTaxRates(): Promise<InvoiceTaxRateOption[]> {
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

async function listInvoiceTemplates(): Promise<InvoiceTemplateOption[]> {
  const rows = await database
    .select({ id: templates.id, name: templates.name })
    .from(templates)
    .where(and(eq(templates.type, "invoice"), isNull(templates.deletedAt)))
    .orderBy(desc(templates.isDefault), asc(templates.name))

  return rows
}

function toInvoiceListItem(row: InvoiceListRow, defaultCurrency: string): InvoiceListItem {
  return {
    id: row.id,
    projectId: row.projectId,
    number: row.number,
    status: row.status,
    currency: row.currency ?? defaultCurrency,
    totalCents: Number(row.totalCents),
    amountPaidCents: Number(row.amountPaidCents),
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    paidAt: row.paidAt,
    createdAt: row.createdAt
  }
}

export function toInvoiceDetailLineItem(row: LineItemRow): InvoiceDetailLineItem {
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

function toDiscountKind(value: "percentage" | "fixed" | null): InvoiceDiscountKind {
  return value ?? "none"
}

function toDateInput(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : ""
}
