"use server"

import { and, eq, isNotNull, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { database } from "@/database"
import { clients, invoices, projects } from "@/database/schema"

import { resolveRestoreBlocker } from "@/features/trash"

import { emitInvoiceDeleted } from "./events"
import {
  ExpectedInvoiceError,
  handleInvoiceActionError,
  requireInvoiceDelete,
  revalidateInvoicePaths,
  writeInvoiceAudit
} from "./mutationContext"
import { invoiceIdSchema } from "./schemas"
import { type DeleteInvoiceResult } from "./types"

export async function softDeleteInvoice(input: unknown): Promise<DeleteInvoiceResult> {
  const gate = await requireInvoiceDelete()

  if ("error" in gate) return gate

  const parsed = invoiceIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const [deleted] = await database
      .update(invoices)
      .set({ deletedAt: new Date() })
      .where(and(eq(invoices.id, parsed.data.id), isNull(invoices.deletedAt)))
      .returning({
        id: invoices.id,
        projectId: invoices.projectId,
        clientId: invoices.clientId,
        status: invoices.status
      })

    if (!deleted) throw new ExpectedInvoiceError(t("invoices.errors.notFound"))

    await writeInvoiceAudit(context, "invoice.deleted", deleted.id, {
      projectId: deleted.projectId,
      clientId: deleted.clientId,
      status: deleted.status,
      softDeleted: true
    })
    await emitInvoiceDeleted({ invoiceId: deleted.id, userId: context.userId })

    revalidateInvoicePaths(deleted)

    return { data: { id: deleted.id } }
  } catch (error) {
    return handleInvoiceActionError(error, {
      action: "softDeleteInvoice",
      userId: context.userId,
      invoiceId: parsed.data.id,
      fallbackMessage: t("invoices.errors.deleteFailed")
    })
  }
}

export async function restoreInvoice(input: unknown): Promise<DeleteInvoiceResult> {
  const gate = await requireInvoiceDelete()

  if ("error" in gate) return gate

  const parsed = invoiceIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const [existing] = await database
      .select({
        id: invoices.id,
        projectId: invoices.projectId,
        clientId: invoices.clientId,
        status: invoices.status,
        clientDeletedAt: clients.deletedAt,
        projectDeletedAt: projects.deletedAt
      })
      .from(invoices)
      .leftJoin(clients, eq(clients.id, invoices.clientId))
      .leftJoin(projects, eq(projects.id, invoices.projectId))
      .where(and(eq(invoices.id, parsed.data.id), isNotNull(invoices.deletedAt)))

    if (!existing) throw new ExpectedInvoiceError(t("invoices.errors.notFound"))

    const blocker = resolveRestoreBlocker([
      { label: t("trash.entities.client"), deletedAt: existing.clientDeletedAt },
      { label: t("trash.entities.project"), deletedAt: existing.projectDeletedAt }
    ])

    if (blocker) {
      throw new ExpectedInvoiceError(t("trash.errors.restoreBlocked", { parent: blocker }))
    }

    const [restored] = await database
      .update(invoices)
      .set({ deletedAt: null })
      .where(and(eq(invoices.id, existing.id), isNotNull(invoices.deletedAt)))
      .returning({
        id: invoices.id,
        projectId: invoices.projectId,
        clientId: invoices.clientId,
        status: invoices.status
      })

    if (!restored) throw new ExpectedInvoiceError(t("invoices.errors.notFound"))

    await writeInvoiceAudit(context, "invoice.restored", restored.id, {
      projectId: restored.projectId,
      clientId: restored.clientId,
      status: restored.status
    })

    revalidateInvoicePaths(restored)

    return { data: { id: restored.id } }
  } catch (error) {
    return handleInvoiceActionError(error, {
      action: "restoreInvoice",
      userId: context.userId,
      invoiceId: parsed.data.id,
      fallbackMessage: t("trash.errors.restoreFailed")
    })
  }
}
