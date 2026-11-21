"use server"

import { and, eq, isNotNull, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { database } from "@/database"
import { clients, contracts, projects } from "@/database/schema"

import { resolveRestoreBlocker } from "@/features/trash"

import { emitContractDeleted } from "./events"
import {
  ExpectedContractError,
  handleContractActionError,
  requireContractDelete,
  revalidateContractPaths,
  writeContractAudit
} from "./mutationContext"
import { contractIdSchema } from "./schemas"

export type DeleteContractResult = { data: { id: string } } | { error: string }

export async function softDeleteContract(input: unknown): Promise<DeleteContractResult> {
  const gate = await requireContractDelete()

  if ("error" in gate) return gate

  const parsed = contractIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const [deleted] = await database
      .update(contracts)
      .set({ deletedAt: new Date() })
      .where(and(eq(contracts.id, parsed.data.id), isNull(contracts.deletedAt)))
      .returning({
        id: contracts.id,
        projectId: contracts.projectId,
        clientId: contracts.clientId,
        status: contracts.status
      })

    if (!deleted) throw new ExpectedContractError(t("contracts.errors.notFound"))

    await writeContractAudit(context, "contract.deleted", deleted.id, {
      projectId: deleted.projectId,
      clientId: deleted.clientId,
      status: deleted.status,
      softDeleted: true
    })
    await emitContractDeleted({ contractId: deleted.id, userId: context.userId })

    revalidateContractPaths(deleted)

    return { data: { id: deleted.id } }
  } catch (error) {
    return handleContractActionError(error, {
      action: "softDeleteContract",
      userId: context.userId,
      contractId: parsed.data.id,
      fallbackMessage: t("contracts.errors.deleteFailed")
    })
  }
}

export async function restoreContract(input: unknown): Promise<DeleteContractResult> {
  const gate = await requireContractDelete()

  if ("error" in gate) return gate

  const parsed = contractIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const [existing] = await database
      .select({
        id: contracts.id,
        projectId: contracts.projectId,
        clientId: contracts.clientId,
        status: contracts.status,
        clientDeletedAt: clients.deletedAt,
        projectDeletedAt: projects.deletedAt
      })
      .from(contracts)
      .leftJoin(clients, eq(clients.id, contracts.clientId))
      .leftJoin(projects, eq(projects.id, contracts.projectId))
      .where(and(eq(contracts.id, parsed.data.id), isNotNull(contracts.deletedAt)))

    if (!existing) throw new ExpectedContractError(t("contracts.errors.notFound"))

    const blocker = resolveRestoreBlocker([
      { label: t("trash.entities.client"), deletedAt: existing.clientDeletedAt },
      { label: t("trash.entities.project"), deletedAt: existing.projectDeletedAt }
    ])

    if (blocker) {
      throw new ExpectedContractError(t("trash.errors.restoreBlocked", { parent: blocker }))
    }

    const [restored] = await database
      .update(contracts)
      .set({ deletedAt: null })
      .where(and(eq(contracts.id, existing.id), isNotNull(contracts.deletedAt)))
      .returning({
        id: contracts.id,
        projectId: contracts.projectId,
        clientId: contracts.clientId,
        status: contracts.status
      })

    if (!restored) throw new ExpectedContractError(t("contracts.errors.notFound"))

    await writeContractAudit(context, "contract.restored", restored.id, {
      projectId: restored.projectId,
      clientId: restored.clientId,
      status: restored.status
    })

    revalidateContractPaths(restored)

    return { data: { id: restored.id } }
  } catch (error) {
    return handleContractActionError(error, {
      action: "restoreContract",
      userId: context.userId,
      contractId: parsed.data.id,
      fallbackMessage: t("trash.errors.restoreFailed")
    })
  }
}
