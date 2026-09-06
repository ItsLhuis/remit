import { and, eq, isNull, lt, ne, sql } from "drizzle-orm"

import { writeAudit } from "@/lib/audit"

import { database } from "@/database"
import { invoices } from "@/database/schema"

import { emitInvoiceLateFeeApplied } from "./events"
import { assessLateFee, toLateFeePolicy, type LateFeePolicy } from "./services"

// The late-fee half of the nightly overdue sweep, in its own module rather than inside jobs.ts:
// that file is already near the 500-line ceiling, and the seam between "announce that an invoice
// went late" and "charge for it" is the one place it splits without cutting a job in half.
//
// It is not a `JobMap` entry of its own. The candidate set is the sweep's candidate set — issued,
// unpaid, past due, not deleted — so a second schedule would re-run the same query on the same
// clock for no gain, and two nightly jobs that must agree about which invoices are late is one more
// thing that can drift apart.

type LateFeeCandidateRow = {
  id: string
  clientId: string | null
  status: (typeof invoices.$inferSelect)["status"]
  dueDate: Date | null
  paidAt: Date | null
  totalCents: number
  amountPaidCents: number
  lateFeeCents: number | null
}

export async function applyLateFees(now: Date): Promise<void> {
  const policy = await getLateFeePolicy()

  if (!policy.enabled) return

  const candidates = await getLateFeeCandidates(now)

  for (const candidate of candidates) {
    const assessment = assessLateFee(candidate, policy, now)

    if (!assessment.charge) continue

    const charged = await chargeLateFee(candidate.id, assessment.feeCents)

    if (!charged) continue

    await writeAudit("invoice.late_fee.applied", {
      actorUserId: null,
      targetEntityType: "invoice",
      targetEntityId: candidate.id,
      metadata: {
        clientId: candidate.clientId,
        feeCents: assessment.feeCents,
        daysLate: assessment.daysLate,
        policy: describePolicy(policy)
      },
      ipAddress: null,
      userAgent: null
    })

    await emitInvoiceLateFeeApplied({
      invoiceId: candidate.id,
      clientId: candidate.clientId,
      feeCents: assessment.feeCents,
      daysLate: assessment.daysLate
    })
  }
}

// Writing to an issued invoice is legitimate here and nowhere else in this module's neighbourhood.
// Every other write path refuses a non-draft because editing one would revise what the client
// already agreed to; a late fee revises nothing — it is a consequence of the client not paying by
// the date the same document named, and the audit entry beside it records when and under which
// policy it was charged.
//
// The conditional UPDATE is the idempotency guard, and it is a claim rather than a read followed by
// a write: `late_fee_cents IS NULL` means "never assessed", so two workers racing the same night
// both pass the assessment and exactly one row comes back from this statement. It also re-checks
// `paid_at` in the same statement, so a payment that committed after the candidate was read turns
// the charge into a miss rather than billing a client who has just settled.
//
// The fee is added into `total_cents` in the same statement rather than sitting beside it, so every
// surface that already asks what an invoice is worth or what is outstanding stays correct without
// knowing late fees exist, and `chk_invoices_amount_paid` still admits a payment for the full
// amount now due (ADR-0033).
async function chargeLateFee(invoiceId: string, feeCents: number): Promise<boolean> {
  const [charged] = await database
    .update(invoices)
    .set({
      lateFeeCents: feeCents,
      totalCents: sql`${invoices.totalCents} + ${feeCents}`
    })
    .where(
      and(
        eq(invoices.id, invoiceId),
        isNull(invoices.lateFeeCents),
        ne(invoices.status, "draft"),
        isNull(invoices.paidAt),
        isNull(invoices.deletedAt)
      )
    )
    .returning({ id: invoices.id })

  return Boolean(charged)
}

async function getLateFeePolicy(): Promise<LateFeePolicy> {
  const row = await database.query.settings.findFirst({
    columns: {
      lateFeeEnabled: true,
      lateFeeType: true,
      lateFeePercentage: true,
      lateFeeAmountCents: true,
      lateFeeGraceDays: true,
      lateFeeMaxCents: true
    }
  })

  return toLateFeePolicy(row ?? null)
}

// `late_fee_cents IS NULL` narrows the scan to invoices that have never been assessed, which is the
// same predicate the claim above re-checks. The grace period is not expressed here: the service owns
// every rule about when a fee is due, and duplicating the window in SQL would let the two disagree.
async function getLateFeeCandidates(now: Date): Promise<LateFeeCandidateRow[]> {
  const rows = await database
    .select({
      id: invoices.id,
      clientId: invoices.clientId,
      status: invoices.status,
      dueDate: invoices.dueDate,
      paidAt: invoices.paidAt,
      totalCents: invoices.totalCents,
      amountPaidCents: invoices.amountPaidCents,
      lateFeeCents: invoices.lateFeeCents
    })
    .from(invoices)
    .where(
      and(
        ne(invoices.status, "draft"),
        isNull(invoices.paidAt),
        isNull(invoices.lateFeeCents),
        lt(invoices.dueDate, toUtcDay(now)),
        isNull(invoices.deletedAt)
      )
    )

  return rows.map((row) => ({
    ...row,
    totalCents: Number(row.totalCents),
    amountPaidCents: Number(row.amountPaidCents),
    lateFeeCents: row.lateFeeCents === null ? null : Number(row.lateFeeCents)
  }))
}

// Recorded in the audit entry so the invoice detail can say what was charged and under which terms
// without re-reading settings that may have changed since.
function describePolicy(
  policy: Extract<LateFeePolicy, { enabled: true }>
): Record<string, unknown> {
  return policy.kind === "percentage"
    ? { kind: "percentage", percentage: policy.percentage, graceDays: policy.graceDays }
    : { kind: "fixed", amountCents: policy.amountCents, graceDays: policy.graceDays }
}

function toUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}
