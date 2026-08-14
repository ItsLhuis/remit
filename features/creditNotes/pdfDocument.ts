import { and, asc, eq, isNull } from "drizzle-orm"

import { inlineStorageAssets } from "@/lib/pdf"

import { database } from "@/database"
import { clients, creditNotes, invoices, lineItems, projects, templates } from "@/database/schema"

import {
  buildDocumentShell,
  getPageHeight,
  renderTemplate,
  type DocumentShell
} from "@/features/templates"
import { resolveTemplateAssets, toTemplateEditorData } from "@/features/templates/server"

import {
  buildCreditNoteRenderData,
  type CreditNoteRenderClient,
  type CreditNoteRenderLineItem
} from "./services"

// Turns a stored credit note into the HTML the PDF worker prints, mirroring
// `features/invoices/pdfDocument.ts`. Server-only (ADR-0007).
//
// A credit note carries no `template_id` of its own, so the instance default for the type is the
// only source of layout — there is no per-document override to fall back from. It also has no client
// of its own: the counterparty is whoever the credited invoice was addressed to, which is why the
// lookup goes through `invoices` rather than reading a column here.

export async function buildCreditNotePdfDocument(
  creditNoteId: string
): Promise<DocumentShell | null> {
  const creditNote = await database.query.creditNotes.findFirst({
    where: and(eq(creditNotes.id, creditNoteId), isNull(creditNotes.deletedAt))
  })

  if (!creditNote) return null

  const [instance, client, items, template] = await Promise.all([
    database.query.settings.findFirst(),
    getCreditNoteClient(creditNote.invoiceId),
    getCreditNoteLineItems(creditNoteId),
    getDefaultCreditNoteTemplate()
  ])

  if (!template) return null

  const editorData = toTemplateEditorData(template)
  // Inlined as `data:` URIs, not left as storage paths: `lib/pdf/renderPdf.ts` aborts every request
  // that is not a data URI, so a path here renders as a missing image rather than a logo.
  const assets = await inlineStorageAssets(await resolveTemplateAssets(editorData.blocks))
  const locale = instance?.defaultLocale ?? "en"

  const html = renderTemplate({
    blocks: editorData.blocks,
    renderData: buildCreditNoteRenderData({
      creditNote: {
        number: creditNote.number,
        reason: creditNote.reason,
        currency: creditNote.currency,
        subtotalCents: Number(creditNote.subtotalCents),
        taxAmountCents: Number(creditNote.taxAmountCents),
        totalCents: Number(creditNote.totalCents),
        issuedAt: creditNote.issuedAt
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
    }),
    type: "credit_note",
    format: "html",
    pageSettings: editorData.pageSettings,
    assets
  })

  return buildDocumentShell({
    body: html,
    type: "credit_note",
    heightPx: getPageHeight(editorData.blocks, "credit_note", editorData.pageSettings)
  })
}

// Through the credited invoice, in the same either-or shape `chk_invoices_parent` allows there.
async function getCreditNoteClient(invoiceId: string): Promise<CreditNoteRenderClient | null> {
  const invoice = await database.query.invoices.findFirst({
    columns: { clientId: true, projectId: true },
    where: eq(invoices.id, invoiceId)
  })

  if (!invoice) return null

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

async function getDefaultCreditNoteTemplate() {
  return await database.query.templates.findFirst({
    where: and(
      eq(templates.type, "credit_note"),
      eq(templates.isDefault, true),
      isNull(templates.deletedAt)
    )
  })
}
