import { and, asc, eq, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { database } from "@/database"
import { clients, invoices, lineItems, projects } from "@/database/schema"

import { getClientDocumentRecipient } from "@/features/clients/server"

import { type TemplateRenderData } from "@/features/templates"

import { type InvoiceStatus } from "./schemas"
import {
  buildInvoiceRenderData,
  type InvoiceRenderClient,
  type InvoiceRenderLineItem
} from "./services"

// One assembly of an invoice's merge data, shared by the PDF builder and the email job. They render
// different things — a document and a message — from the same facts, and letting each gather its own
// would be two chances for the mail to disagree with the attachment it carries.
//
// The extra fields beside `renderData` exist because the email needs them as ICU arguments rather
// than as merge tokens: the fallback copy is a translation string, not a template.

export type InvoiceDocumentData = {
  renderData: TemplateRenderData
  number: string
  currency: string
  locale: string
  dueDate: Date | null
  publicToken: string
  outstandingCents: number
  businessName: string
  templateId: string | null
  recipientEmail: string | null
  recipientName: string
}

export async function buildInvoiceDocumentData(
  invoiceId: string
): Promise<InvoiceDocumentData | null> {
  const invoice = await database.query.invoices.findFirst({
    where: and(eq(invoices.id, invoiceId), isNull(invoices.deletedAt))
  })

  if (!invoice) return null

  const clientId = invoice.clientId ?? (await getProjectClientId(invoice.projectId))

  const [instance, client, recipient, items] = await Promise.all([
    database.query.settings.findFirst(),
    getInvoiceClient(clientId),
    getClientDocumentRecipient(clientId),
    getInvoiceLineItems(invoiceId)
  ])

  const locale = instance?.defaultLocale ?? "en"
  const totalCents = Number(invoice.totalCents)
  const amountPaidCents = Number(invoice.amountPaidCents)

  const renderData = buildInvoiceRenderData({
    invoice: {
      number: invoice.number,
      currency: invoice.currency,
      subtotalCents: Number(invoice.subtotalCents),
      discountAmountTotalCents: Number(invoice.discountAmountTotalCents),
      taxAmountCents: Number(invoice.taxAmountCents),
      totalCents,
      amountPaidCents,
      lateFeeCents: invoice.lateFeeCents === null ? null : Number(invoice.lateFeeCents),
      exchangeRate: invoice.exchangeRate,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
      notes: invoice.notes
    },
    client,
    business: {
      name: instance?.businessName ?? null,
      email: instance?.businessEmail ?? null,
      phone: instance?.businessPhone ?? null,
      website: instance?.businessWebsite ?? null,
      taxId: instance?.businessTaxId ?? null,
      addressLine1: instance?.businessAddressLine1 ?? null,
      addressLine2: instance?.businessAddressLine2 ?? null,
      city: instance?.businessCity ?? null,
      state: instance?.businessState ?? null,
      postalCode: instance?.businessPostalCode ?? null,
      country: instance?.businessCountry ?? null
    },
    // `paymentIban` is an `encryptedColumn`, so it arrives decrypted from the driver and is handed to
    // a pure service as a plain string. It reaches a PDF the client is meant to pay from, which is the
    // whole point of storing it — but it must never reach a log line (`security.md`). The email
    // whitelist omits the payment group, so it cannot surface in a message body either.
    payment: {
      iban: instance?.paymentIban ?? null,
      bankName: instance?.paymentBankName ?? null,
      instructions: instance?.paymentInstructions ?? null,
      termsDays: instance?.paymentTermsDays ?? null
    },
    lineItems: items,
    statusLabel: getInvoiceStatusLabel(invoice.status),
    locale
  })

  return {
    renderData,
    number: invoice.number,
    currency: invoice.currency,
    locale,
    dueDate: invoice.dueDate,
    publicToken: invoice.publicToken,
    outstandingCents: totalCents - amountPaidCents,
    businessName: instance?.businessName ?? "Remit",
    templateId: invoice.templateId,
    // The envelope address only. `renderData` still names the client, because the document is issued
    // to the company; where it is delivered is a separate question, answered by the client's primary
    // contact when it has one and by `clients.email` otherwise (ADR-0027).
    recipientEmail: recipient?.email ?? null,
    recipientName: recipient?.name ?? ""
  }
}

async function getInvoiceClient(clientId: string | null): Promise<InvoiceRenderClient | null> {
  if (!clientId) return null

  const client = await database.query.clients.findFirst({
    where: and(eq(clients.id, clientId), isNull(clients.deletedAt))
  })

  if (!client) return null

  return {
    name: client.name,
    email: client.email,
    phone: client.phone,
    website: client.website,
    taxId: client.taxId,
    addressLine1: client.addressLine1,
    addressLine2: client.addressLine2,
    city: client.city,
    state: client.state,
    postalCode: client.postalCode,
    country: client.country,
    currency: client.currency
  }
}

// The client is reached either directly or through the invoice's project, in the same either-or
// shape `chk_invoices_parent` allows.
async function getProjectClientId(projectId: string | null): Promise<string | null> {
  if (!projectId) return null

  const project = await database.query.projects.findFirst({
    columns: { clientId: true },
    where: eq(projects.id, projectId)
  })

  return project?.clientId ?? null
}

async function getInvoiceLineItems(invoiceId: string): Promise<InvoiceRenderLineItem[]> {
  const rows = await database
    .select()
    .from(lineItems)
    .where(and(eq(lineItems.invoiceId, invoiceId), isNull(lineItems.deletedAt)))
    .orderBy(asc(lineItems.position))

  return rows.map((row) => ({
    description: row.description,
    unit: row.unit,
    quantity: row.quantity,
    unitPriceCents: Number(row.unitPriceCents),
    discountType: row.discountType,
    discountPercentage: row.discountPercentage,
    discountAmountCents: row.discountAmountCents === null ? null : Number(row.discountAmountCents),
    taxPercentageSnapshot: row.taxPercentageSnapshot,
    subtotalCents: Number(row.subtotalCents),
    taxAmountCents: Number(row.taxAmountCents),
    totalCents: Number(row.totalCents)
  }))
}

function getInvoiceStatusLabel(status: InvoiceStatus): string {
  switch (status) {
    case "draft":
      return t("invoices.status.draft")
    case "sent":
      return t("invoices.status.sent")
    case "paid":
      return t("invoices.status.paid")
  }
}
