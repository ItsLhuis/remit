import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole, type Role } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

import { claimInvoiceNumber, ExpectedInvoiceError, type InvoiceTransaction } from "./invoiceWrites"
import { getInvoiceForEdit } from "./queries"
import { type InvoiceMutationResult } from "./types"

// Re-exported rather than moved-and-updated at every call site: these three now live in
// invoiceWrites.ts so the background worker can reach them without pulling in `next/cache` and
// `next/headers`, which this module imports and a worker process cannot satisfy.
export { claimInvoiceNumber, ExpectedInvoiceError, type InvoiceTransaction }

// The session, role, numbering, audit, and revalidation plumbing the invoice write paths share,
// kept beside mutations.ts and conversion.ts rather than inside either because a "use server" module
// may export nothing but async functions — the error class, the synchronous helpers, and the
// write-context types below could not live there.
export type InvoiceWriteContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

export type InvoiceWriteGate = { context: InvoiceWriteContext } | { error: string }

export type InvoiceAuditEvent =
  | "invoice.created"
  | "invoice.updated"
  | "invoice.sent"
  | "invoice.paid"
  | "invoice.deleted"

export type InvoiceActionErrorContext = {
  action: string
  userId: string | null
  invoiceId?: string
  fallbackMessage?: string
}

export type InvoiceParentIds = {
  projectId: string | null
  clientId: string | null
}

// Four named gates over one implementation. An assistant may draft and revise an invoice, but
// issuing a numbered document to a client and destroying one are owner-only; recording that money
// arrived is the accountant's job as much as the owner's. The names are what `doctor.config.ts`
// registers as server auth functions, so each call site stays greppable to its privilege level.
export function requireInvoiceWrite(): Promise<InvoiceWriteGate> {
  return requireInvoiceRole(["owner", "assistant"])
}

export function requireInvoiceSend(): Promise<InvoiceWriteGate> {
  return requireInvoiceRole(["owner"])
}

export function requireInvoiceMarkPaid(): Promise<InvoiceWriteGate> {
  return requireInvoiceRole(["owner", "accountant"])
}

export function requireInvoiceDelete(): Promise<InvoiceWriteGate> {
  return requireInvoiceRole(["owner"])
}

export async function loadInvoiceResult(invoiceId: string): Promise<InvoiceMutationResult> {
  const invoice = await getInvoiceForEdit({ id: invoiceId })

  if (!invoice) throw new ExpectedInvoiceError(t("invoices.errors.notFound"))

  return { data: { invoice } }
}

export async function writeInvoiceAudit(
  context: InvoiceWriteContext,
  event: InvoiceAuditEvent,
  invoiceId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await writeAudit(event, {
    actorUserId: context.userId,
    actorRole: context.role,
    targetEntityType: "invoice",
    targetEntityId: invoiceId,
    metadata,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
}

export function handleInvoiceActionError(
  error: unknown,
  { action, userId, invoiceId, fallbackMessage }: InvoiceActionErrorContext
): { error: string } {
  if (error instanceof ExpectedInvoiceError) return { error: error.message }

  logger.error({ action, userId, invoiceId, err: error }, "Invoice action failed")

  return { error: fallbackMessage ?? t("invoices.errors.updateFailed") }
}

// An invoice is reachable from its project's invoice list and its own detail route, and both the
// project and the client it names summarise it, so all of them go stale on a write. The parent paths
// are conditional because an invoice has a project, a client, or one of each — never necessarily
// both (`chk_invoices_parent`).
export function revalidateInvoicePaths(invoice: { id: string } & InvoiceParentIds): void {
  if (invoice.projectId) {
    revalidatePath(`/projects/${invoice.projectId}/invoices/${invoice.id}`)
    revalidatePath(`/projects/${invoice.projectId}/invoices`)
    revalidatePath(`/projects/${invoice.projectId}`)
  }

  if (invoice.clientId) revalidatePath(`/clients/${invoice.clientId}`)
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}

async function requireInvoiceRole(allowed: Role[]): Promise<InvoiceWriteGate> {
  const gate = await getInvoiceActionContext()

  if ("error" in gate) return gate

  if (!allowed.includes(gate.context.role)) return { error: t("errors.forbidden") }

  return gate
}

async function getInvoiceActionContext(): Promise<InvoiceWriteGate> {
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
