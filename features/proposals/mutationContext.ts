import { headers } from "next/headers"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole, type Role } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

// The session, role, and audit plumbing every proposal mutation shares, kept beside mutations.ts
// rather than inside it because a "use server" module may export nothing but async functions - the
// error class and the write-context types below could not live there.
export type ProposalWriteContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

export type ProposalWriteGate = { context: ProposalWriteContext } | { error: string }

export type ProposalAuditEvent =
  | "proposal.created"
  | "proposal.updated"
  | "proposal.sent"
  | "proposal.deleted"

export type ProposalActionErrorContext = {
  action: string
  userId: string | null
  proposalId?: string
  fallbackMessage?: string
}

// A failure the user is meant to read: thrown to unwind whatever the action was midway through and
// caught by handleProposalActionError, which passes the message straight back rather than logging it
// as an incident.
export class ExpectedProposalError extends Error {}

// Three named gates over one implementation: an assistant may draft and revise a proposal, but
// issuing it to a client and destroying it are owner-only. The names are what `doctor.config.ts`
// registers as server auth functions, so each call site stays greppable to its privilege level.
export function requireProposalWrite(): Promise<ProposalWriteGate> {
  return requireProposalRole(["owner", "assistant"])
}

export function requireProposalSend(): Promise<ProposalWriteGate> {
  return requireProposalRole(["owner"])
}

export function requireProposalDelete(): Promise<ProposalWriteGate> {
  return requireProposalRole(["owner"])
}

export async function writeProposalAudit(
  context: ProposalWriteContext,
  event: ProposalAuditEvent,
  proposalId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await writeAudit(event, {
    actorUserId: context.userId,
    actorRole: context.role,
    targetEntityType: "proposal",
    targetEntityId: proposalId,
    metadata,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
}

export function handleProposalActionError(
  error: unknown,
  { action, userId, proposalId, fallbackMessage }: ProposalActionErrorContext
): { error: string } {
  if (error instanceof ExpectedProposalError) return { error: error.message }

  logger.error({ action, userId, proposalId, err: error }, "Proposal action failed")

  return { error: fallbackMessage ?? t("proposals.errors.updateFailed") }
}

async function requireProposalRole(allowed: Role[]): Promise<ProposalWriteGate> {
  const gate = await getProposalActionContext()

  if ("error" in gate) return gate

  if (!allowed.includes(gate.context.role)) return { error: t("errors.forbidden") }

  return gate
}

async function getProposalActionContext(): Promise<ProposalWriteGate> {
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
