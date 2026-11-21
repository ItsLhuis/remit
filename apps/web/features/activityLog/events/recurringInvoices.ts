import { eq } from "drizzle-orm"

import { on } from "@/lib/events"

import { database } from "@/database"
import { recurringInvoices } from "@/database/schema"

import { type ActivityRecord, findInvoiceNumber, record } from "./record"

export function subscribeRecurringInvoiceActivity(): void {
  // Filed under the invoice the run produced, not under the schedule: the invoice is what the reader
  // acts on, and a second row naming the schedule would announce one overnight run twice. The schedule
  // gets its own row only for exhaustion below, which is a different fact the invoice does not carry.
  on("recurring.invoice_generated", ({ invoiceId, occurrence }) =>
    record("recurring.invoice_generated", () => buildInvoiceGenerated(invoiceId, occurrence))
  )

  on("retainer.pool_exhausted", ({ recurringInvoiceId, includedHours, consumedHours }) =>
    record("retainer.pool_exhausted", () =>
      buildRetainerPoolExhausted(recurringInvoiceId, includedHours, consumedHours)
    )
  )
}

async function buildInvoiceGenerated(
  invoiceId: string,
  occurrence: number
): Promise<ActivityRecord | null> {
  const number = await findInvoiceNumber(invoiceId)

  if (number === null) return null

  return {
    entityType: "invoice",
    entityId: invoiceId,
    action: "generated",
    messageKey: "activity.messages.invoiceGenerated",
    messageArgs: { number, occurrence }
  }
}

async function buildRetainerPoolExhausted(
  recurringInvoiceId: string,
  includedHours: number,
  consumedHours: number
): Promise<ActivityRecord | null> {
  const row = await database.query.recurringInvoices.findFirst({
    where: eq(recurringInvoices.id, recurringInvoiceId),
    columns: { name: true }
  })

  if (!row) return null

  return {
    entityType: "recurring_invoice",
    entityId: recurringInvoiceId,
    action: "pool_exhausted",
    messageKey: "activity.messages.retainerPoolExhausted",
    messageArgs: { name: row.name, includedHours, consumedHours }
  }
}
