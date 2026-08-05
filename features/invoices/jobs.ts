import { and, eq, gte, inArray, isNull, lt, lte, ne, or } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { formatCurrency, formatDay } from "@/lib/utils"

import { env } from "@/lib/config/env"
import { enqueueJob, registerJobHandler } from "@/lib/jobs"

import { database } from "@/database"
import { auditLogs, clients, emailLogs, invoices, projects } from "@/database/schema"

import { isEmailConfigured, sendTransactionalEmail } from "@/features/email/server"

import { emitInvoiceOverdue, emitInvoiceReminderSent } from "./events"
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
      { jobId: `invoice.reminder.send:${invoice.id}:${reminder.phase}:${reminder.offsetDays}` }
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

  const subject = renderReminderSubject(target, payload)
  const text = renderReminderBody(target, payload, instance)

  const [log] = await database
    .insert(emailLogs)
    .values({
      documentType: "invoice",
      documentId: target.id,
      recipientEmail: target.recipientEmail,
      recipientName: target.recipientName,
      subject,
      status: "pending"
    })
    .returning({ id: emailLogs.id })

  try {
    await sendTransactionalEmail({
      to: target.recipientEmail,
      subject,
      text,
      // The provider-side guard that pairs with the database claim above: a retry after a timeout
      // that actually delivered will not send a second copy.
      idempotencyKey: `invoice-reminder:${target.id}:${payload.phase}:${payload.offsetDays}`
    })
  } catch (error) {
    logger.error(
      { action: "sendInvoiceReminder", invoiceId: target.id, err: error },
      "Invoice reminder delivery failed"
    )

    if (log) {
      await database
        .update(emailLogs)
        .set({ status: "failed", errorMessage: toDeliveryErrorMessage(error) })
        .where(eq(emailLogs.id, log.id))
    }

    throw error
  }

  if (log) {
    await database
      .update(emailLogs)
      .set({ status: "sent", sentAt: new Date() })
      .where(eq(emailLogs.id, log.id))
  }

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

// The recipient lives on the client, reached either directly or through the invoice's project, in the
// same either-or shape `chk_invoices_parent` allows. An invoice whose client has no email address
// yields nothing, and the caller skips it rather than failing.
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
      directEmail: clients.email,
      directName: clients.name,
      projectClientId: projects.clientId
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .leftJoin(projects, eq(invoices.projectId, projects.id))
    .where(eq(invoices.id, invoiceId))
    .limit(1)

  if (row?.dueDate == null) return null

  const recipient = row.directEmail
    ? { email: row.directEmail, name: row.directName ?? "" }
    : await getProjectClientRecipient(row.projectClientId)

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

async function getProjectClientRecipient(
  clientId: string | null
): Promise<{ email: string; name: string } | null> {
  if (!clientId) return null

  const row = await database.query.clients.findFirst({
    columns: { email: true, name: true },
    where: and(eq(clients.id, clientId), isNull(clients.deletedAt))
  })

  return row?.email ? { email: row.email, name: row.name } : null
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

// The provider's own message, never the recipient address or the token in the link.
function toDeliveryErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown"
}

function toUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

function addUtcDays(value: Date, days: number): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() + days))
}
