import { and, eq, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { logger } from "@/lib/logger"

import { formatCurrency, formatDay } from "@/lib/utils"

import { env } from "@/lib/config/env"
import { type InvoiceEmailOccasion } from "@/lib/jobs"

import { database } from "@/database"
import { invoices, uploads } from "@/database/schema"

import { sendDocumentEmail } from "@/features/email/server"

import { renderEmailTemplate } from "@/features/templates/server"

import { buildInvoiceDocumentData } from "./documentData"

// The three occasions an invoice is mailed for, chained behind `invoice.pdf.render` so the PDF this
// attaches already exists (see the ordering note in `lib/jobs/types.ts`). All three share one
// handler because they differ only in template type and fallback copy — the recipient, the merge
// data and the attachment are the same invoice either way.
const TEMPLATE_TYPE_BY_OCCASION = {
  sent: "email_invoice_send",
  receipt: "email_payment_receipt",
  recurring_generated: "email_recurring_generated"
} as const

export async function sendInvoiceEmail(payload: {
  invoiceId: string
  occasion: InvoiceEmailOccasion
}): Promise<void> {
  const document = await buildInvoiceDocumentData(payload.invoiceId)

  // No recipient is not a failure to retry — the client simply has no email on file. Logging and
  // returning keeps it out of the retry loop.
  if (!document?.recipientEmail) {
    logger.warn(
      { action: "sendInvoiceEmail", invoiceId: payload.invoiceId, occasion: payload.occasion },
      "Invoice email skipped: no recipient"
    )

    return
  }

  // A revoked public link leaves the mail with nowhere to point, and minting a replacement here
  // would silently undo the withdrawal the owner asked for. Skipping is the only honest outcome, and
  // it is not a failure to retry either (ADR-0029).
  if (!document.publicToken) {
    logger.warn(
      { action: "sendInvoiceEmail", invoiceId: payload.invoiceId, occasion: payload.occasion },
      "Invoice email skipped: public link revoked"
    )

    return
  }

  const publicUrl = `${env.NEXT_PUBLIC_APP_URL}/i/${document.publicToken}`

  const [attachment, body] = await Promise.all([
    getInvoicePdfAttachment(payload.invoiceId),
    renderEmailTemplate({
      templateType: TEMPLATE_TYPE_BY_OCCASION[payload.occasion],
      renderData: document.renderData,
      fallbackSubject: getFallbackSubject(payload.occasion, document),
      fallbackText: getFallbackText(payload.occasion, document, publicUrl)
    })
  ])

  await sendDocumentEmail({
    documentType: "invoice",
    documentId: payload.invoiceId,
    recipientEmail: document.recipientEmail,
    recipientName: document.recipientName,
    occasion: payload.occasion,
    subject: body.subject,
    text: body.text,
    html: body.html,
    attachment
  })
}

type InvoiceDocument = Awaited<ReturnType<typeof buildInvoiceDocumentData>>

type ResolvedInvoiceDocument = NonNullable<InvoiceDocument>

async function getInvoicePdfAttachment(invoiceId: string) {
  const [row] = await database
    .select({ filename: uploads.filename, storageKey: uploads.path })
    .from(invoices)
    .innerJoin(uploads, eq(invoices.pdfUploadId, uploads.id))
    .where(and(eq(invoices.id, invoiceId), isNull(invoices.deletedAt)))
    .limit(1)

  return row ?? null
}

function getFallbackSubject(
  occasion: InvoiceEmailOccasion,
  document: ResolvedInvoiceDocument
): string {
  const values = { number: document.number, businessName: document.businessName }

  if (occasion === "receipt") return t("documentEmails.paymentReceipt.subject", values)
  if (occasion === "recurring_generated") {
    return t("documentEmails.recurringGenerated.subject", values)
  }

  return t("documentEmails.invoiceSent.subject", values)
}

// The copy an instance with no template of the type falls back to. A freelancer who never opened the
// template editor must still be able to invoice, so this path is ordinary rather than exceptional.
function getFallbackText(
  occasion: InvoiceEmailOccasion,
  document: ResolvedInvoiceDocument,
  publicUrl: string
): string {
  const values = {
    clientName: document.recipientName,
    number: document.number,
    // What is still owed, not the face value: a partly paid invoice must not chase the full amount.
    amount: formatCurrency(document.outstandingCents, document.currency, document.locale),
    dueDate: document.dueDate ? formatDay(document.dueDate, document.locale) : "",
    url: publicUrl,
    businessName: document.businessName
  }

  if (occasion === "receipt") return t("documentEmails.paymentReceipt.body", values)
  if (occasion === "recurring_generated") {
    return t("documentEmails.recurringGenerated.body", values)
  }

  return t("documentEmails.invoiceSent.body", values)
}
