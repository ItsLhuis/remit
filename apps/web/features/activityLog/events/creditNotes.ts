import { eq } from "drizzle-orm"

import { on } from "@/lib/events"

import { database } from "@/database"
import { creditNotes } from "@/database/schema"

import { type ActivityRecord, findInvoiceNumber, record } from "./record"

export function subscribeCreditNoteActivity(): void {
  on("credit_note.issued", ({ creditNoteId, invoiceId }) =>
    record("credit_note.issued", () => buildCreditNoteIssued(creditNoteId, invoiceId))
  )
}

// Carries the two document numbers and no amount, for the reason `invoiceLateFeeApplied` carries
// none: the feed shows no currency, and a credit note priced in its invoice's currency would read as
// the wrong figure beside a row from a client billed in another.
async function buildCreditNoteIssued(
  creditNoteId: string,
  invoiceId: string
): Promise<ActivityRecord | null> {
  const [creditNote, invoiceNumber] = await Promise.all([
    database.query.creditNotes.findFirst({
      where: eq(creditNotes.id, creditNoteId),
      columns: { number: true }
    }),
    findInvoiceNumber(invoiceId)
  ])

  if (!creditNote || invoiceNumber === null) return null

  return {
    entityType: "credit_note",
    entityId: creditNoteId,
    action: "issued",
    messageKey: "activity.messages.creditNoteIssued",
    messageArgs: { number: creditNote.number, invoiceNumber }
  }
}
