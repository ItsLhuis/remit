import { headers } from "next/headers"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole, type Role } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

// The session, audit and error-mapping plumbing every client write path shares, kept beside
// mutations.ts rather than inside it for the reason `features/payments/mutationContext.ts` gives: a
// `"use server"` module may export nothing but async functions, so the synchronous helpers, the
// types and the error class below could not live there. Splitting it also keeps `mutations.ts` and
// `imageMutations.ts` reading from one gate instead of two copies.
export type ClientWriteContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

export type ClientWriteGate = { context: ClientWriteContext } | { error: string }

export type ClientAuditEvent =
  | "client.created"
  | "client.updated"
  | "client.deleted"
  | "client.portal_link.rotated"
  | "client.portal_link.revoked"

// A contact write is audited on the same footing as a client write, and for a stronger reason than
// symmetry: since ADR-0027 a contact address both receives this client's documents and may accept
// its proposals, so adding one grants an acting identity and removing one revokes it.
export type ClientContactAuditEvent =
  | "client_contact.created"
  | "client_contact.updated"
  | "client_contact.deleted"
  | "client_contact.primary_changed"

// Thrown for the states a caller can act on, so `handleClientActionError` can tell them from the
// unexpected failures it logs and flattens into one message.
export class ExpectedClientError extends Error {}

// Three named gates over one implementation, like every other feature's `mutationContext.ts`. The
// names are what `doctor.config.ts` registers as server auth functions, so each call site stays
// greppable to its privilege level. An assistant drafts and edits; only the owner destroys — and
// only the owner touches the portal link, because a standing bearer credential to everything Remit
// holds about a client is a transmit decision rather than an edit (ARCHITECTURE.md's role table
// refuses `send` and `transmit` to both other roles).
export function requireClientWrite(): Promise<ClientWriteGate> {
  return requireClientRole(["owner", "assistant"])
}

export function requireClientDelete(): Promise<ClientWriteGate> {
  return requireClientRole(["owner"])
}

export function requireClientPortalLink(): Promise<ClientWriteGate> {
  return requireClientRole(["owner"])
}

export async function writeClientAudit(
  context: ClientWriteContext,
  event: ClientAuditEvent,
  clientId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await writeAudit(event, {
    actorUserId: context.userId,
    actorRole: context.role,
    targetEntityType: "client",
    targetEntityId: clientId,
    metadata,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
}

export function handleClientActionError(
  error: unknown,
  action: string,
  userId: string | null,
  clientId?: string
): { error: string } {
  if (error instanceof ExpectedClientError) return { error: error.message }

  logger.error({ action, userId, clientId, err: error }, "Client action failed")

  return { error: t("clients.errors.updateFailed") }
}

async function requireClientRole(allowed: Role[]): Promise<ClientWriteGate> {
  const gate = await getClientActionContext()

  if ("error" in gate) return gate

  if (!allowed.includes(gate.context.role)) return { error: t("errors.forbidden") }

  return gate
}

async function getClientActionContext(): Promise<ClientWriteGate> {
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
