"use server"

import { and, eq, inArray, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { database } from "@/database"
import { clients, projects, recurringInvoices, taxRates } from "@/database/schema"

import {
  emptyToNull,
  handleRecurringInvoiceActionError,
  requireRecurringInvoiceCancel,
  requireRecurringInvoiceDelete,
  requireRecurringInvoiceWrite,
  revalidateRecurringInvoicePaths,
  writeRecurringInvoiceAudit,
  ExpectedRecurringInvoiceError,
  type RecurringInvoiceAuditEvent,
  type RecurringInvoiceWriteContext
} from "./mutationContext"
import {
  createRecurringInvoiceSchema,
  recurringInvoiceIdSchema,
  updateRecurringInvoiceSchema,
  type CreateRecurringInvoiceValues,
  type RecurringInvoiceStatus,
  type UpdateRecurringInvoiceValues
} from "./schemas"
import { canTransitionRecurringInvoiceStatus, toBlueprintLines } from "./services"
import { type RecurringInvoiceMutationResult } from "./types"

export async function createRecurringInvoice(
  input: unknown
): Promise<RecurringInvoiceMutationResult> {
  const gate = await requireRecurringInvoiceWrite()

  if ("error" in gate) return gate

  const parsed = createRecurringInvoiceSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    await assertParentsExist(parsed.data)

    const taxPercentages = await getTaxPercentages(parsed.data)

    const [created] = await database
      .insert(recurringInvoices)
      .values({
        ...toScheduleColumns(parsed.data),
        lineItemsBlueprint: toBlueprintLines(parsed.data.lineItems, taxPercentages)
      })
      .returning({ id: recurringInvoices.id })

    if (!created) throw new Error("Recurring invoice insert returned no row")

    await writeRecurringInvoiceAudit(context, "recurring_invoice.created", created.id, {
      clientId: parsed.data.clientId,
      projectId: parsed.data.projectId,
      cadence: parsed.data.cadence,
      autoSend: parsed.data.autoSend,
      isRetainer: parsed.data.includedHours !== null,
      lineItemCount: parsed.data.lineItems.length
    })

    revalidateRecurringInvoicePaths({ id: created.id, clientId: parsed.data.clientId })

    return { data: { id: created.id } }
  } catch (error) {
    return handleRecurringInvoiceActionError(error, {
      action: "createRecurringInvoice",
      userId: context.userId,
      fallbackMessage: t("recurringInvoices.errors.createFailed")
    })
  }
}

export async function updateRecurringInvoice(
  input: unknown
): Promise<RecurringInvoiceMutationResult> {
  const gate = await requireRecurringInvoiceWrite()

  if ("error" in gate) return gate

  const parsed = updateRecurringInvoiceSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await loadSchedule(parsed.data.id)

    // A terminal schedule is history. Editing one would rewrite the terms that past invoices were
    // raised under while producing no future ones, so the answer is a new schedule.
    if (existing.status === "completed" || existing.status === "cancelled") {
      throw new ExpectedRecurringInvoiceError(t("recurringInvoices.errors.terminal"))
    }

    await assertParentsExist(parsed.data)

    const taxPercentages = await getTaxPercentages(parsed.data)

    const [updated] = await database
      .update(recurringInvoices)
      .set({
        ...toScheduleColumns(parsed.data),
        lineItemsBlueprint: toBlueprintLines(parsed.data.lineItems, taxPercentages),
        updatedAt: new Date()
      })
      .where(and(eq(recurringInvoices.id, parsed.data.id), isNull(recurringInvoices.deletedAt)))
      .returning({ id: recurringInvoices.id })

    if (!updated) throw new ExpectedRecurringInvoiceError(t("recurringInvoices.errors.notFound"))

    await writeRecurringInvoiceAudit(context, "recurring_invoice.updated", updated.id, {
      clientId: parsed.data.clientId,
      projectId: parsed.data.projectId,
      cadence: parsed.data.cadence,
      autoSend: parsed.data.autoSend,
      isRetainer: parsed.data.includedHours !== null,
      lineItemCount: parsed.data.lineItems.length
    })

    revalidateRecurringInvoicePaths({ id: updated.id, clientId: parsed.data.clientId })

    return { data: { id: updated.id } }
  } catch (error) {
    return handleRecurringInvoiceActionError(error, {
      action: "updateRecurringInvoice",
      userId: context.userId,
      recurringInvoiceId: parsed.data.id,
      fallbackMessage: t("recurringInvoices.errors.updateFailed")
    })
  }
}

export async function pauseRecurringInvoice(
  input: unknown
): Promise<RecurringInvoiceMutationResult> {
  const gate = await requireRecurringInvoiceWrite()

  if ("error" in gate) return gate

  return changeScheduleStatus({
    input,
    context: gate.context,
    nextStatus: "paused",
    event: "recurring_invoice.paused",
    action: "pauseRecurringInvoice"
  })
}

export async function resumeRecurringInvoice(
  input: unknown
): Promise<RecurringInvoiceMutationResult> {
  const gate = await requireRecurringInvoiceWrite()

  if ("error" in gate) return gate

  return changeScheduleStatus({
    input,
    context: gate.context,
    nextStatus: "active",
    event: "recurring_invoice.resumed",
    action: "resumeRecurringInvoice"
  })
}

export async function cancelRecurringInvoice(
  input: unknown
): Promise<RecurringInvoiceMutationResult> {
  const gate = await requireRecurringInvoiceCancel()

  if ("error" in gate) return gate

  return changeScheduleStatus({
    input,
    context: gate.context,
    nextStatus: "cancelled",
    event: "recurring_invoice.cancelled",
    action: "cancelRecurringInvoice"
  })
}

export async function softDeleteRecurringInvoice(
  input: unknown
): Promise<RecurringInvoiceMutationResult> {
  const gate = await requireRecurringInvoiceDelete()

  if ("error" in gate) return gate

  const parsed = recurringInvoiceIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const [deleted] = await database
      .update(recurringInvoices)
      .set({ deletedAt: new Date() })
      .where(and(eq(recurringInvoices.id, parsed.data.id), isNull(recurringInvoices.deletedAt)))
      .returning({ id: recurringInvoices.id, clientId: recurringInvoices.clientId })

    if (!deleted) throw new ExpectedRecurringInvoiceError(t("recurringInvoices.errors.notFound"))

    await writeRecurringInvoiceAudit(context, "recurring_invoice.deleted", deleted.id, {
      clientId: deleted.clientId,
      softDeleted: true
    })

    revalidateRecurringInvoicePaths(deleted)

    return { data: { id: deleted.id } }
  } catch (error) {
    return handleRecurringInvoiceActionError(error, {
      action: "softDeleteRecurringInvoice",
      userId: context.userId,
      recurringInvoiceId: parsed.data.id,
      fallbackMessage: t("recurringInvoices.errors.deleteFailed")
    })
  }
}

type ScheduleStatusChange = {
  input: unknown
  context: RecurringInvoiceWriteContext
  nextStatus: RecurringInvoiceStatus
  event: RecurringInvoiceAuditEvent
  action: string
}

// The three lifecycle actions differ only in target status, audit event and required role, and the
// role is already resolved by the caller's own gate. Sharing the body here keeps the transition
// check in one place; splitting it would give three chances to forget `canTransition`.
async function changeScheduleStatus({
  input,
  context,
  nextStatus,
  event,
  action
}: ScheduleStatusChange): Promise<RecurringInvoiceMutationResult> {
  const parsed = recurringInvoiceIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    const existing = await loadSchedule(parsed.data.id)
    const transition = canTransitionRecurringInvoiceStatus(existing.status, nextStatus)

    if (!transition.allowed) {
      throw new ExpectedRecurringInvoiceError(t("recurringInvoices.errors.invalidTransition"))
    }

    // The previous status is re-checked in the WHERE clause so two concurrent lifecycle actions
    // cannot both believe they made the transition.
    const [changed] = await database
      .update(recurringInvoices)
      .set({ status: transition.nextStatus, updatedAt: new Date() })
      .where(
        and(
          eq(recurringInvoices.id, parsed.data.id),
          eq(recurringInvoices.status, existing.status),
          isNull(recurringInvoices.deletedAt)
        )
      )
      .returning({ id: recurringInvoices.id, clientId: recurringInvoices.clientId })

    if (!changed) {
      throw new ExpectedRecurringInvoiceError(t("recurringInvoices.errors.invalidTransition"))
    }

    await writeRecurringInvoiceAudit(context, event, changed.id, {
      clientId: changed.clientId,
      from: existing.status,
      to: transition.nextStatus
    })

    revalidateRecurringInvoicePaths(changed)

    return { data: { id: changed.id } }
  } catch (error) {
    return handleRecurringInvoiceActionError(error, {
      action,
      userId: context.userId,
      recurringInvoiceId: parsed.data.id,
      fallbackMessage: t("recurringInvoices.errors.updateFailed")
    })
  }
}

async function loadSchedule(id: string): Promise<{ status: RecurringInvoiceStatus }> {
  const existing = await database.query.recurringInvoices.findFirst({
    columns: { status: true },
    where: and(eq(recurringInvoices.id, id), isNull(recurringInvoices.deletedAt))
  })

  if (!existing) throw new ExpectedRecurringInvoiceError(t("recurringInvoices.errors.notFound"))

  return existing
}

type ScheduleWriteValues = CreateRecurringInvoiceValues | UpdateRecurringInvoiceValues

// `end_after_count` and `end_by_date` are written from the discriminator rather than passed through,
// so switching a schedule from one end condition to the other clears the column it is leaving.
// Without that, `chk_recurring_invoices_end_condition` would reject the update for having both set.
function toScheduleColumns(values: ScheduleWriteValues) {
  return {
    name: values.name,
    clientId: values.clientId,
    projectId: values.projectId,
    templateId: values.templateId,
    cadence: values.cadence,
    cadenceDay: values.cadenceDay,
    nextRunAt: values.nextRunAt,
    endAfterCount: values.endCondition === "after_count" ? values.endAfterCount : null,
    endByDate: values.endCondition === "by_date" ? values.endByDate : null,
    autoSend: values.autoSend,
    currency: values.currency,
    includedHours: values.includedHours,
    overageRateCents: values.overageRate,
    notes: emptyToNull(values.notes)
  }
}

async function assertParentsExist(values: ScheduleWriteValues): Promise<void> {
  const client = await database.query.clients.findFirst({
    columns: { id: true },
    where: and(eq(clients.id, values.clientId), isNull(clients.deletedAt))
  })

  if (!client) throw new ExpectedRecurringInvoiceError(t("recurringInvoices.errors.clientNotFound"))

  if (values.projectId === null) return

  // The project is checked against the schedule's own client rather than merely existing: a schedule
  // billing client A from client B's project would put the two clients' work on one invoice.
  const project = await database.query.projects.findFirst({
    columns: { id: true },
    where: and(
      eq(projects.id, values.projectId),
      eq(projects.clientId, values.clientId),
      isNull(projects.deletedAt)
    )
  })

  if (!project) {
    throw new ExpectedRecurringInvoiceError(t("recurringInvoices.errors.projectNotFound"))
  }
}

async function getTaxPercentages(values: ScheduleWriteValues): Promise<Map<string, number>> {
  const ids = [
    ...new Set(
      values.lineItems.flatMap((item) => (item.taxRateId === null ? [] : [item.taxRateId]))
    )
  ]

  if (ids.length === 0) return new Map()

  const rows = await database
    .select({ id: taxRates.id, percentage: taxRates.percentage })
    .from(taxRates)
    .where(and(inArray(taxRates.id, ids), isNull(taxRates.deletedAt)))

  if (rows.length !== ids.length) {
    throw new ExpectedRecurringInvoiceError(t("recurringInvoices.errors.taxRateInvalid"))
  }

  return new Map(rows.map((row) => [row.id, Number(row.percentage)]))
}
