"use server"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { eq } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

import { database } from "@/database"
import { settings } from "@/database/schema"

import { restoreClient, restoreClientContact } from "@/features/clients/server"

import { restoreContract } from "@/features/contracts/server"

import { restoreCreditNote } from "@/features/creditNotes/server"

import { restoreExpense } from "@/features/expenses/server"

import { restoreInvoice } from "@/features/invoices/server"

import { restoreLead } from "@/features/leads/server"

import { restorePayment } from "@/features/payments/server"

import { restoreProject } from "@/features/projects/server"

import { restoreProposal } from "@/features/proposals/server"

import { restoreRecurringInvoice } from "@/features/recurringInvoices/server"

import { restoreTaxRate } from "@/features/settings/server"

import { restoreTask } from "@/features/tasks/server"

import { restoreTemplate } from "@/features/templates/server"

import { restoreTimeEntry } from "@/features/timeTracking/server"

import { restoreTrashedRecordSchema, retentionPolicyFormSchema } from "./schemas"
import { type RetentionPolicy } from "./services"

export type RestoreTrashedRecordResult = { data: { id: string } } | { error: string }

// One action for a surface that lists fifteen kinds of record, dispatching to the feature that owns
// each one. The alternative — importing fifteen actions into the client component — would pull
// fifteen server barrels into the client graph, and every one of them re-exports queries that reach
// `@/database`. Each feature keeps its own gate, its own audit entry and its own revalidation; this
// function decides nothing except which of them to call.
export async function restoreTrashedRecord(input: unknown): Promise<RestoreTrashedRecordResult> {
  const parsed = restoreTrashedRecordSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { id, kind } = parsed.data

  switch (kind) {
    case "client":
      return restoreClient({ id })
    case "clientContact":
      return restoreClientContact({ id })
    case "contract":
      return restoreContract({ id })
    case "creditNote":
      return restoreCreditNote({ id })
    case "expense":
      return restoreExpense({ id })
    case "invoice":
      return restoreInvoice({ id })
    case "lead":
      return restoreLead({ id })
    case "payment":
      return restorePayment({ id })
    case "project":
      return restoreProject({ id })
    case "proposal":
      return restoreProposal({ id })
    case "recurringInvoice":
      return restoreRecurringInvoice({ id })
    case "task":
      return restoreTask({ id })
    case "taxRate":
      return restoreTaxRate({ id })
    case "template":
      return restoreTemplate({ id })
    case "timeEntry":
      return restoreTimeEntry({ id })
  }
}

export type SaveRetentionPolicyResult = { data: { policy: RetentionPolicy } } | { error: string }

// The retention window lives with the purge it drives rather than in a settings sub-feature, because
// the two are one decision: the columns mean nothing without the sweep in jobs.ts, and the page
// renders the window beside the trash it empties.
export async function saveRetentionPolicy(input: unknown): Promise<SaveRetentionPolicyResult> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) return { error: t("errors.unauthorized") }

  const role = await getCurrentRole({ headers: requestHeaders, userId: session.user.id })

  // Owner-only, and not by symmetry with the other settings surfaces: this is the one control in
  // Remit that schedules permanent destruction of records nobody has asked to destroy again.
  if (role !== "owner") return { error: t("errors.forbidden") }

  const parsed = retentionPolicyFormSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const policy: RetentionPolicy = {
    trashDays: parsed.data.trashDays,
    financialDays: parsed.data.financialDays
  }

  try {
    const existing = await database.query.settings.findFirst({ columns: { id: true } })

    if (existing) {
      await database
        .update(settings)
        .set({
          retentionTrashDays: policy.trashDays,
          retentionFinancialDays: policy.financialDays
        })
        .where(eq(settings.id, existing.id))
    } else {
      await database.insert(settings).values({
        retentionTrashDays: policy.trashDays,
        retentionFinancialDays: policy.financialDays
      })
    }

    await writeAudit("settings.retention.updated", {
      actorUserId: session.user.id,
      actorRole: role,
      targetEntityType: "settings",
      targetEntityId: existing?.id ?? null,
      metadata: {
        retentionTrashDays: policy.trashDays,
        retentionFinancialDays: policy.financialDays
      },
      ipAddress: getIpAddress(requestHeaders),
      userAgent: requestHeaders.get("user-agent")
    })

    revalidatePath("/settings/data")

    return { data: { policy } }
  } catch (error) {
    logger.error(
      { action: "saveRetentionPolicy", userId: session.user.id, err: error },
      "Retention policy save failed"
    )

    return { error: t("trash.retention.errors.saveFailed") }
  }
}
