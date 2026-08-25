import { and, eq } from "drizzle-orm"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getStorageObjectBytes } from "@/lib/storage/s3"

import { database } from "@/database"
import { auditLogs, emailLogs, uploads } from "@/database/schema"

import { isEmailConfigured } from "./services/isEmailConfigured"
import { sendTransactionalEmail, type EmailAttachment } from "./transactional"

// The one place a document email is composed and sent. Each feature's email job assembles the facts
// — recipient, merge data, which template type, which stored PDF — and hands them here; nothing in
// this file imports a feature, which is what keeps `features/invoices/jobs.ts` importing
// `@/features/email/server` from becoming an import cycle.
//
// Three guarantees live here rather than in the callers, because a caller that got any of them wrong
// would be wrong quietly:
//
// 1. `email_logs.pdf_attached` records what was actually attached, never what was intended. The flag
//    is written from the attachment that survived loading, after the provider accepted the message.
// 2. A retry sends nothing twice. The durable guard is an `audit_log` entry keyed on the document and
//    the occasion; the provider idempotency key is the second line, for a send that timed out after
//    the provider had already accepted it.
// This module imports nothing from `features/templates` on purpose. `lib/auth` sends mail and so
// reaches `features/email`; an import back into templates would close the loop
// email → templates → components → lib/auth → email. The subject and body arrive already rendered,
// from `features/templates`' own `renderEmailTemplate`.

export type DocumentEmailAttachment = {
  filename: string
  storageKey: string
}

export type DocumentEmailInput = {
  documentType: "invoice" | "proposal" | "contract"
  documentId: string
  recipientEmail: string
  recipientName: string
  // The occasion the mail is sent for, and half of the idempotency key. Two different mails about
  // the same invoice — the send and the receipt — must not collapse onto each other.
  occasion: string
  // Already rendered by `renderEmailTemplate`, template or fallback resolved.
  subject: string
  text: string
  html: string | null
  attachment: DocumentEmailAttachment | null
}

export type DocumentEmailResult = "sent" | "skipped" | "already_sent"

export async function sendDocumentEmail(input: DocumentEmailInput): Promise<DocumentEmailResult> {
  const settings = await database.query.settings.findFirst()

  // An instance with no mail provider would otherwise burn five retries on `not_configured`, and the
  // freelancer has no way to see why.
  if (!settings || !isEmailConfigured(settings)) return "skipped"

  if (await hasAlreadySent(input)) return "already_sent"

  const attachment = await loadAttachment(input)

  const [log] = await database
    .insert(emailLogs)
    .values({
      documentType: input.documentType,
      documentId: input.documentId,
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      subject: input.subject,
      status: "pending"
    })
    .returning({ id: emailLogs.id })

  let providerMessageId: string | null = null

  try {
    providerMessageId = await sendTransactionalEmail({
      to: input.recipientEmail,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
      ...(attachment ? { attachments: [attachment] } : {}),
      idempotencyKey: toIdempotencyKey(input)
    })
  } catch (error) {
    logger.error(
      {
        action: "sendDocumentEmail",
        documentType: input.documentType,
        documentId: input.documentId,
        occasion: input.occasion,
        err: error
      },
      "Document email delivery failed"
    )

    if (log) {
      await database
        .update(emailLogs)
        .set({ status: "failed", errorMessage: toDeliveryErrorMessage(error) })
        .where(eq(emailLogs.id, log.id))
    }

    throw error
  }

  // `pdfAttached` is written here and nowhere earlier: at this point the provider has accepted a
  // message that carried these exact bytes. Setting it when the attachment was merely requested
  // would make the column lie about any send whose object could not be read.
  if (log) {
    await database
      .update(emailLogs)
      .set({
        status: "sent",
        sentAt: new Date(),
        pdfAttached: attachment !== null,
        providerMessageId
      })
      .where(eq(emailLogs.id, log.id))
  }

  await writeAudit(toAuditEvent(input), {
    actorUserId: null,
    targetEntityType: input.documentType,
    targetEntityId: input.documentId,
    metadata: { occasion: input.occasion, pdfAttached: attachment !== null },
    ipAddress: null,
    userAgent: null
  })

  return "sent"
}

// The audit trail is the dedupe key rather than a column on the document, the same choice
// `features/invoices/jobs.ts` makes for overdue announcements: `audit_log` is insert-only and
// survives a restart, so "have we already mailed this" is a question it can answer without adding
// state that nothing else would read. A BullMQ job id cannot do it — it is freed on completion.
async function hasAlreadySent(input: DocumentEmailInput): Promise<boolean> {
  const rows = await database
    .select({ metadata: auditLogs.metadata })
    .from(auditLogs)
    .where(
      and(eq(auditLogs.event, toAuditEvent(input)), eq(auditLogs.targetEntityId, input.documentId))
    )

  return rows.some((row) => toOccasion(row.metadata) === input.occasion)
}

function toOccasion(metadata: unknown): string | null {
  if (typeof metadata !== "object" || metadata === null || !("occasion" in metadata)) return null

  const occasion = (metadata as { occasion: unknown }).occasion

  return typeof occasion === "string" ? occasion : null
}

function toAuditEvent(input: DocumentEmailInput): string {
  return `${input.documentType}.email_sent`
}

// Derived from the document and the occasion, never from the attempt: a retry has to produce the
// same key or the provider-side guard is worthless.
function toIdempotencyKey(input: DocumentEmailInput): string {
  return `${input.documentType}.${input.documentId}.${input.occasion}`
}

// A stored PDF that cannot be read is sent without an attachment rather than not sent at all: the
// client is better served by an invoice email with a link than by silence. `pdf_attached` records
// what actually happened, so the gap is visible rather than papered over.
async function loadAttachment(input: DocumentEmailInput): Promise<EmailAttachment | null> {
  if (!input.attachment) return null

  const upload = await database.query.uploads.findFirst({
    columns: { bucket: true },
    where: eq(uploads.path, input.attachment.storageKey)
  })

  try {
    const content = await getStorageObjectBytes(
      input.attachment.storageKey,
      upload?.bucket === "documents" ? "documents" : "public"
    )

    return { filename: input.attachment.filename, content, contentType: "application/pdf" }
  } catch (error) {
    logger.error(
      {
        action: "sendDocumentEmail",
        documentType: input.documentType,
        documentId: input.documentId,
        err: error
      },
      "Document email attachment could not be read"
    )

    return null
  }
}

// The provider's own message, never the recipient address or a storage key.
function toDeliveryErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown"
}
