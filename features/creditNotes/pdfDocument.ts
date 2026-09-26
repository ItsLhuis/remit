import { and, asc, eq, isNull } from "drizzle-orm"

import { inlineStorageAssets } from "@/lib/pdf"

import { database } from "@/database"
import { clients, creditNotes, invoices, lineItems, projects } from "@/database/schema"

import {
  buildDocumentShell,
  getPageHeight,
  renderTemplate,
  type DocumentShell
} from "@/features/templates"
import { resolveDocumentLayout, resolveTemplateAssets } from "@/features/templates/server"

import {
  buildCreditNoteRenderData,
  type CreditNoteRenderClient,
  type CreditNoteRenderLineItem
} from "./services"

// Turns a stored credit note into the HTML the PDF worker prints, mirroring
// `features/invoices/pdfDocument.ts`. Server-only (ADR-0007).
//
// A credit note carries no `template_id` of its own, so the instance default for the type is its
// layout, and the built-in one when there is none (`resolveDocumentLayout`) — there is no
// per-document override to fall back from. It also has no client
// of its own: the counterparty is whoever the credited invoice was addressed to, which is why the
// lookup goes through `invoices` rather than reading a column here.

export async function buildCreditNotePdfDocument(
  creditNoteId: string
): Promise<DocumentShell | null> {
  const creditNote = await database.query.creditNotes.findFirst({
    where: and(eq(creditNotes.id, creditNoteId), isNull(creditNotes.deletedAt))
  })

  if (!creditNote) return null

  const [instance, credited, items] = await Promise.all([
    database.query.settings.findFirst(),
    getCreditedInvoice(creditNote.invoiceId),
    getCreditNoteLineItems(creditNoteId)
  ])

  const locale = instance?.defaultLocale ?? "en"

  const renderData = buildCreditNoteRenderData({
    creditNote: {
      number: creditNote.number,
      reason: creditNote.reason,
      currency: creditNote.currency,
      subtotalCents: Number(creditNote.subtotalCents),
      taxAmountCents: Number(creditNote.taxAmountCents),
      totalCents: Number(creditNote.totalCents),
      issuedAt: creditNote.issuedAt,
      invoiceNumber: credited.number
    },
    client: credited.client,
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
    // Decrypted by the driver on read (`encryptedColumn`) and handed to a pure service as plain
    // text. On a credit note it is where a refund is sent, which is why the type whitelists it.
    payment: {
      iban: instance?.paymentIban ?? null,
      bankName: instance?.paymentBankName ?? null,
      instructions: instance?.paymentInstructions ?? null,
      termsDays: instance?.paymentTermsDays ?? null
    },
    lineItems: items,
    locale
  })

  const layout = await resolveDocumentLayout({
    type: "credit_note",
    templateId: null,
    renderData,
    omit: []
  })
  // Inlined as `data:` URIs, not left as storage paths: `lib/pdf/renderPdf.ts` aborts every request
  // that is not a data URI, so a path here renders as a missing image rather than a logo.
  const assets = await inlineStorageAssets(await resolveTemplateAssets(layout.blocks))

  const html = renderTemplate({
    blocks: layout.blocks,
    renderData,
    type: "credit_note",
    format: "html",
    pageSettings: layout.pageSettings,
    assets
  })

  return buildDocumentShell({
    body: html,
    type: "credit_note",
    heightPx: getPageHeight(layout.blocks, "credit_note", layout.pageSettings)
  })
}

// The credited invoice's number, which the credit note must name, and its client — the note has no
// client of its own — reached in the same either-or shape `chk_invoices_parent` allows there. The
// invoice is read even when soft-deleted: a credit note already issued still corrects it.
async function getCreditedInvoice(
  invoiceId: string
): Promise<{ number: string; client: CreditNoteRenderClient | null }> {
  const invoice = await database.query.invoices.findFirst({
    columns: { number: true, clientId: true, projectId: true },
    where: eq(invoices.id, invoiceId)
  })

  if (!invoice) return { number: "", client: null }

  return { number: invoice.number, client: await getInvoiceClient(invoice) }
}

async function getInvoiceClient(invoice: {
  clientId: string | null
  projectId: string | null
}): Promise<CreditNoteRenderClient | null> {
  const clientId = invoice.clientId ?? (await getProjectClientId(invoice.projectId))

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

async function getProjectClientId(projectId: string | null): Promise<string | null> {
  if (!projectId) return null

  const project = await database.query.projects.findFirst({
    columns: { clientId: true },
    where: eq(projects.id, projectId)
  })

  return project?.clientId ?? null
}

async function getCreditNoteLineItems(creditNoteId: string): Promise<CreditNoteRenderLineItem[]> {
  const rows = await database
    .select()
    .from(lineItems)
    .where(and(eq(lineItems.creditNoteId, creditNoteId), isNull(lineItems.deletedAt)))
    .orderBy(asc(lineItems.position))

  return rows.map((row) => ({
    description: row.description,
    unit: row.unit,
    quantity: row.quantity,
    unitPriceCents: Number(row.unitPriceCents),
    taxPercentageSnapshot: row.taxPercentageSnapshot,
    subtotalCents: Number(row.subtotalCents),
    taxAmountCents: Number(row.taxAmountCents),
    totalCents: Number(row.totalCents)
  }))
}
