import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole, type Role } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

// The session, role, audit and revalidation plumbing the schedule write paths share, kept beside
// mutations.ts rather than inside it because a `"use server"` module may export nothing but async
// functions — the error class and the synchronous helpers below could not live there.
export type RecurringInvoiceWriteContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

export type RecurringInvoiceWriteGate =
  | { context: RecurringInvoiceWriteContext }
  | { error: string }

export type RecurringInvoiceAuditEvent =
  | "recurring_invoice.created"
  | "recurring_invoice.updated"
  | "recurring_invoice.paused"
  | "recurring_invoice.resumed"
  | "recurring_invoice.cancelled"
  | "recurring_invoice.deleted"

export type RecurringInvoiceActionErrorContext = {
  action: string
  userId: string | null
  recurringInvoiceId?: string
  fallbackMessage?: string
}

// A failure the user is meant to read: thrown to unwind the action midway and caught by
// handleRecurringInvoiceActionError, which passes the message straight back rather than logging it
// as an incident.
export class ExpectedRecurringInvoiceError extends Error {}

// Three named gates over one implementation, matching the invoice module's granularity. An assistant
// may author and adjust a schedule, but ending one is owner-only: cancelling stops money arriving on
// a timetable the client has agreed to, which is a business decision rather than an editing one.
// The names are what `doctor.config.ts` registers as server auth functions, so each call site stays
// greppable to its privilege level.
export function requireRecurringInvoiceWrite(): Promise<RecurringInvoiceWriteGate> {
  return requireRecurringInvoiceRole(["owner", "assistant"])
}

export function requireRecurringInvoiceCancel(): Promise<RecurringInvoiceWriteGate> {
  return requireRecurringInvoiceRole(["owner"])
}

export function requireRecurringInvoiceDelete(): Promise<RecurringInvoiceWriteGate> {
  return requireRecurringInvoiceRole(["owner"])
}

export async function writeRecurringInvoiceAudit(
  context: RecurringInvoiceWriteContext,
  event: RecurringInvoiceAuditEvent,
  recurringInvoiceId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await writeAudit(event, {
    actorUserId: context.userId,
    actorRole: context.role,
    targetEntityType: "recurring_invoice",
    targetEntityId: recurringInvoiceId,
    metadata,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
}

export function handleRecurringInvoiceActionError(
  error: unknown,
  { action, userId, recurringInvoiceId, fallbackMessage }: RecurringInvoiceActionErrorContext
): { error: string } {
  if (error instanceof ExpectedRecurringInvoiceError) return { error: error.message }

  logger.error(
    { action, userId, recurringInvoiceId, err: error },
    "Recurring invoice action failed"
  )

  return { error: fallbackMessage ?? t("recurringInvoices.errors.updateFailed") }
}

// A schedule is reachable from its own list and detail routes, and the client it bills summarises
// it, so all three go stale on a write.
export function revalidateRecurringInvoicePaths(schedule: { id: string; clientId: string }): void {
  revalidatePath("/recurring-invoices")
  revalidatePath(`/recurring-invoices/${schedule.id}`)
  revalidatePath(`/clients/${schedule.clientId}`)
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}

async function requireRecurringInvoiceRole(allowed: Role[]): Promise<RecurringInvoiceWriteGate> {
  const gate = await getRecurringInvoiceActionContext()

  if ("error" in gate) return gate

  if (!allowed.includes(gate.context.role)) return { error: t("errors.forbidden") }

  return gate
}

async function getRecurringInvoiceActionContext(): Promise<RecurringInvoiceWriteGate> {
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
