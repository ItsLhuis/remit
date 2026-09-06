import { type InvoiceStatus } from "../schemas"

import { getInvoiceOutstandingCents } from "./invoiceStatusView"

// The instance late-fee policy, already narrowed from the `settings` row into the two shapes that
// can actually price a fee. `enabled: false` is a member of the union rather than a boolean beside
// it so a caller cannot read a percentage off a policy that is switched off.
export type LateFeePolicy =
  | { enabled: false }
  | {
      enabled: true
      kind: "percentage"
      percentage: number
      graceDays: number
      maxCents: number | null
    }
  | {
      enabled: true
      kind: "fixed"
      amountCents: number
      graceDays: number
      maxCents: number | null
    }

// The six `settings.late_fee_*` columns as Drizzle hands them over: the percentage is `numeric`, so
// it arrives as a string, and the two money columns as integer minor units.
export type LateFeePolicyRow = {
  lateFeeEnabled: boolean
  lateFeeType: "percentage" | "fixed" | null
  lateFeePercentage: string | null
  lateFeeAmountCents: number | null
  lateFeeGraceDays: number
  lateFeeMaxCents: number | null
}

export type LateFeeCandidate = {
  status: InvoiceStatus
  dueDate: Date | null
  paidAt: Date | null
  totalCents: number
  amountPaidCents: number
  lateFeeCents: number | null
}

export type LateFeeRefusal =
  | "policy_off"
  | "already_assessed"
  | "not_issued"
  | "settled"
  | "no_due_date"
  | "within_grace"
  | "nothing_outstanding"
  | "rounds_to_zero"

export type LateFeeAssessment =
  | { charge: true; feeCents: number; daysLate: number }
  | { charge: false; reason: LateFeeRefusal }

const MILLISECONDS_PER_DAY = 86_400_000

// `chk_settings_late_fee_enabled_shape` and `chk_settings_late_fee_shape` between them guarantee
// that an enabled policy names a type and that the type's own amount column is populated, so the
// null fallbacks below are unreachable through the database. They exist because this function also
// runs against an instance that has never written a settings row at all.
export function toLateFeePolicy(row: LateFeePolicyRow | null): LateFeePolicy {
  if (!row?.lateFeeEnabled) return { enabled: false }

  if (row.lateFeeType === "percentage" && row.lateFeePercentage !== null) {
    return {
      enabled: true,
      kind: "percentage",
      percentage: Number(row.lateFeePercentage),
      graceDays: row.lateFeeGraceDays,
      maxCents: row.lateFeeMaxCents
    }
  }

  if (row.lateFeeType === "fixed" && row.lateFeeAmountCents !== null) {
    return {
      enabled: true,
      kind: "fixed",
      amountCents: row.lateFeeAmountCents,
      graceDays: row.lateFeeGraceDays,
      maxCents: row.lateFeeMaxCents
    }
  }

  return { enabled: false }
}

// The whole late-fee decision, in one place and with no IO: the caller passes the clock, the policy
// and the invoice's own amounts, and gets either a fee in integer cents or the reason there is none.
//
// A fee is charged at most once per invoice, and `lateFeeCents IS NOT NULL` is what says it already
// was — which is also the predicate the applying UPDATE uses, so a waived fee (0) is a charged fee
// and is never reassessed.
//
// The percentage is taken on what is still outstanding rather than on the face value: a client who
// has paid four fifths of an invoice is late on the remaining fifth, and charging them a percentage
// of money already received would be charging them for their own payment.
export function assessLateFee(
  invoice: LateFeeCandidate,
  policy: LateFeePolicy,
  now: Date
): LateFeeAssessment {
  if (!policy.enabled) return { charge: false, reason: "policy_off" }
  if (invoice.lateFeeCents !== null) return { charge: false, reason: "already_assessed" }
  if (invoice.status === "draft") return { charge: false, reason: "not_issued" }
  if (invoice.status === "paid" || invoice.paidAt !== null) {
    return { charge: false, reason: "settled" }
  }
  if (!invoice.dueDate) return { charge: false, reason: "no_due_date" }

  const daysLate = countDaysLate(invoice.dueDate, now)

  if (daysLate <= policy.graceDays) return { charge: false, reason: "within_grace" }

  const outstandingCents = getInvoiceOutstandingCents(invoice)

  if (outstandingCents <= 0) return { charge: false, reason: "nothing_outstanding" }

  const feeCents = capFee(rawFeeCents(policy, outstandingCents), policy.maxCents)

  // A fee that prices to nothing is not written: the column is the record that a fee was charged,
  // and stamping a zero would both refuse every later assessment and print a 0.00 line on the
  // document for money nobody owes.
  if (feeCents <= 0) return { charge: false, reason: "rounds_to_zero" }

  return { charge: true, feeCents, daysLate }
}

// The one rounding step in the whole fee, at the point the percentage becomes money. Rounding the
// base first, or the capped result again, would let the same policy price the same invoice two ways
// depending on which caller did the arithmetic (ADR-0009).
function rawFeeCents(
  policy: Extract<LateFeePolicy, { enabled: true }>,
  outstandingCents: number
): number {
  if (policy.kind === "fixed") return policy.amountCents

  return Math.round((outstandingCents * policy.percentage) / 100)
}

function capFee(feeCents: number, maxCents: number | null): number {
  return maxCents === null ? feeCents : Math.min(feeCents, maxCents)
}

// Whole UTC days, so an instance in any zone agrees about which day it is, and counted the same way
// `isInvoiceOverdue` compares them: the due day itself is day zero and a grace of zero therefore
// charges on the first day after the due date.
function countDaysLate(dueDate: Date, now: Date): number {
  return Math.floor((toUtcDayValue(now) - toUtcDayValue(dueDate)) / MILLISECONDS_PER_DAY)
}

function toUtcDayValue(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
}
