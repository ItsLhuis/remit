import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole, type Role } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

import { type PaymentRejectionReason } from "./paymentWrites"
import { type PaymentActor } from "./types"

// The session, audit, revalidation and rejection-mapping plumbing the payment write paths share,
// kept beside mutations.ts rather than inside it because a `"use server"` module may export nothing
// but async functions — the synchronous helpers and the types below could not live there.
export type PaymentWriteGate = { context: PaymentActor } | { error: string }

export type PaymentAuditEvent = "payment.recorded" | "payment.updated" | "payment.deleted"

export type PaymentInvoiceRef = {
  id: string
  projectId: string | null
  clientId: string | null
}

// Recording that money arrived is the accountant's job as much as the owner's; destroying a money
// record is not, which is why the two gates differ. The names are what `doctor.config.ts` registers
// as server auth functions, so each call site stays greppable to its privilege level.
export function requirePaymentWrite(): Promise<PaymentWriteGate> {
  return requirePaymentRole(["owner", "accountant"])
}

export function requirePaymentDelete(): Promise<PaymentWriteGate> {
  return requirePaymentRole(["owner"])
}

export async function writePaymentAudit(
  actor: PaymentActor,
  event: PaymentAuditEvent,
  paymentId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await writeAudit(event, {
    actorUserId: actor.userId,
    actorRole: actor.role,
    targetEntityType: "payment",
    targetEntityId: paymentId,
    metadata,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent
  })
}

// One translated message per reason, so the same rejection reads the same way whether it came from
// the form, the "mark as paid" action or an edit. `overpaid` names credit notes because that is the
// only route to reducing what a client owes.
export function toPaymentErrorMessage(reason: PaymentRejectionReason): string {
  switch (reason) {
    case "invoice_not_found":
      return t("payments.errors.invoiceNotFound")
    case "invoice_not_issued":
      return t("payments.errors.invoiceNotIssued")
    case "currency_mismatch":
      return t("payments.errors.currencyMismatch")
    case "overpaid":
      return t("payments.errors.overpayment")
    case "payment_not_found":
      return t("payments.errors.notFound")
    case "provider_owned":
      return t("payments.errors.providerOwned")
    case "already_settled":
      return t("payments.errors.alreadySettled")
  }
}

export function handlePaymentActionError(
  error: unknown,
  {
    action,
    userId,
    fallbackMessage
  }: { action: string; userId: string | null; fallbackMessage: string }
): { error: string } {
  logger.error({ action, userId, err: error }, "Payment action failed")

  return { error: fallbackMessage }
}

// A duplicate of `revalidateInvoicePaths` in `features/invoices/mutationContext.ts` on purpose.
// Importing it would close a cycle: `features/invoices` already imports this feature's server barrel
// for `recordInvoiceSettlement`, so an arrow back the other way would make the two modules mutually
// dependent (`import/no-cycle`). The paths are invoice routes because a payment has no page of its
// own — it is only ever shown inside its invoice.
export function revalidatePaymentPaths(invoice: PaymentInvoiceRef): void {
  if (invoice.projectId) {
    revalidatePath(`/projects/${invoice.projectId}/invoices/${invoice.id}`)
    revalidatePath(`/projects/${invoice.projectId}/invoices`)
    revalidatePath(`/projects/${invoice.projectId}`)
  }

  if (invoice.clientId) revalidatePath(`/clients/${invoice.clientId}`)

  revalidatePath("/invoices")
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}

async function requirePaymentRole(allowed: Role[]): Promise<PaymentWriteGate> {
  const gate = await getPaymentActionContext()

  if ("error" in gate) return gate

  if (!allowed.includes(gate.context.role)) return { error: t("errors.forbidden") }

  return gate
}

async function getPaymentActionContext(): Promise<PaymentWriteGate> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) return { error: t("errors.unauthorized") }

  const role = await getCurrentRole({ headers: requestHeaders, userId: session.user.id })

  if (!isRole(role)) return { error: t("errors.forbidden") }

  return {
    context: {
      userId: session.user.id,
      role,
      ipAddress: getIpAddress(requestHeaders),
      userAgent: requestHeaders.get("user-agent")
    }
  }
}

function isRole(value: string | null | undefined): value is Role {
  return value === "owner" || value === "accountant" || value === "assistant"
}
