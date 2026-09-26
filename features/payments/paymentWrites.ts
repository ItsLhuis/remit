import { and, eq, isNotNull, isNull, ne, sql } from "drizzle-orm"

import { database } from "@/database"
import { creditNotes, invoices, payments } from "@/database/schema"

import { type ManualPaymentMethod } from "./schemas"
import {
  evaluateInvoiceSettlement,
  getInvoiceOutstandingCents,
  type InvoiceSettlement
} from "./services"

// Every write that can move `invoices.amount_paid_cents` lives here, behind one transactional shape,
// because the aggregate is only trustworthy if the payment row and the invoice column can never be
// written apart. Three callers share it: the server actions in mutations.ts, the Stripe receiver in
// stripeWebhook.ts, and `markInvoicePaid` in `features/invoices/mutations.ts` by way of
// `recordInvoiceSettlement`. None of them recompute the aggregate themselves. A fourth,
// `features/creditNotes/mutations.ts`, calls `resettleInvoiceWrite` because a credit note settles an
// invoice as surely as a payment does (`services/paymentSettlement.ts`).
//
// The module is deliberately not `"use server"`: it exports values other than async functions, and
// its callers are server modules rather than the client.

export type PaymentRejectionReason =
  | "invoice_deleted"
  | "invoice_not_found"
  | "invoice_not_issued"
  | "currency_mismatch"
  | "overpaid"
  | "payment_not_found"
  | "provider_owned"
  | "already_settled"

export type AppliedPayment = {
  paymentId: string
  invoiceId: string
  projectId: string | null
  clientId: string | null
  amountCents: number
  amountPaidCents: number
  settled: boolean
}

export type PaymentWriteResult =
  | { status: "applied"; payment: AppliedPayment }
  | { status: "rejected"; reason: PaymentRejectionReason }

// Only the Stripe path can be a replay, so only its result carries that case; the manual paths would
// have to handle a branch they can never reach.
export type StripePaymentWriteResult =
  | PaymentWriteResult
  | { status: "duplicate"; paymentId: string }

export type RecordPaymentWriteInput = {
  invoiceId: string
  method: ManualPaymentMethod
  amountCents: number
  paidAt: Date
  reference: string | null
  notes: string | null
}

export type RecordStripePaymentWriteInput = {
  invoiceId: string
  amountCents: number
  currency: string
  paidAt: Date
  stripePaymentIntentId: string
}

export type UpdatePaymentWriteInput = {
  id: string
  method: ManualPaymentMethod
  amountCents: number
  paidAt: Date
  reference: string | null
  notes: string | null
}

type PaymentTransaction = Parameters<Parameters<typeof database.transaction>[0]>[0]

type InvoiceStatusValue = (typeof invoices.$inferSelect)["status"]

type LockedInvoice = {
  id: string
  status: InvoiceStatusValue
  currency: string
  totalCents: number
  paidAt: Date | null
  projectId: string | null
  clientId: string | null
}

type PaymentInsertValues = {
  method: typeof payments.$inferInsert.method
  amountCents: number
  paidAt: Date
  reference: string | null
  notes: string | null
  stripePaymentIntentId: string | null
}

export async function recordPaymentWrite(
  input: RecordPaymentWriteInput
): Promise<PaymentWriteResult> {
  return database.transaction(async (transaction) => {
    const invoice = await lockInvoice(transaction, input.invoiceId)

    if (!invoice) return { status: "rejected", reason: "invoice_not_found" }

    if (invoice.status === "draft") return { status: "rejected", reason: "invoice_not_issued" }

    return addPayment(transaction, invoice, input.amountCents, {
      method: input.method,
      amountCents: input.amountCents,
      paidAt: input.paidAt,
      reference: input.reference,
      notes: input.notes,
      stripePaymentIntentId: null
    })
  })
}

export async function recordStripePaymentWrite(
  input: RecordStripePaymentWriteInput
): Promise<StripePaymentWriteResult> {
  return database.transaction(async (transaction) => {
    const invoice = await lockInvoice(transaction, input.invoiceId)

    if (!invoice) return { status: "rejected", reason: "invoice_not_found" }

    if (invoice.status === "draft") return { status: "rejected", reason: "invoice_not_issued" }

    if (input.currency !== invoice.currency) {
      return { status: "rejected", reason: "currency_mismatch" }
    }

    // Read under the invoice lock, so two deliveries of the same event serialise here rather than
    // racing to the unique index and turning a replay into a 500. Soft-deleted rows count as taken:
    // `payments_stripe_payment_intent_idx` does not exclude them, so the id stays claimed.
    const duplicate = await transaction.query.payments.findFirst({
      where: eq(payments.stripePaymentIntentId, input.stripePaymentIntentId),
      columns: { id: true }
    })

    if (duplicate) return { status: "duplicate", paymentId: duplicate.id }

    return addPayment(transaction, invoice, input.amountCents, {
      method: "stripe",
      amountCents: input.amountCents,
      paidAt: input.paidAt,
      reference: input.stripePaymentIntentId,
      notes: null,
      stripePaymentIntentId: input.stripePaymentIntentId
    })
  })
}

export async function updatePaymentWrite(
  input: UpdatePaymentWriteInput
): Promise<PaymentWriteResult> {
  return database.transaction(async (transaction) => {
    const owner = await findPaymentInvoiceId(transaction, input.id)

    if (!owner) return { status: "rejected", reason: "payment_not_found" }

    const invoice = await lockInvoice(transaction, owner.invoiceId)

    if (!invoice) return { status: "rejected", reason: "invoice_not_found" }

    // Re-read under the invoice lock. Every write to a payment goes through that lock, so this is
    // the authoritative view: a concurrent delete that committed between the two reads is visible
    // here and turns this edit into a miss rather than a resurrection.
    const existing = await transaction.query.payments.findFirst({
      where: and(eq(payments.id, input.id), isNull(payments.deletedAt)),
      columns: { id: true, stripePaymentIntentId: true }
    })

    if (!existing) return { status: "rejected", reason: "payment_not_found" }

    // A provider-written row states what Stripe actually moved. Editing its amount would leave the
    // aggregate disagreeing with the payment intent it names, so the row is read-only; a payment
    // recorded against the wrong invoice is removed instead.
    if (existing.stripePaymentIntentId) return { status: "rejected", reason: "provider_owned" }

    const { amountPaidCents, settlement } = await decideSettlement(transaction, invoice, {
      addedCents: input.amountCents,
      replacedPaymentId: input.id
    })

    if (settlement.outcome === "overpaid") return { status: "rejected", reason: "overpaid" }

    await transaction
      .update(payments)
      .set({
        method: input.method,
        amountCents: input.amountCents,
        paidAt: input.paidAt,
        reference: input.reference,
        notes: input.notes
      })
      .where(eq(payments.id, input.id))

    await applyInvoiceAggregate(transaction, invoice, {
      amountPaidCents,
      settlement,
      settledAt: input.paidAt
    })

    return {
      status: "applied",
      payment: toAppliedPayment(invoice, {
        paymentId: input.id,
        amountCents: input.amountCents,
        amountPaidCents,
        settlement
      })
    }
  })
}

export async function restorePaymentWrite(paymentId: string): Promise<PaymentWriteResult> {
  return database.transaction(async (transaction) => {
    const owner = await transaction.query.payments.findFirst({
      where: and(eq(payments.id, paymentId), isNotNull(payments.deletedAt)),
      columns: { invoiceId: true, amountCents: true }
    })

    if (!owner) return { status: "rejected", reason: "payment_not_found" }

    // `lockInvoice` refuses a soft-deleted invoice, which is the right answer for every other caller
    // and the wrong message for this one: a restore blocked by a deleted parent has to say so
    // (`trash.errors.restoreBlocked`) rather than claim the invoice does not exist.
    const parent = await transaction.query.invoices.findFirst({
      where: eq(invoices.id, owner.invoiceId),
      columns: { deletedAt: true }
    })

    if (!parent) return { status: "rejected", reason: "invoice_not_found" }
    if (parent.deletedAt) return { status: "rejected", reason: "invoice_deleted" }

    const invoice = await lockInvoice(transaction, owner.invoiceId)

    if (!invoice) return { status: "rejected", reason: "invoice_not_found" }

    const amountCents = Number(owner.amountCents)
    const { amountPaidCents, settlement } = await decideSettlement(transaction, invoice, {
      addedCents: amountCents
    })

    // The same guard `addPayment` applies, and it is load-bearing here rather than defensive: money
    // may have arrived by another route while this payment sat in the trash, so a restore is capable
    // of overpaying an invoice that balanced perfectly a moment ago.
    if (settlement.outcome === "overpaid") return { status: "rejected", reason: "overpaid" }

    const [restored] = await transaction
      .update(payments)
      .set({ deletedAt: null })
      .where(and(eq(payments.id, paymentId), isNotNull(payments.deletedAt)))
      .returning({ id: payments.id })

    if (!restored) return { status: "rejected", reason: "payment_not_found" }

    await applyInvoiceAggregate(transaction, invoice, {
      amountPaidCents,
      settlement,
      settledAt: new Date()
    })

    return {
      status: "applied",
      payment: toAppliedPayment(invoice, {
        paymentId: restored.id,
        amountCents,
        amountPaidCents,
        settlement
      })
    }
  })
}

export async function softDeletePaymentWrite(paymentId: string): Promise<PaymentWriteResult> {
  return database.transaction(async (transaction) => {
    const owner = await findPaymentInvoiceId(transaction, paymentId)

    if (!owner) return { status: "rejected", reason: "payment_not_found" }

    const invoice = await lockInvoice(transaction, owner.invoiceId)

    if (!invoice) return { status: "rejected", reason: "invoice_not_found" }

    const [deleted] = await transaction
      .update(payments)
      .set({ deletedAt: new Date() })
      .where(and(eq(payments.id, paymentId), isNull(payments.deletedAt)))
      .returning({ id: payments.id, amountCents: payments.amountCents })

    if (!deleted) return { status: "rejected", reason: "payment_not_found" }

    const { amountPaidCents, settlement } = await decideSettlement(transaction, invoice)

    await applyInvoiceAggregate(transaction, invoice, {
      amountPaidCents,
      settlement,
      settledAt: new Date()
    })

    return {
      status: "applied",
      payment: toAppliedPayment(invoice, {
        paymentId: deleted.id,
        amountCents: Number(deleted.amountCents),
        amountPaidCents,
        settlement
      })
    }
  })
}

// The whole outstanding balance in one row, which is what "mark as paid" has always meant. It exists
// so `markInvoicePaid` can keep its name and its gate while the money it records goes through the
// same aggregate as every other payment. The balance is the one outstanding definition, credit notes
// netted, so marking a credited invoice paid books the remainder the client owed and not the part
// already credited.
export async function settleInvoiceWrite(input: {
  invoiceId: string
  method: ManualPaymentMethod
  paidAt: Date
}): Promise<PaymentWriteResult> {
  return database.transaction(async (transaction) => {
    const invoice = await lockInvoice(transaction, input.invoiceId)

    if (!invoice) return { status: "rejected", reason: "invoice_not_found" }

    if (invoice.status === "draft") return { status: "rejected", reason: "invoice_not_issued" }

    const outstandingCents = getInvoiceOutstandingCents({
      totalCents: invoice.totalCents,
      amountPaidCents: await sumRecordedPayments(transaction, invoice.id),
      creditedCents: await sumCreditedCents(transaction, invoice.id)
    })

    if (outstandingCents <= 0) return { status: "rejected", reason: "already_settled" }

    return addPayment(transaction, invoice, outstandingCents, {
      method: input.method,
      amountCents: outstandingCents,
      paidAt: input.paidAt,
      reference: null,
      notes: null,
      stripePaymentIntentId: null
    })
  })
}

// Re-decides settlement after a credit note is issued, withdrawn or restored, inside the caller's
// transaction and after its write, so the decision reads that write. It moves no money and records
// no payment; it only brings `status` and `paid_at` back into line with what is now owed.
//
// The caller's credit-note write needs no lock of its own taken first. An insert references the
// invoice and takes a key-share lock on it, which waits for any payment holding `FOR UPDATE`; a
// withdrawal or restore does not, but it takes the lock here before deciding, so whichever of it and
// a concurrent payment commits last re-reads everything the other committed.
export async function resettleInvoiceWrite(
  transaction: PaymentTransaction,
  invoiceId: string
): Promise<void> {
  const invoice = await lockInvoice(transaction, invoiceId)

  if (!invoice || invoice.status === "draft") return

  const { amountPaidCents, settlement } = await decideSettlement(transaction, invoice)

  await applyInvoiceAggregate(transaction, invoice, {
    amountPaidCents,
    settlement,
    settledAt: new Date()
  })
}

// `FOR UPDATE` is the race guard the whole module rests on. Two payments landing on one invoice at
// the same instant would otherwise both read the pre-existing sum, both pass the overpayment check
// against it, and both write an aggregate that ignores the other. Serialising on the invoice row
// makes every recompute below see all committed siblings.
async function lockInvoice(
  transaction: PaymentTransaction,
  invoiceId: string
): Promise<LockedInvoice | null> {
  const [invoice] = await transaction
    .select({
      id: invoices.id,
      status: invoices.status,
      currency: invoices.currency,
      totalCents: invoices.totalCents,
      paidAt: invoices.paidAt,
      projectId: invoices.projectId,
      clientId: invoices.clientId
    })
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), isNull(invoices.deletedAt)))
    .for("update")

  if (!invoice) return null

  return { ...invoice, totalCents: Number(invoice.totalCents) }
}

// A draft has never been issued, so there is nothing for a client to have paid, and money landing on
// one would strand the aggregate on a document still free to be rewritten. Each write path states
// that guard itself rather than sharing a helper, because a helper returning "no rejection" cannot
// narrow the caller's `invoice` to non-null.
async function addPayment(
  transaction: PaymentTransaction,
  invoice: LockedInvoice,
  amountCents: number,
  values: PaymentInsertValues
): Promise<PaymentWriteResult> {
  const { amountPaidCents, settlement } = await decideSettlement(transaction, invoice, {
    addedCents: amountCents
  })

  if (settlement.outcome === "overpaid") return { status: "rejected", reason: "overpaid" }

  const [created] = await transaction
    .insert(payments)
    .values({ ...values, invoiceId: invoice.id, currency: invoice.currency })
    .returning({ id: payments.id })

  if (!created) throw new Error("Payment insert returned no row")

  await applyInvoiceAggregate(transaction, invoice, {
    amountPaidCents,
    settlement,
    settledAt: values.paidAt
  })

  return {
    status: "applied",
    payment: toAppliedPayment(invoice, {
      paymentId: created.id,
      amountCents,
      amountPaidCents,
      settlement
    })
  }
}

type SettlementChange = {
  addedCents?: number
  replacedPaymentId?: string
}

type SettlementDecision = {
  amountPaidCents: number
  settlement: InvoiceSettlement
}

// The one settlement decision every write makes, under the invoice lock: the recorded payments,
// without the row an edit replaces and with the amount a write adds, against the total less the live
// credit notes (ADR-0044).
async function decideSettlement(
  transaction: PaymentTransaction,
  invoice: LockedInvoice,
  { addedCents = 0, replacedPaymentId }: SettlementChange = {}
): Promise<SettlementDecision> {
  const amountPaidCents =
    (await sumRecordedPayments(transaction, invoice.id, replacedPaymentId)) + addedCents
  const settlement = evaluateInvoiceSettlement({
    amountPaidCents,
    totalCents: invoice.totalCents,
    creditedCents: await sumCreditedCents(transaction, invoice.id)
  })

  return { amountPaidCents, settlement }
}

async function findPaymentInvoiceId(
  transaction: PaymentTransaction,
  paymentId: string
): Promise<{ invoiceId: string } | null> {
  const row = await transaction.query.payments.findFirst({
    where: and(eq(payments.id, paymentId), isNull(payments.deletedAt)),
    columns: { invoiceId: true }
  })

  return row ?? null
}

// Summed in SQL rather than in a service so the total is always the database's own view of the
// non-deleted rows at this instant, taken while the invoice lock is held.
async function sumRecordedPayments(
  transaction: PaymentTransaction,
  invoiceId: string,
  excludePaymentId?: string
): Promise<number> {
  const [row] = await transaction
    .select({ total: sql<string>`coalesce(sum(${payments.amountCents}), 0)` })
    .from(payments)
    .where(
      and(
        eq(payments.invoiceId, invoiceId),
        isNull(payments.deletedAt),
        excludePaymentId ? ne(payments.id, excludePaymentId) : undefined
      )
    )

  return Number(row?.total ?? 0)
}

// Read directly from `credit_notes`, and a deliberate twin of `features/invoices/queryFragments.ts`'s
// `readInvoiceCreditedCents`: `features/creditNotes` and `features/invoices` both reach this module
// through `@/features/payments/server`, so importing either from here would close a cycle, and the
// invoices copy cannot come from that barrel because the worker loads it and the barrel carries
// server actions. The table is shared substrate; both count live notes only.
async function sumCreditedCents(
  transaction: PaymentTransaction,
  invoiceId: string
): Promise<number> {
  const [row] = await transaction
    .select({ total: sql<string>`coalesce(sum(${creditNotes.totalCents}), 0)` })
    .from(creditNotes)
    .where(and(eq(creditNotes.invoiceId, invoiceId), isNull(creditNotes.deletedAt)))

  return Number(row?.total ?? 0)
}

type AggregateApplication = {
  amountPaidCents: number
  settlement: InvoiceSettlement
  settledAt: Date
}

async function applyInvoiceAggregate(
  transaction: PaymentTransaction,
  invoice: LockedInvoice,
  { amountPaidCents, settlement, settledAt }: AggregateApplication
): Promise<void> {
  const settled = settlement.outcome === "settled"

  await transaction
    .update(invoices)
    .set({
      amountPaidCents,
      status: resolveInvoiceStatus(invoice.status, settled),
      paidAt: settled ? (invoice.paidAt ?? settledAt) : null
    })
    .where(eq(invoices.id, invoice.id))
}

// The forward-only machine in `features/invoices/services/canTransitionInvoiceStatus.ts` governs
// what a *user* may ask for, and it is untouched: nobody moves an invoice backwards by asking.
// Correcting the payment record behind a settlement is a different act, and leaving the invoice
// marked `paid` while its aggregate no longer reaches the total would make `amount_paid_cents` and
// `status` tell a reader two different stories. The aggregate is the source of truth, so the status
// follows it back down.
function resolveInvoiceStatus(current: InvoiceStatusValue, settled: boolean): InvoiceStatusValue {
  if (settled) return "paid"

  return current === "paid" ? "sent" : current
}

type AppliedPaymentInput = {
  paymentId: string
  amountCents: number
  amountPaidCents: number
  settlement: InvoiceSettlement
}

function toAppliedPayment(
  invoice: LockedInvoice,
  { paymentId, amountCents, amountPaidCents, settlement }: AppliedPaymentInput
): AppliedPayment {
  return {
    paymentId,
    invoiceId: invoice.id,
    projectId: invoice.projectId,
    clientId: invoice.clientId,
    amountCents,
    amountPaidCents,
    settled: settlement.outcome === "settled"
  }
}
