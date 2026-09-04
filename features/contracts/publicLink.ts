"use server"

import { and, eq, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { mintPublicToken } from "@/lib/publicToken"

import { database } from "@/database"
import { contracts } from "@/database/schema"

import {
  handleContractActionError,
  requireContractPublicLink,
  revalidateContractPaths,
  writeContractAudit,
  ExpectedContractError
} from "./mutationContext"
import { contractIdSchema } from "./schemas"
import { type ContractPublicLinkResult } from "./types"

// The lifecycle of `/c/[token]`, kept out of mutations.ts because it answers to a different
// question: those actions change what the contract *says*, these change who can still read it
// (ADR-0029). Rotation and revocation are one pair of operations shared by all four token holders;
// the client portal's pair lives in `features/clients/mutations.ts`, whose file length left no
// reason to split it out.

export async function rotateContractPublicLink(input: unknown): Promise<ContractPublicLinkResult> {
  const gate = await requireContractPublicLink()

  if ("error" in gate) return gate

  const parsed = contractIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await loadIssuedContractForPublicLink(parsed.data.id)

    const [rotated] = await database
      .update(contracts)
      .set({ publicToken: mintPublicToken() })
      .where(and(eq(contracts.id, existing.id), isNull(contracts.deletedAt)))
      .returning({
        id: contracts.id,
        projectId: contracts.projectId,
        clientId: contracts.clientId
      })

    if (!rotated) throw new ExpectedContractError(t("contracts.errors.notFound"))

    // Records that the link changed and what it changed from, never either token: the audit trail is
    // readable by anyone with database access, and the old and new values are both bearer
    // credentials for `/c/[token]` (`security.md`).
    await writeContractAudit(context, "contract.public_link.rotated", rotated.id, {
      projectId: rotated.projectId,
      clientId: rotated.clientId,
      previousState: existing.publicToken ? "live" : "none"
    })

    revalidateContractPaths(rotated)

    return { data: { id: rotated.id } }
  } catch (error) {
    return handleContractActionError(error, {
      action: "rotateContractPublicLink",
      userId: context.userId,
      contractId: parsed.data.id,
      fallbackMessage: t("contracts.errors.publicLinkFailed")
    })
  }
}

export async function revokeContractPublicLink(input: unknown): Promise<ContractPublicLinkResult> {
  const gate = await requireContractPublicLink()

  if ("error" in gate) return gate

  const parsed = contractIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await loadIssuedContractForPublicLink(parsed.data.id)

    if (!existing.publicToken) {
      throw new ExpectedContractError(t("contracts.errors.publicLinkAlreadyRevoked"))
    }

    const [revoked] = await database
      .update(contracts)
      .set({ publicToken: null })
      .where(and(eq(contracts.id, existing.id), isNull(contracts.deletedAt)))
      .returning({
        id: contracts.id,
        projectId: contracts.projectId,
        clientId: contracts.clientId
      })

    if (!revoked) throw new ExpectedContractError(t("contracts.errors.notFound"))

    await writeContractAudit(context, "contract.public_link.revoked", revoked.id, {
      projectId: revoked.projectId,
      clientId: revoked.clientId
    })

    revalidateContractPaths(revoked)

    return { data: { id: revoked.id } }
  } catch (error) {
    return handleContractActionError(error, {
      action: "revokeContractPublicLink",
      userId: context.userId,
      contractId: parsed.data.id,
      fallbackMessage: t("contracts.errors.publicLinkFailed")
    })
  }
}

// Both link actions refuse a contract that was never issued. Its token exists from draft creation
// but has never left the instance, so there is no URL to withdraw and rotating one would invalidate
// nothing. A terminated or signed contract is still allowed: the token is not contract content, so
// the immutability its status carries does not reach it.
async function loadIssuedContractForPublicLink(contractId: string) {
  const contract = await database.query.contracts.findFirst({
    where: and(eq(contracts.id, contractId), isNull(contracts.deletedAt)),
    columns: { id: true, issuedAt: true, publicToken: true }
  })

  if (!contract) throw new ExpectedContractError(t("contracts.errors.notFound"))

  if (!contract.issuedAt) {
    throw new ExpectedContractError(t("contracts.errors.publicLinkNotIssued"))
  }

  return contract
}
