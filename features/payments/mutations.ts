"use server"

import { t } from "@/lib/i18n/server"

import { enqueueJob } from "@/lib/jobs"

import { emitInvoiceSettled, emitPaymentReceived } from "./events"
import {
  emptyToNull,
  handlePaymentActionError,
  requirePaymentDelete,
  requirePaymentWrite,
  revalidatePaymentPaths,
  toPaymentErrorMessage,
  writePaymentAudit
} from "./mutationContext"
import {
  recordPaymentWrite,
  settleInvoiceWrite,
  softDeletePaymentWrite,
  updatePaymentWrite
} from "./paymentWrites"
import { paymentIdSchema, recordPaymentSchema, updatePaymentSchema } from "./schemas"
import {
  type InvoiceSettlementResult,
  type PaymentActor,
  type PaymentMutationResult
} from "./types"

export async function recordPayment(input: unknown): Promise<PaymentMutationResult> {
  const gate = await requirePaymentWrite()

  if ("error" in gate) return gate

  const parsed = recordPaymentSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const result = await recordPaymentWrite({
      invoiceId: parsed.data.invoiceId,
      method: parsed.data.method,
      amountCents: parsed.data.amount,
      paidAt: parsed.data.paidAt,
      reference: emptyToNull(parsed.data.reference),
      notes: emptyToNull(parsed.data.notes)
    })

    if (result.status === "rejected") return { error: toPaymentErrorMessage(result.reason) }

    const { payment } = result

    await writePaymentAudit(context, "payment.recorded", payment.paymentId, {
      invoiceId: payment.invoiceId,
      method: parsed.data.method,
      amountCents: payment.amountCents,
      amountPaidCents: payment.amountPaidCents,
      settled: payment.settled
    })
    await emitPaymentReceived({
      paymentId: payment.paymentId,
      invoiceId: payment.invoiceId,
      userId: context.userId
    })

    if (payment.settled) {
      await emitInvoiceSettled({ invoiceId: payment.invoiceId, userId: context.userId })

      // The receipt goes out only once the invoice is fully settled, not on every part payment:
      // `email_payment_receipt` thanks the client for paying, and sending it against a remaining
      // balance would tell them they are square when they are not. Routed through the render job so
      // it carries the invoice PDF, and a no-op if that PDF already exists.
      await enqueueJob("invoice.pdf.render", { invoiceId: payment.invoiceId, email: "receipt" })
    }

    revalidatePaymentPaths({
      id: payment.invoiceId,
      projectId: payment.projectId,
      clientId: payment.clientId
    })

    return { data: { id: payment.paymentId } }
  } catch (error) {
    return handlePaymentActionError(error, {
      action: "recordPayment",
      userId: context.userId,
      fallbackMessage: t("payments.errors.recordFailed")
    })
  }
}

export async function updatePayment(input: unknown): Promise<PaymentMutationResult> {
  const gate = await requirePaymentWrite()

  if ("error" in gate) return gate

  const parsed = updatePaymentSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const result = await updatePaymentWrite({
      id: parsed.data.id,
      method: parsed.data.method,
      amountCents: parsed.data.amount,
      paidAt: parsed.data.paidAt,
      reference: emptyToNull(parsed.data.reference),
      notes: emptyToNull(parsed.data.notes)
    })

    if (result.status === "rejected") return { error: toPaymentErrorMessage(result.reason) }

    const { payment } = result

    await writePaymentAudit(context, "payment.updated", payment.paymentId, {
      invoiceId: payment.invoiceId,
      method: parsed.data.method,
      amountCents: payment.amountCents,
      amountPaidCents: payment.amountPaidCents,
      settled: payment.settled
    })

    if (payment.settled) {
      await emitInvoiceSettled({ invoiceId: payment.invoiceId, userId: context.userId })
    }

    revalidatePaymentPaths({
      id: payment.invoiceId,
      projectId: payment.projectId,
      clientId: payment.clientId
    })

    return { data: { id: payment.paymentId } }
  } catch (error) {
    return handlePaymentActionError(error, {
      action: "updatePayment",
      userId: context.userId,
      fallbackMessage: t("payments.errors.updateFailed")
    })
  }
}

export async function softDeletePayment(input: unknown): Promise<PaymentMutationResult> {
  const gate = await requirePaymentDelete()

  if ("error" in gate) return gate

  const parsed = paymentIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const result = await softDeletePaymentWrite(parsed.data.id)

    if (result.status === "rejected") return { error: toPaymentErrorMessage(result.reason) }

    const { payment } = result

    await writePaymentAudit(context, "payment.deleted", payment.paymentId, {
      invoiceId: payment.invoiceId,
      amountCents: payment.amountCents,
      amountPaidCents: payment.amountPaidCents,
      softDeleted: true
    })

    revalidatePaymentPaths({
      id: payment.invoiceId,
      projectId: payment.projectId,
      clientId: payment.clientId
    })

    return { data: { id: payment.paymentId } }
  } catch (error) {
    return handlePaymentActionError(error, {
      action: "softDeletePayment",
      userId: context.userId,
      fallbackMessage: t("payments.errors.deleteFailed")
    })
  }
}

// The bridge `markInvoicePaid` calls. The actor arrives already resolved by the invoice-side gate,
// so this path does not re-gate: it is not reachable from the client, only from a server action that
// has already proved the caller may record a payment. It stays quiet on `invoice.paid` and reports
// `settled` instead, leaving the emission to the action the user actually invoked.
export async function recordInvoiceSettlement(
  invoiceId: string,
  actor: PaymentActor
): Promise<InvoiceSettlementResult> {
  const result = await settleInvoiceWrite({
    invoiceId,
    method: "other",
    paidAt: new Date()
  })

  if (result.status === "rejected") return { error: toPaymentErrorMessage(result.reason) }

  const { payment } = result

  await writePaymentAudit(actor, "payment.recorded", payment.paymentId, {
    invoiceId: payment.invoiceId,
    method: "other",
    amountCents: payment.amountCents,
    amountPaidCents: payment.amountPaidCents,
    settled: payment.settled,
    source: "markInvoicePaid"
  })
  await emitPaymentReceived({
    paymentId: payment.paymentId,
    invoiceId: payment.invoiceId,
    userId: actor.userId
  })

  return { data: { paymentId: payment.paymentId, settled: payment.settled } }
}
