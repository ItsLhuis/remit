"use server"

import { and, eq, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { mintPublicToken } from "@/lib/publicToken"

import { database } from "@/database"
import { proposals } from "@/database/schema"

import {
  handleProposalActionError,
  requireProposalPublicLink,
  revalidateProposalPaths,
  writeProposalAudit,
  ExpectedProposalError
} from "./mutationContext"
import { proposalIdSchema } from "./schemas"
import { type ProposalPublicLinkResult } from "./types"

// The lifecycle of `/p/[token]`, kept out of mutations.ts because it answers to a different
// question: those actions change what the proposal *says*, these change who can still read it
// (ADR-0029). Rotation and revocation are one pair of operations shared by all four token holders;
// the client portal's pair lives in `features/clients/mutations.ts`, whose file length left no
// reason to split it out.

export async function rotateProposalPublicLink(input: unknown): Promise<ProposalPublicLinkResult> {
  const gate = await requireProposalPublicLink()

  if ("error" in gate) return gate

  const parsed = proposalIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await loadIssuedProposalForPublicLink(parsed.data.id)

    const [rotated] = await database
      .update(proposals)
      .set({ publicToken: mintPublicToken() })
      .where(and(eq(proposals.id, existing.id), isNull(proposals.deletedAt)))
      .returning({
        id: proposals.id,
        projectId: proposals.projectId,
        clientId: proposals.clientId
      })

    if (!rotated) throw new ExpectedProposalError(t("proposals.errors.notFound"))

    // Records that the link changed and what it changed from, never either token: the audit trail is
    // readable by anyone with database access, and the old and new values are both bearer
    // credentials for `/p/[token]` (`security.md`).
    await writeProposalAudit(context, "proposal.public_link.rotated", rotated.id, {
      projectId: rotated.projectId,
      clientId: rotated.clientId,
      previousState: existing.publicToken ? "live" : "none"
    })

    revalidateProposalPaths(rotated, rotated.id)

    return { data: { id: rotated.id } }
  } catch (error) {
    return handleProposalActionError(error, {
      action: "rotateProposalPublicLink",
      userId: context.userId,
      proposalId: parsed.data.id,
      fallbackMessage: t("proposals.errors.publicLinkFailed")
    })
  }
}

export async function revokeProposalPublicLink(input: unknown): Promise<ProposalPublicLinkResult> {
  const gate = await requireProposalPublicLink()

  if ("error" in gate) return gate

  const parsed = proposalIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await loadIssuedProposalForPublicLink(parsed.data.id)

    if (!existing.publicToken) {
      throw new ExpectedProposalError(t("proposals.errors.publicLinkAlreadyRevoked"))
    }

    const [revoked] = await database
      .update(proposals)
      .set({ publicToken: null })
      .where(and(eq(proposals.id, existing.id), isNull(proposals.deletedAt)))
      .returning({
        id: proposals.id,
        projectId: proposals.projectId,
        clientId: proposals.clientId
      })

    if (!revoked) throw new ExpectedProposalError(t("proposals.errors.notFound"))

    await writeProposalAudit(context, "proposal.public_link.revoked", revoked.id, {
      projectId: revoked.projectId,
      clientId: revoked.clientId
    })

    revalidateProposalPaths(revoked, revoked.id)

    return { data: { id: revoked.id } }
  } catch (error) {
    return handleProposalActionError(error, {
      action: "revokeProposalPublicLink",
      userId: context.userId,
      proposalId: parsed.data.id,
      fallbackMessage: t("proposals.errors.publicLinkFailed")
    })
  }
}

// Both link actions refuse a proposal that was never issued. Its token exists from draft creation
// but has never left the instance (SCHEMA.md's `public_token` note), so there is no URL to withdraw
// and rotating one would invalidate nothing.
async function loadIssuedProposalForPublicLink(proposalId: string) {
  const proposal = await database.query.proposals.findFirst({
    where: and(eq(proposals.id, proposalId), isNull(proposals.deletedAt)),
    columns: { id: true, issuedAt: true, publicToken: true }
  })

  if (!proposal) throw new ExpectedProposalError(t("proposals.errors.notFound"))

  if (!proposal.issuedAt) {
    throw new ExpectedProposalError(t("proposals.errors.publicLinkNotIssued"))
  }

  return proposal
}
