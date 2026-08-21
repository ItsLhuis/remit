import { and, eq, gte, inArray, isNull, lt, lte, ne, or } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { formatCurrency, formatDay } from "@/lib/utils"

import { env } from "@/lib/config/env"
import { enqueueJob, registerJobHandler } from "@/lib/jobs"

import { database } from "@/database"
import { auditLogs, invoices, projects, uploads } from "@/database/schema"

import { getClientDocumentRecipient } from "@/features/clients/server"

import { isEmailConfigured, sendDocumentEmail } from "@/features/email/server"

import { renderEmailTemplate } from "@/features/templates/server"

import { buildInvoiceDocumentData } from "./documentData"
import { sendInvoiceEmail } from "./emailJob"
import { emitInvoiceOverdue, emitInvoiceReminderSent } from "./events"
import { renderInvoicePdf } from "./pdfRenderJob"
import {
  getReminderWindowDays,
  isInvoiceOverdue,
  resolveDueReminder,
  type ReminderSchedule
} from "./services"

const MILLISECONDS_PER_DAY = 86_400_000

// The invoice module's half of the scheduled work (ADR-0023). Handlers register at module load, the
// way `features/*/events.ts` register bus subscribers, and `scripts/worker.ts` is what imports this
// file — nothing under `lib/` reaches into a feature.
registerJobHandler("invoice.pdf.render", renderInvoicePdf)
registerJobHandler("invoice.email.send", sendInvoiceEmail)
registerJobHandler("invoice.overdue.sweep", runOverdueSweep)
registerJobHandler("invoice.reminder.sweep", runReminderSweep)
registerJobHandler("invoice.reminder.send", sendInvoiceReminder)

type OverdueCandidate = {
  id: string
  clientId: string | null
  dueDate: Date
}

// `overdue` is never written to `invoices.status` — the stored enum has three values and this job
// must not add a fourth (SCHEMA.md, enum reference). It only announces the crossing, which the
// dashboard and reporting surfaces subscribe to; every read model still derives the badge itself
// through `isInvoiceOverdue`.
async function runOverdueSweep(): Promise<void> {
  const now = new Date()

  const candidates = await database
    .select({ id: invoices.id, clientId: invoices.clientId, dueDate: invoices.dueDate })
    .from(invoices)
    .where(
      and(
        ne(invoices.status, "draft"),
        isNull(invoices.paidAt),
        lt(invoices.dueDate, toUtcDay(now)),
        isNull(invoices.deletedAt)
      )
    )

  const overdue = candidates.flatMap((row) =>
    row.dueDate !== null &&
    isInvoiceOverdue({ status: "sent", dueDate: row.dueDate, paidAt: null }, now)
      ? [{ id: row.id, clientId: row.clientId, dueDate: row.dueDate }]
      : []
  )

  if (overdue.length === 0) return

  const alreadyAnnounced = await getAlreadyAnnouncedOverdue(overdue.map((row) => row.id))

  for (const row of overdue) {
    if (alreadyAnnounced.has(row.id)) continue

    await announceOverdue(row, now)
  }
}

// The dedupe key is the audit trail itself rather than a column on the invoice. `audit_log` is
// insert-only and survives a restart, so "have we already said this invoice went late" is a question
// it can answer without adding state to `invoices` that nothing else would read.
async function getAlreadyAnnouncedOverdue(invoiceIds: string[]): Promise<Set<string>> {
  const rows = await database
    .select({ targetEntityId: auditLogs.targetEntityId })
    .from(auditLogs)
    .where(
      and(eq(auditLogs.event, "invoice.overdue"), inArray(auditLogs.targetEntityId, invoiceIds))
    )

  return new Set(rows.flatMap((row) => (row.targetEntityId === null ? [] : [row.targetEntityId])))
}

async function announceOverdue(row: OverdueCandidate, now: Date): Promise<void> {
  const daysOverdue = Math.floor(
    (toUtcDay(now).getTime() - toUtcDay(row.dueDate).getTime()) / MILLISECONDS_PER_DAY
  )

  // Audit first, emit second: the audit row is what stops the next sweep announcing this invoice
  // again, so a crash between the two costs a missed subscriber rather than a duplicate every night.
  await writeAudit("invoice.overdue", {
    actorUserId: null,
    targetEntityType: "invoice",
    targetEntityId: row.id,
    metadata: { clientId: row.clientId, daysOverdue },
    ipAddress: null,
    userAgent: null
  })

  await emitInvoiceOverdue({ invoiceId: row.id, clientId: row.clientId, daysOverdue })
}

// Selection only. The send is a separate per-invoice job so a mail provider failure retries that one
// invoice with backoff rather than the whole sweep, and so the deterministic job id can collapse a
// sweep repeated inside one day onto the dispatch already queued.
async function runReminderSweep(): Promise<void> {
  const now = new Date()
  const schedule = await getReminderSchedule()

  if (!schedule) return

  const windowDays = getReminderWindowDays(schedule)

  if (windowDays === null) return

  const candidates = await database
    .select({ id: invoices.id, dueDate: invoices.dueDate })
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "sent"),
        isNull(invoices.paidAt),
        isNull(invoices.deletedAt),
        gte(invoices.dueDate, addUtcDays(now, -windowDays)),
        lte(invoices.dueDate, addUtcDays(now, windowDays))
      )
    )

  for (const invoice of candidates) {
    if (invoice.dueDate === null) continue

    const reminder = resolveDueReminder(invoice.dueDate, schedule, now)

    if (!reminder) continue

    await enqueueJob(
      "invoice.reminder.send",
      { invoiceId: invoice.id, offsetDays: reminder.offsetDays, phase: reminder.phase },
      { jobId: `invoice.reminder.send.${invoice.id}.${reminder.phase}.${reminder.offsetDays}` }
    )
  }
}

type ReminderTarget = {
  id: string
  number: string
  totalCents: number
  amountPaidCents: number
  currency: string
  dueDate: Date
  publicToken: string
  recipientEmail: string
  recipientName: string
}

async function sendInvoiceReminder(payload: {
  invoiceId: string
  offsetDays: number
  phase: "before" | "after"
}): Promise<void> {
  const instance = await getInstanceSettings()

  // A job on an instance with no mail provider would otherwise burn its five retries on
  // `not_configured` every night, and the freelancer has no way to see why.
  if (!instance || !isEmailConfigured(instance)) return

  // The claim is the idempotency guard, and it is a conditional UPDATE rather than a read followed by
  // a write: two workers racing the same job both read "not sent yet", but only one row comes back
  // from this statement. Day granularity is enough because the offsets are whole days, so an invoice
  // is owed at most one reminder per day whichever offset matched.
  const claimed = await claimReminder(payload.invoiceId)

  if (!claimed) return

  const target = await getReminderTarget(payload.invoiceId)

  // No recipient is not a failure to retry — the client simply has no email on file. Releasing the
  // claim would make the next sweep try again forever, so it stays claimed and the run is logged.
  if (!target) {
    logger.warn(
      { action: "sendInvoiceReminder", invoiceId: payload.invoiceId },
      "Invoice reminder skipped: no recipient email"
    )

    return
  }

  // Rendered through the instance's `email_overdue_reminder` template, with the hand-rolled text
  // below as the fallback. Before this stage the reminder ignored the template entirely, which meant
  // an operator could design one and never see it used.
  const document = await buildInvoiceDocumentData(target.id)

  if (!document) return

  const body = await renderEmailTemplate({
    templateType: "email_overdue_reminder",
    renderData: document.renderData,
    fallbackSubject: renderReminderSubject(target, payload),
    fallbackText: renderReminderBody(target, payload, instance)
  })

  await sendDocumentEmail({
    documentType: "invoice",
    documentId: target.id,
    recipientEmail: target.recipientEmail,
    recipientName: target.recipientName,
    // The offset and phase are part of the occasion, so a "3 days before" and a "7 days after"
    // reminder about the same invoice are two different mails rather than one deduplicated away.
    occasion: `reminder.${payload.phase}.${payload.offsetDays}`,
    subject: body.subject,
    text: body.text,
    html: body.html,
    attachment: await getInvoicePdfAttachment(target.id)
  })

  await writeAudit("invoice.reminder_sent", {
    actorUserId: null,
    targetEntityType: "invoice",
    targetEntityId: target.id,
    metadata: { offsetDays: payload.offsetDays, phase: payload.phase },
    ipAddress: null,
    userAgent: null
  })

  await emitInvoiceReminderSent({
    invoiceId: target.id,
    offsetDays: payload.offsetDays,
    phase: payload.phase
  })
}

// The stored invoice PDF, when there is one. A reminder about an invoice whose render failed still
// goes out — chasing payment matters more than the attachment — and `email_logs.pdf_attached`
// records which of the two happened.
async function getInvoicePdfAttachment(invoiceId: string) {
  const [row] = await database
    .select({ filename: uploads.filename, storageKey: uploads.path })
    .from(invoices)
    .innerJoin(uploads, eq(invoices.pdfUploadId, uploads.id))
    .where(and(eq(invoices.id, invoiceId), isNull(invoices.deletedAt)))
    .limit(1)

  return row ?? null
}

async function claimReminder(invoiceId: string): Promise<boolean> {
  const startOfToday = toUtcDay(new Date())

  const [claimed] = await database
    .update(invoices)
    .set({ lastReminderSentAt: new Date() })
    .where(
      and(
        eq(invoices.id, invoiceId),
        isNull(invoices.paidAt),
        isNull(invoices.deletedAt),
        or(isNull(invoices.lastReminderSentAt), lt(invoices.lastReminderSentAt, startOfToday))
      )
    )
    .returning({ id: invoices.id })

  return Boolean(claimed)
}

type InstanceSettings = {
  businessName: string | null
  emailProvider: string | null
  smtpHost: string | null
  smtpPort: number | null
  smtpUser: string | null
  smtpPass: string | null
  resendApiKey: string | null
  emailFromAddress: string | null
  defaultLocale: string | null
}

async function getInstanceSettings(): Promise<InstanceSettings | null> {
  return (
    (await database.query.settings.findFirst({
      columns: {
        businessName: true,
        emailProvider: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        smtpPass: true,
        resendApiKey: true,
        emailFromAddress: true,
        defaultLocale: true
      }
    })) ?? null
  )
}

async function getReminderSchedule(): Promise<ReminderSchedule | null> {
  const row = await database.query.settings.findFirst({
    columns: { reminderBeforeDueDays: true, reminderAfterDueDays: true }
  })

  if (!row) return null

  return { beforeDueDays: row.reminderBeforeDueDays, afterDueDays: row.reminderAfterDueDays }
}

// The client is reached either directly or through the invoice's project, in the same either-or
// shape `chk_invoices_parent` allows, and the address is then resolved the way every other send
// path resolves it (ADR-0027): the primary contact when there is one, `clients.email` otherwise. An
// invoice whose client is gone yields nothing, and the caller skips it rather than failing.
async function getReminderTarget(invoiceId: string): Promise<ReminderTarget | null> {
  const [row] = await database
    .select({
      id: invoices.id,
      number: invoices.number,
      totalCents: invoices.totalCents,
      amountPaidCents: invoices.amountPaidCents,
      currency: invoices.currency,
      dueDate: invoices.dueDate,
      publicToken: invoices.publicToken,
      directClientId: invoices.clientId,
      projectClientId: projects.clientId
    })
    .from(invoices)
    .leftJoin(projects, eq(invoices.projectId, projects.id))
    .where(eq(invoices.id, invoiceId))
    .limit(1)

  if (row?.dueDate == null) return null

  const recipient = await getClientDocumentRecipient(row.directClientId ?? row.projectClientId)

  if (!recipient) return null

  return {
    id: row.id,
    number: row.number,
    totalCents: Number(row.totalCents),
    amountPaidCents: Number(row.amountPaidCents),
    currency: row.currency,
    dueDate: row.dueDate,
    publicToken: row.publicToken,
    recipientEmail: recipient.email,
    recipientName: recipient.name
  }
}

function renderReminderSubject(
  target: ReminderTarget,
  payload: { offsetDays: number; phase: "before" | "after" }
): string {
  return payload.phase === "before"
    ? t("invoices.reminders.subjectBefore", { number: target.number, days: payload.offsetDays })
    : t("invoices.reminders.subjectAfter", { number: target.number, days: payload.offsetDays })
}

function renderReminderBody(
  target: ReminderTarget,
  payload: { phase: "before" | "after" },
  instance: InstanceSettings
): string {
  const locale = instance.defaultLocale ?? "en"

  const values = {
    clientName: target.recipientName,
    number: target.number,
    // What is still owed, not the face value: a partly paid invoice must not chase the full amount.
    amount: formatCurrency(target.totalCents - target.amountPaidCents, target.currency, locale),
    dueDate: formatDay(target.dueDate, locale),
    url: `${env.NEXT_PUBLIC_APP_URL}/i/${target.publicToken}`,
    businessName: instance.businessName ?? "Remit"
  }

  return payload.phase === "before"
    ? t("invoices.reminders.bodyBefore", values)
    : t("invoices.reminders.bodyAfter", values)
}

function toUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

function addUtcDays(value: Date, days: number): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() + days))
}
