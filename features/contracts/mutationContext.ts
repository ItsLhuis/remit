import { headers } from "next/headers"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole, type Role } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

// The session, role, and audit plumbing every contract mutation shares, kept beside mutations.ts
// rather than inside it because a "use server" module may export nothing but async functions - the
// error class and the write-context types below could not live there.
export type ContractWriteContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

export type ContractWriteGate = { context: ContractWriteContext } | { error: string }

export type ContractAuditEvent =
  | "contract.created"
  | "contract.updated"
  | "contract.sent"
  | "contract.terminated"
  | "contract.deleted"

export type ContractActionErrorContext = {
  action: string
  userId: string | null
  contractId?: string
  fallbackMessage?: string
}

// A failure the user is meant to read: thrown to unwind whatever the action was midway through and
// caught by handleContractActionError, which passes the message straight back rather than logging it
// as an incident.
export class ExpectedContractError extends Error {}

// Four named gates over one implementation: an assistant may draft and revise a contract, but
// issuing it to a counterparty, ending it, and destroying it are owner-only. The names are what
// `doctor.config.ts` registers as server auth functions, so each call site stays greppable to its
// privilege level.
export function requireContractWrite(): Promise<ContractWriteGate> {
  return requireContractRole(["owner", "assistant"])
}

export function requireContractSend(): Promise<ContractWriteGate> {
  return requireContractRole(["owner"])
}

export function requireContractTerminate(): Promise<ContractWriteGate> {
  return requireContractRole(["owner"])
}

export function requireContractDelete(): Promise<ContractWriteGate> {
  return requireContractRole(["owner"])
}

export async function writeContractAudit(
  context: ContractWriteContext,
  event: ContractAuditEvent,
  contractId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await writeAudit(event, {
    actorUserId: context.userId,
    actorRole: context.role,
    targetEntityType: "contract",
    targetEntityId: contractId,
    metadata,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
}

export function handleContractActionError(
  error: unknown,
  { action, userId, contractId, fallbackMessage }: ContractActionErrorContext
): { error: string } {
  if (error instanceof ExpectedContractError) return { error: error.message }

  logger.error({ action, userId, contractId, err: error }, "Contract action failed")

  return { error: fallbackMessage ?? t("contracts.errors.updateFailed") }
}

async function requireContractRole(allowed: Role[]): Promise<ContractWriteGate> {
  const gate = await getContractActionContext()

  if ("error" in gate) return gate

  if (!allowed.includes(gate.context.role)) return { error: t("errors.forbidden") }

  return gate
}

async function getContractActionContext(): Promise<ContractWriteGate> {
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
