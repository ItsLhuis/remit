import { inlineStorageAssets } from "@/lib/pdf"

import {
  buildDocumentShell,
  getPageHeight,
  renderTemplate,
  type DocumentShell
} from "@/features/templates"
import { resolveDocumentLayout, resolveTemplateAssets } from "@/features/templates/server"

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
// template it points at, or the built-in layout when there is none (`resolveDocumentLayout`). That is
// exactly why the *rendered PDF* is the snapshot: once this has run and the bytes are stored, a later
// template edit cannot reach the invoice the client was sent (see `pdf_upload_id` in
// `database/schema/invoices.ts`) — unless a late fee changes its total, which supersedes the stored
// PDF on purpose (`lateFees.ts`).

export async function buildInvoicePdfDocument(invoiceId: string): Promise<DocumentShell | null> {
  const document = await buildInvoiceDocumentData(invoiceId)

  if (!document) return null

  const layout = await resolveDocumentLayout({
    type: "invoice",
    templateId: document.templateId,
    renderData: document.renderData,
    omit: document.zeroFigures
  })
  // Inlined as `data:` URIs, not left as storage paths: `lib/pdf/renderPdf.ts` aborts every request
  // that is not a data URI, so a path here renders as a missing image rather than a logo.
  const assets = await inlineStorageAssets(await resolveTemplateAssets(layout.blocks))

  const html = renderTemplate({
    blocks: layout.blocks,
    renderData: document.renderData,
    type: "invoice",
    format: "html",
    pageSettings: layout.pageSettings,
    assets
  })

  return buildDocumentShell({
    body: html,
    type: "invoice",
    heightPx: getPageHeight(layout.blocks, "invoice", layout.pageSettings)
  })
}
