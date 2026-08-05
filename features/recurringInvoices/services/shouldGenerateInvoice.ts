import { type RecurringInvoiceStatus } from "../schemas"

import { toUtcDay } from "./computeNextRunDate"

export type RecurringInvoiceState = {
  status: RecurringInvoiceStatus
  nextRunAt: Date
  endAfterCount: number | null
  endByDate: Date | null
  occurrencesGenerated: number
}

// Three outcomes rather than a boolean plus flags: a schedule that has reached its end condition is
// not "not due", it is finished, and the caller has to write `completed` for it. Modelling that as a
// union keeps the job from having to re-derive which of the two "do not generate" cases it is in
// (types.md, make invalid states unrepresentable).
export type RecurringInvoiceRunDecision =
  | { action: "generate" }
  | { action: "complete"; reason: "occurrence_limit" | "end_date" }
  | { action: "skip"; reason: "inactive" | "not_due" }

// End conditions are checked before due-ness on purpose. A schedule whose last occurrence has been
// generated is finished the moment it is looked at, not on the day its next run would have fallen —
// leaving it `active` would keep it in the due-schedule sweep forever.
//
// `chk_recurring_invoices_end_condition` only forbids both end fields being set at once, so a
// schedule with neither is legal and runs until someone pauses or cancels it.
export function shouldGenerateInvoice(
  schedule: RecurringInvoiceState,
  asOf: Date
): RecurringInvoiceRunDecision {
  if (schedule.status !== "active") return { action: "skip", reason: "inactive" }

  if (schedule.endAfterCount !== null && schedule.occurrencesGenerated >= schedule.endAfterCount) {
    return { action: "complete", reason: "occurrence_limit" }
  }

  const nextRun = toUtcDay(schedule.nextRunAt).getTime()

  if (schedule.endByDate !== null && nextRun > toUtcDay(schedule.endByDate).getTime()) {
    return { action: "complete", reason: "end_date" }
  }

  // Inclusive of the run day itself, matching `isInvoiceOverdue`'s day-level comparison: a schedule
  // due today generates today rather than tomorrow.
  if (nextRun > toUtcDay(asOf).getTime()) return { action: "skip", reason: "not_due" }

  return { action: "generate" }
}
