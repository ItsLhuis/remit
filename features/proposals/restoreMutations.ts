"use server"

import { and, eq, isNotNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { database } from "@/database"
import { clients, projects, proposals } from "@/database/schema"

import { resolveRestoreBlocker } from "@/features/trash"

import {
  ExpectedProposalError,
  handleProposalActionError,
  requireProposalDelete,
  revalidateProposalPaths,
  writeProposalAudit
} from "./mutationContext"
import { type DeleteProposalResult } from "./mutations"
import { proposalIdSchema } from "./schemas"

// Split out of mutations.ts rather than sitting beside its `softDelete` sibling, which is where
// `actions.md` would put it: that file is already at the 500-line lint ceiling and one more action
// crosses it.

export async function restoreProposal(input: unknown): Promise<DeleteProposalResult> {
  const gate = await requireProposalDelete()

  if ("error" in gate) return gate

  const parsed = proposalIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const [existing] = await database
      .select({
        id: proposals.id,
        projectId: proposals.projectId,
        clientId: proposals.clientId,
        status: proposals.status,
        clientDeletedAt: clients.deletedAt,
        projectDeletedAt: projects.deletedAt
      })
      .from(proposals)
      .leftJoin(clients, eq(clients.id, proposals.clientId))
      .leftJoin(projects, eq(projects.id, proposals.projectId))
      .where(and(eq(proposals.id, parsed.data.id), isNotNull(proposals.deletedAt)))

    if (!existing) throw new ExpectedProposalError(t("proposals.errors.notFound"))

    const blocker = resolveRestoreBlocker([
      { label: t("trash.entities.client"), deletedAt: existing.clientDeletedAt },
      { label: t("trash.entities.project"), deletedAt: existing.projectDeletedAt }
    ])

    if (blocker) {
      throw new ExpectedProposalError(t("trash.errors.restoreBlocked", { parent: blocker }))
    }

    const [restored] = await database
      .update(proposals)
      .set({ deletedAt: null })
      .where(and(eq(proposals.id, existing.id), isNotNull(proposals.deletedAt)))
      .returning({
        id: proposals.id,
        projectId: proposals.projectId,
        clientId: proposals.clientId,
        status: proposals.status
      })

    if (!restored) throw new ExpectedProposalError(t("proposals.errors.notFound"))

    await writeProposalAudit(context, "proposal.restored", restored.id, {
      projectId: restored.projectId,
      clientId: restored.clientId,
      status: restored.status
    })

    revalidateProposalPaths(restored, restored.id)

    return { data: { id: restored.id } }
  } catch (error) {
    return handleProposalActionError(error, {
      action: "restoreProposal",
      userId: context.userId,
      proposalId: parsed.data.id
    })
  }
}
