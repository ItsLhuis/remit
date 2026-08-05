import { and, eq, isNull, sum } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { enqueueJob, registerJobHandler } from "@/lib/jobs"

import { database } from "@/database"
import { recurringInvoices, timeEntries } from "@/database/schema"

// Imported from `systemWrites` rather than the invoices server barrel on purpose: that barrel
// re-exports the feature's server actions, which drag `next/headers` into the worker bundle where it
// cannot resolve (see the boundary rule in eslint.config.mjs).
import { writeSystemInvoice, type InvoiceLineItemRow } from "@/features/invoices/systemWrites"

import { emitRecurringInvoiceGenerated, emitRetainerPoolExhausted } from "./events"
import { listDueRecurringInvoices } from "./queries"
import { recurringInvoiceBlueprintSchema, type RecurringInvoiceBlueprintLine } from "./schemas"
import {
  calculateRetainerUsage,
  computeNextRunDate,
  shouldGenerateInvoice,
  toConsumedHours,
  toRetainerTerms,
  type RetainerUsage
} from "./services"

registerJobHandler("recurring.schedule.sweep", runScheduleSweep)
registerJobHandler("recurring.invoice.generate", generateRecurringInvoice)

// Selection only: one job per due schedule, so a schedule whose generation fails retries on its own
// rather than taking the rest of the sweep down with it. The job id is keyed on the occurrence the
// sweep saw, which collapses a sweep repeated inside one period onto the generation already queued.
async function runScheduleSweep(): Promise<void> {
  const due = await listDueRecurringInvoices(new Date())

  for (const schedule of due) {
    const occurrenceKey = schedule.nextRunAt.toISOString().slice(0, 10)

    await enqueueJob(
      "recurring.invoice.generate",
      { recurringInvoiceId: schedule.id, occurrenceKey },
      { jobId: `recurring.invoice.generate:${schedule.id}:${occurrenceKey}` }
    )
  }
}

type GenerationOutcome = {
  invoiceId: string
  invoiceNumber: string
  totalCents: number
  occurrence: number
  clientId: string
  projectId: string | null
  retainer: RetainerUsage | null
}

// The money-affecting half, and the one place the exactly-once guarantee lives.
//
// Idempotency is `next_run_at` itself, not the job id: the whole run happens inside one transaction
// that locks the schedule row, re-derives due-ness from it, and advances the counters alongside the
// invoice insert. A retry after a crash re-reads a row whose `next_run_at` has already moved past
// this occurrence, `shouldGenerateInvoice` answers "not due", and nothing is written. A BullMQ job id
// would not survive the job being removed on completion; a database column does.
async function generateRecurringInvoice(payload: {
  recurringInvoiceId: string
  occurrenceKey: string
}): Promise<void> {
  const now = new Date()

  const outcome = await database.transaction(async (transaction) => {
    // `FOR UPDATE` rather than an optimistic re-read: two workers handed the same occurrence would
    // otherwise both pass the due-ness check before either advanced the row.
    const [schedule] = await transaction
      .select()
      .from(recurringInvoices)
      .where(
        and(
          eq(recurringInvoices.id, payload.recurringInvoiceId),
          isNull(recurringInvoices.deletedAt)
        )
      )
      .limit(1)
      .for("update")

    if (!schedule) return null

    const decision = shouldGenerateInvoice(schedule, now)

    if (decision.action === "skip") return null

    if (decision.action === "complete") {
      await transaction
        .update(recurringInvoices)
        .set({ status: "completed", updatedAt: now })
        .where(eq(recurringInvoices.id, schedule.id))

      return null
    }

    const blueprint = recurringInvoiceBlueprintSchema.safeParse(schedule.lineItemsBlueprint)

    // A schedule with nothing to bill is a configuration mistake, not a transient failure. Returning
    // rather than throwing keeps it out of the retry loop; the run is logged and `next_run_at` is
    // left untouched so fixing the blueprint makes the next sweep pick it up.
    if (!blueprint.success || blueprint.data.length === 0) {
      logger.error(
        { action: "generateRecurringInvoice", recurringInvoiceId: schedule.id },
        "Recurring invoice skipped: blueprint is empty or invalid"
      )

      return null
    }

    const retainer = await resolveRetainerUsage(transaction, schedule)
    const lineItems = [
      ...blueprint.data.map(toInvoiceLineItemRow),
      ...toOverageLineItems(retainer, schedule.overageRateCents)
    ]

    const invoice = await writeSystemInvoice({
      transaction,
      clientId: schedule.clientId,
      projectId: schedule.projectId,
      templateId: schedule.templateId,
      recurringInvoiceId: schedule.id,
      currency: schedule.currency,
      status: schedule.autoSend ? "sent" : "draft",
      notes: schedule.notes,
      lineItems,
      now
    })

    const occurrence = schedule.occurrencesGenerated + 1
    const nextRunAt = computeNextRunDate({
      cadence: schedule.cadence,
      cadenceDay: schedule.cadenceDay,
      lastRunAt: schedule.nextRunAt
    })

    // The end condition is re-evaluated against the state this run produces, so the schedule that
    // just generated its final occurrence closes here rather than surviving until the next sweep
    // notices.
    const after = shouldGenerateInvoice(
      { ...schedule, nextRunAt, occurrencesGenerated: occurrence },
      nextRunAt
    )

    await transaction
      .update(recurringInvoices)
      .set({
        lastRunAt: schedule.nextRunAt,
        nextRunAt,
        occurrencesGenerated: occurrence,
        status: after.action === "complete" ? "completed" : schedule.status,
        updatedAt: now
      })
      .where(eq(recurringInvoices.id, schedule.id))

    // Billed hours are stamped inside the same transaction as the invoice that bills them, so a
    // rollback cannot leave time entries marked for an invoice that does not exist.
    if (retainer && schedule.projectId) {
      await transaction
        .update(timeEntries)
        .set({ invoicedInId: invoice.id })
        .where(
          and(
            eq(timeEntries.projectId, schedule.projectId),
            eq(timeEntries.billable, true),
            isNull(timeEntries.invoicedInId),
            isNull(timeEntries.deletedAt)
          )
        )
    }

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      totalCents: invoice.totalCents,
      occurrence,
      clientId: schedule.clientId,
      projectId: schedule.projectId,
      retainer
    } satisfies GenerationOutcome
  })

  if (!outcome) return

  await announceGeneration(payload.recurringInvoiceId, outcome)
}

// Audit, events and the PDF enqueue all happen after the transaction commits. Emitting inside it
// would let a subscriber read an invoice that a later rollback erased, and `emit` deliberately does
// not catch, so a throwing handler would take the write down with it.
async function announceGeneration(
  recurringInvoiceId: string,
  outcome: GenerationOutcome
): Promise<void> {
  await writeAudit("recurring_invoice.generated", {
    actorUserId: null,
    targetEntityType: "recurring_invoice",
    targetEntityId: recurringInvoiceId,
    metadata: {
      invoiceId: outcome.invoiceId,
      invoiceNumber: outcome.invoiceNumber,
      totalCents: outcome.totalCents,
      occurrence: outcome.occurrence
    },
    ipAddress: null,
    userAgent: null
  })

  await emitRecurringInvoiceGenerated({
    recurringInvoiceId,
    invoiceId: outcome.invoiceId,
    clientId: outcome.clientId,
    projectId: outcome.projectId,
    occurrence: outcome.occurrence
  })

  // Emitted on every run whose pool is used up, not only the first ever. The hours billed by a run
  // are stamped `invoiced_in_id` inside its transaction, so consumption restarts from zero each
  // period — exhaustion is a fact about this occurrence, not a latch that stays set.
  if (outcome.retainer?.exhausted) {
    await emitRetainerPoolExhausted({
      recurringInvoiceId,
      clientId: outcome.clientId,
      includedHours: outcome.retainer.includedHours,
      consumedHours: outcome.retainer.consumedHours
    })
  }

  await enqueueJob("invoice.pdf.render", { invoiceId: outcome.invoiceId })
}

type GenerationTransaction = Parameters<Parameters<typeof database.transaction>[0]>[0]

// Consumption is every unbilled billable entry on the schedule's project, not entries inside the
// occurrence window: "unbilled" is what `invoiced_in_id IS NULL` already means, and a window would
// silently drop hours logged late for a period that has closed.
//
// A retainer configured on a schedule with no project has no source of hours at all, so the pool
// reads as untouched. That is a configuration mistake the UI should prevent rather than something
// this job can repair.
async function resolveRetainerUsage(
  transaction: GenerationTransaction,
  schedule: typeof recurringInvoices.$inferSelect
): Promise<RetainerUsage | null> {
  const terms = toRetainerTerms(schedule)

  if (!terms) return null

  if (!schedule.projectId) return calculateRetainerUsage(terms, 0)

  const [row] = await transaction
    .select({ durationSeconds: sum(timeEntries.durationSeconds) })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.projectId, schedule.projectId),
        eq(timeEntries.billable, true),
        isNull(timeEntries.invoicedInId),
        isNull(timeEntries.deletedAt)
      )
    )

  return calculateRetainerUsage(terms, toConsumedHours(Number(row?.durationSeconds ?? 0)))
}

// Only the hours beyond the pool are billed, as one line. The hours inside it were paid for by the
// retainer fee that the blueprint already carries, so adding them again would double-charge.
function toOverageLineItems(
  retainer: RetainerUsage | null,
  overageRateCents: number | null
): InvoiceLineItemRow[] {
  if (!retainer || retainer.overageHours <= 0 || overageRateCents === null) return []

  return [
    {
      taxRateId: null,
      description: t("recurringInvoices.overage.lineDescription", {
        includedHours: retainer.includedHours
      }),
      unit: t("recurringInvoices.overage.lineUnit"),
      quantity: retainer.overageHours,
      unitPriceCents: overageRateCents,
      discount: { discountType: null, discountPercentage: null, discountAmountCents: null },
      taxPercentage: 0
    }
  ]
}

function toInvoiceLineItemRow(line: RecurringInvoiceBlueprintLine): InvoiceLineItemRow {
  return {
    taxRateId: line.taxRateId,
    description: line.description,
    unit: line.unit,
    quantity: line.quantity,
    unitPriceCents: line.unitPriceCents,
    discount: {
      discountType: line.discountType,
      // The blueprint stores a number because it is jsonb; the column is `numeric`, which Drizzle
      // types as a string.
      discountPercentage: line.discountPercentage === null ? null : String(line.discountPercentage),
      discountAmountCents: line.discountAmountCents
    },
    taxPercentage: line.taxPercentage
  }
}
