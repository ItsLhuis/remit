import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { sql } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole, type Role } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

import { type database } from "@/database"
import { settings } from "@/database/schema"

import { generateCreditNoteNumber } from "./services"

// The session, role, numbering, audit and revalidation plumbing the credit-note write paths share,
// kept beside mutations.ts rather than inside it because a "use server" module may export nothing
// but async functions — the error class, the synchronous helpers and the types below could not live
// there.
export type CreditNoteWriteContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

export type CreditNoteWriteGate = { context: CreditNoteWriteContext } | { error: string }

export type CreditNoteAuditEvent = "credit_note.created" | "credit_note.deleted"

export type CreditNoteActionErrorContext = {
  action: string
  userId: string | null
  creditNoteId?: string
  fallbackMessage: string
}

export type CreditNoteInvoiceRef = {
  id: string
  projectId: string | null
  clientId: string | null
}

export type CreditNoteTransaction = Parameters<Parameters<typeof database.transaction>[0]>[0]

// A failure the user is meant to read: thrown to unwind whatever the action was midway through and
// caught by handleCreditNoteActionError, which passes the message straight back rather than logging
// it as an incident.
export class ExpectedCreditNoteError extends Error {}

// Issuing a credit note reduces what a client owes, which is the accountant's job as much as the
// owner's — the same population that may record a payment. Destroying the record of that reduction
// is owner-only. The names are what `doctor.config.ts` registers as server auth functions, so each
// call site stays greppable to its privilege level.
export function requireCreditNoteWrite(): Promise<CreditNoteWriteGate> {
  return requireCreditNoteRole(["owner", "accountant"])
}

export function requireCreditNoteDelete(): Promise<CreditNoteWriteGate> {
  return requireCreditNoteRole(["owner"])
}

// A single atomic increment rather than read-then-write: two concurrent issues that both read the
// same `next_credit_note_number` would mint the same number and one would fail the unique index on
// `credit_notes.number`. The returned value is the counter *after* the bump, so the number this call
// owns is one below it. Running inside the caller's transaction is what makes a failed issue give
// the number back instead of burning it.
export async function claimCreditNoteNumber(transaction: CreditNoteTransaction): Promise<string> {
  const [row] = await transaction
    .update(settings)
    .set({ nextCreditNoteNumber: sql`${settings.nextCreditNoteNumber} + 1` })
    .returning({
      nextNumber: settings.nextCreditNoteNumber,
      prefix: settings.creditNotePrefix,
      paddingWidth: settings.numberPaddingWidth
    })

  if (!row) throw new ExpectedCreditNoteError(t("creditNotes.errors.settingsMissing"))

  return generateCreditNoteNumber({
    prefix: row.prefix,
    paddingWidth: row.paddingWidth,
    nextSequence: row.nextNumber - 1
  })
}

export async function writeCreditNoteAudit(
  context: CreditNoteWriteContext,
  event: CreditNoteAuditEvent,
  creditNoteId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await writeAudit(event, {
    actorUserId: context.userId,
    actorRole: context.role,
    targetEntityType: "credit_note",
    targetEntityId: creditNoteId,
    metadata,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
}

export function handleCreditNoteActionError(
  error: unknown,
  { action, userId, creditNoteId, fallbackMessage }: CreditNoteActionErrorContext
): { error: string } {
  if (error instanceof ExpectedCreditNoteError) return { error: error.message }

  logger.error({ action, userId, creditNoteId, err: error }, "Credit note action failed")

  return { error: fallbackMessage }
}

// The invoice routes rather than only the credit-note ones: a credit note changes what its invoice
// is still owed, and that figure is printed on the invoice detail, its project's list and the
// instance-wide overview. The parent paths are conditional because an invoice has a project, a
// client, or one of each — never necessarily both (`chk_invoices_parent`).
export function revalidateCreditNotePaths(invoice: CreditNoteInvoiceRef): void {
  if (invoice.projectId) {
    revalidatePath(`/projects/${invoice.projectId}/invoices/${invoice.id}`)
    revalidatePath(`/projects/${invoice.projectId}/invoices`)
    revalidatePath(`/projects/${invoice.projectId}`)
  }

  if (invoice.clientId) revalidatePath(`/clients/${invoice.clientId}`)

  revalidatePath("/invoices")
  revalidatePath("/credit-notes")
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}

async function requireCreditNoteRole(allowed: Role[]): Promise<CreditNoteWriteGate> {
  const gate = await getCreditNoteActionContext()

  if ("error" in gate) return gate

  if (!allowed.includes(gate.context.role)) return { error: t("errors.forbidden") }

  return gate
}

async function getCreditNoteActionContext(): Promise<CreditNoteWriteGate> {
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
