import { and, eq, isNull } from "drizzle-orm"

import { inlineStorageAssets } from "@/lib/pdf"

import { database } from "@/database"
import { templates } from "@/database/schema"

import {
  buildDocumentShell,
  getPageHeight,
  renderTemplate,
  type DocumentShell
} from "@/features/templates"
import { resolveTemplateAssets, toTemplateEditorData } from "@/features/templates/server"

import { buildInvoiceDocumentData } from "./documentData"

// Turns a stored invoice into the HTML the PDF worker prints, mirroring
// `features/contracts/publicDocument.ts` — the builder that already existed. Server-only: it reads
// the database and object storage, and hands a pure renderer everything it needs as arguments
// (ADR-0007).
//
// The merge data comes from `documentData.ts`, shared with the email job, so the message and the PDF
// it attaches cannot disagree about the same invoice.
//
// Unlike a contract, an invoice snapshots no blocks of its own, so the document is composed from the
// template it points at. That is exactly why the *rendered PDF* is the snapshot: once this has run
// and the bytes are stored, a later template edit cannot reach the invoice the client was sent (see
// `pdf_upload_id` in `database/schema/invoices.ts`).

export async function buildInvoicePdfDocument(invoiceId: string): Promise<DocumentShell | null> {
  const document = await buildInvoiceDocumentData(invoiceId)

  if (!document) return null

  const template = await getInvoiceTemplate(document.templateId)

  if (!template) return null

  const editorData = toTemplateEditorData(template)
  // Inlined as `data:` URIs, not left as storage paths: `lib/pdf/renderPdf.ts` aborts every request
  // that is not a data URI, so a path here renders as a missing image rather than a logo.
  const assets = await inlineStorageAssets(await resolveTemplateAssets(editorData.blocks))

  const html = renderTemplate({
    blocks: editorData.blocks,
    renderData: document.renderData,
    type: "invoice",
    format: "html",
    pageSettings: editorData.pageSettings,
    assets
  })

  return buildDocumentShell({
    body: html,
    type: "invoice",
    heightPx: getPageHeight(editorData.blocks, "invoice", editorData.pageSettings)
  })
}

// The invoice's own template, or the instance default for the type. An instance with neither has
// nothing to render, and the caller reports that rather than inventing a layout — a blank PDF on a
// money document is worse than an absent one.
async function getInvoiceTemplate(templateId: string | null) {
  if (templateId) {
    const template = await database.query.templates.findFirst({
      where: and(eq(templates.id, templateId), isNull(templates.deletedAt))
    })

    if (template) return template
  }

  return await database.query.templates.findFirst({
    where: and(
      eq(templates.type, "invoice"),
      eq(templates.isDefault, true),
      isNull(templates.deletedAt)
    )
  })
}
