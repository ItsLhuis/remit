"use server"

import { randomBytes } from "node:crypto"

import { and, eq, inArray, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { enqueueJob } from "@/lib/jobs"

import { database } from "@/database"
import { invoices, lineItems, projects, taxRates } from "@/database/schema"

import { recordInvoiceSettlement } from "@/features/payments/server"

import {
  emitInvoiceCreated,
  emitInvoiceDeleted,
  emitInvoicePaid,
  emitInvoiceSent,
  emitInvoiceUpdated
} from "./events"
import { writeInvoiceLineItems, type InvoiceLineItemRow } from "./invoiceWrites"
import {
  claimInvoiceNumber,
  emptyToNull,
  handleInvoiceActionError,
  loadInvoiceResult,
  requireInvoiceDelete,
  requireInvoiceMarkPaid,
  requireInvoiceSend,
  requireInvoiceWrite,
  revalidateInvoicePaths,
  writeInvoiceAudit,
  ExpectedInvoiceError
} from "./mutationContext"
import {
  createInvoiceSchema,
  invoiceIdSchema,
  updateInvoiceSchema,
  type CreateInvoiceValues,
  type UpdateInvoiceValues
} from "./schemas"
import {
  calculateInvoiceTotal,
  canTransitionInvoiceStatus,
  isInvoiceEditable,
  resolveInvoiceIssueDates,
  toInvoiceDiscount,
  toInvoiceDiscountColumns,
  type InvoiceLineItemInput
} from "./services"
import {
  type DeleteInvoiceResult,
  type InvoiceMutationResult,
  type MarkInvoicePaidResult,
  type SendInvoiceResult
} from "./types"

type InvoiceWriteValues = CreateInvoiceValues | UpdateInvoiceValues

const AUDIT_FIELDS = [
  "currency",
  "templateId",
  "issueDate",
  "dueDate",
  "notes",
  "discountKind"
] as const

export async function createInvoice(input: unknown): Promise<InvoiceMutationResult> {
  const gate = await requireInvoiceWrite()

  if ("error" in gate) return gate

  const parsed = createInvoiceSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const project = await database.query.projects.findFirst({
      where: and(eq(projects.id, parsed.data.projectId), isNull(projects.deletedAt)),
      columns: { id: true, clientId: true }
    })

    if (!project) throw new ExpectedInvoiceError(t("invoices.errors.projectNotFound"))

    const taxPercentages = await getTaxPercentages(parsed.data)
    const totals = calculateInvoiceTotal(
      toLineItemInputs(parsed.data, taxPercentages),
      toInvoiceDiscount(parsed.data)
    )

    const invoiceId = await database.transaction(async (transaction) => {
      const number = await claimInvoiceNumber(transaction)

      const [created] = await transaction
        .insert(invoices)
        .values({
          projectId: project.id,
          // Denormalised from the project on purpose: `invoices.project_id` is `set null`, so an
          // invoice that outlives its project would otherwise lose every trace of who it was raised
          // for, and `chk_invoices_parent` would block the project delete outright.
          clientId: project.clientId,
          templateId: parsed.data.templateId,
          number,
          status: "draft",
          currency: parsed.data.currency,
          ...toInvoiceDiscountColumns(parsed.data),
          subtotalCents: totals.subtotalCents,
          discountAmountTotalCents: totals.discountAmountTotalCents,
          taxAmountCents: totals.taxAmountCents,
          totalCents: totals.totalCents,
          issueDate: parsed.data.issueDate,
          dueDate: parsed.data.dueDate,
          notes: emptyToNull(parsed.data.notes),
          // Minted here rather than at send so `invoices.public_token` can stay NOT NULL and
          // uniquely indexed. Nothing reads it back until `issueDate` is set — see the read model in
          // queries.ts, which withholds the client path for an unissued invoice.
          publicToken: randomBytes(32).toString("base64url")
        })
        .returning({ id: invoices.id })

      if (!created) throw new Error("Invoice insert returned no row")

      await writeInvoiceLineItems(
        transaction,
        created.id,
        toInvoiceLineItemRows(parsed.data, taxPercentages),
        toInvoiceDiscount(parsed.data)
      )

      return created.id
    })

    await writeInvoiceAudit(context, "invoice.created", invoiceId, {
      projectId: project.id,
      clientId: project.clientId,
      totalCents: totals.totalCents,
      lineItemCount: parsed.data.lineItems.length
    })
    await emitInvoiceCreated({
      invoiceId,
      projectId: project.id,
      clientId: project.clientId,
      userId: context.userId
    })

    revalidateInvoicePaths({ id: invoiceId, projectId: project.id, clientId: project.clientId })

    return await loadInvoiceResult(invoiceId)
  } catch (error) {
    return handleInvoiceActionError(error, {
      action: "createInvoice",
      userId: context.userId,
      fallbackMessage: t("invoices.errors.createFailed")
    })
  }
}

export async function updateInvoice(input: unknown): Promise<InvoiceMutationResult> {
  const gate = await requireInvoiceWrite()

  if ("error" in gate) return gate

  const parsed = updateInvoiceSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await database.query.invoices.findFirst({
      where: and(eq(invoices.id, parsed.data.id), isNull(invoices.deletedAt))
    })

    if (!existing) throw new ExpectedInvoiceError(t("invoices.errors.notFound"))

    if (!isInvoiceEditable(existing.status)) {
      throw new ExpectedInvoiceError(t("invoices.errors.notDraft"))
    }

    const taxPercentages = await getTaxPercentages(parsed.data)
    const totals = calculateInvoiceTotal(
      toLineItemInputs(parsed.data, taxPercentages),
      toInvoiceDiscount(parsed.data)
    )

    await database.transaction(async (transaction) => {
      // The status is re-checked in the WHERE rather than trusted from the read above: a concurrent
      // send between the two statements would otherwise let an issued invoice be rewritten.
      const [updated] = await transaction
        .update(invoices)
        .set({
          templateId: parsed.data.templateId,
          currency: parsed.data.currency,
          ...toInvoiceDiscountColumns(parsed.data),
          subtotalCents: totals.subtotalCents,
          discountAmountTotalCents: totals.discountAmountTotalCents,
          taxAmountCents: totals.taxAmountCents,
          totalCents: totals.totalCents,
          issueDate: parsed.data.issueDate,
          dueDate: parsed.data.dueDate,
          notes: emptyToNull(parsed.data.notes)
        })
        .where(
          and(
            eq(invoices.id, parsed.data.id),
            eq(invoices.status, "draft"),
            isNull(invoices.deletedAt)
          )
        )
        .returning({ id: invoices.id })

      if (!updated) throw new ExpectedInvoiceError(t("invoices.errors.notDraft"))

      // Hard delete rather than soft: `uq_line_items_invoice_position` does not exclude soft-deleted
      // rows, so a retained row would collide with the replacement at the same position. A draft has
      // never been shown to a client, so there is no history to preserve.
      await transaction.delete(lineItems).where(eq(lineItems.invoiceId, parsed.data.id))

      await writeInvoiceLineItems(
        transaction,
        parsed.data.id,
        toInvoiceLineItemRows(parsed.data, taxPercentages),
        toInvoiceDiscount(parsed.data)
      )
    })

    const changedFields = getChangedInvoiceFields(existing, parsed.data)

    await writeInvoiceAudit(context, "invoice.updated", existing.id, {
      projectId: existing.projectId,
      clientId: existing.clientId,
      changedFields,
      totalCents: totals.totalCents
    })
    await emitInvoiceUpdated({
      invoiceId: existing.id,
      userId: context.userId,
      changedFields
    })

    revalidateInvoicePaths(existing)

    return await loadInvoiceResult(existing.id)
  } catch (error) {
    return handleInvoiceActionError(error, {
      action: "updateInvoice",
      userId: context.userId,
      invoiceId: parsed.data.id
    })
  }
}

export async function sendInvoice(input: unknown): Promise<SendInvoiceResult> {
  const gate = await requireInvoiceSend()

  if ("error" in gate) return gate

  const parsed = invoiceIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await database.query.invoices.findFirst({
      where: and(eq(invoices.id, parsed.data.id), isNull(invoices.deletedAt))
    })

    if (!existing) throw new ExpectedInvoiceError(t("invoices.errors.notFound"))

    const transition = canTransitionInvoiceStatus(existing.status, "sent")

    if (!transition.allowed) throw new ExpectedInvoiceError(t("invoices.errors.invalidTransition"))

    const lineItemCount = await countInvoiceLineItems(existing.id)

    if (lineItemCount === 0) {
      throw new ExpectedInvoiceError(t("invoices.validation.lineItemsRequired"))
    }

    // The number was claimed at creation, so nothing here can consume one. A send that fails at any
    // point below leaves the invoice a draft carrying the number it has always had, and the next
    // create still gets the next sequence — numbers are never burned by a failed send.
    const paymentTermsDays = (await getPaymentTermsDays()) ?? 0
    const { issueDate, dueDate } = resolveInvoiceIssueDates({
      now: new Date(),
      currentIssueDate: existing.issueDate,
      currentDueDate: existing.dueDate,
      paymentTermsDays
    })

    const [sent] = await database
      .update(invoices)
      .set({ status: transition.nextStatus, issueDate, dueDate })
      .where(
        and(
          eq(invoices.id, parsed.data.id),
          eq(invoices.status, "draft"),
          isNull(invoices.deletedAt)
        )
      )
      .returning({
        id: invoices.id,
        projectId: invoices.projectId,
        clientId: invoices.clientId
      })

    if (!sent) throw new ExpectedInvoiceError(t("invoices.errors.invalidTransition"))

    // Never records `publicToken`: the audit trail is readable by anyone with database access, and
    // the token is a bearer credential for the public route (`security.md`).
    await writeInvoiceAudit(context, "invoice.sent", sent.id, {
      projectId: sent.projectId,
      clientId: sent.clientId,
      issueDate: issueDate.toISOString(),
      dueDate: dueDate.toISOString(),
      lineItemCount
    })
    await emitInvoiceSent({ invoiceId: sent.id, userId: context.userId })
    // `email: "sent"` is what chains the client's copy behind the render, so the mail always has a
    // PDF to attach (see the ordering note in `lib/jobs/types.ts`).
    await enqueueJob("invoice.pdf.render", { invoiceId: sent.id, email: "sent" })

    revalidateInvoicePaths(sent)

    return { data: { id: sent.id } }
  } catch (error) {
    return handleInvoiceActionError(error, {
      action: "sendInvoice",
      userId: context.userId,
      invoiceId: parsed.data.id,
      fallbackMessage: t("invoices.errors.sendFailed")
    })
  }
}

export async function markInvoicePaid(input: unknown): Promise<MarkInvoicePaidResult> {
  const gate = await requireInvoiceMarkPaid()

  if ("error" in gate) return gate

  const parsed = invoiceIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await database.query.invoices.findFirst({
      where: and(eq(invoices.id, parsed.data.id), isNull(invoices.deletedAt)),
      columns: { id: true, status: true, projectId: true, clientId: true }
    })

    if (!existing) throw new ExpectedInvoiceError(t("invoices.errors.notFound"))

    const transition = canTransitionInvoiceStatus(existing.status, "paid")

    if (!transition.allowed) throw new ExpectedInvoiceError(t("invoices.errors.invalidTransition"))

    // The invoice row is not written here any more. `recordInvoiceSettlement` books the outstanding
    // balance as a payment and moves `amount_paid_cents`, `status` and `paid_at` in the same
    // transaction as that row, so this action cannot leave an aggregate that disagrees with the
    // payments behind it. It stays silent on `invoice.paid` and reports the outcome instead, which
    // is why the emission below is still this action's to make.
    const settlement = await recordInvoiceSettlement(existing.id, context)

    if ("error" in settlement) throw new ExpectedInvoiceError(settlement.error)

    await writeInvoiceAudit(context, "invoice.paid", existing.id, {
      projectId: existing.projectId,
      clientId: existing.clientId,
      paymentId: settlement.data.paymentId
    })
    await emitInvoicePaid({ invoiceId: existing.id, userId: context.userId })

    revalidateInvoicePaths(existing)

    return { data: { id: existing.id } }
  } catch (error) {
    return handleInvoiceActionError(error, {
      action: "markInvoicePaid",
      userId: context.userId,
      invoiceId: parsed.data.id,
      fallbackMessage: t("invoices.errors.markPaidFailed")
    })
  }
}

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

function toInvoiceLineItemRows(
  values: InvoiceWriteValues,
  taxPercentages: Map<string, number>
): InvoiceLineItemRow[] {
  return values.lineItems.map((item) => ({
    taxRateId: item.taxRateId,
    description: item.description,
    unit: emptyToNull(item.unit),
    quantity: item.quantity,
    unitPriceCents: item.unitPrice,
    discount: toInvoiceDiscountColumns(item),
    taxPercentage: getTaxPercentage(item.taxRateId, taxPercentages)
  }))
}

async function getTaxPercentages(values: InvoiceWriteValues): Promise<Map<string, number>> {
  const ids = [
    ...new Set(
      values.lineItems
        .map((item) => item.taxRateId)
        .filter((id): id is string => typeof id === "string")
    )
  ]

  if (ids.length === 0) return new Map()

  const rows = await database
    .select({ id: taxRates.id, percentage: taxRates.percentage })
    .from(taxRates)
    .where(and(inArray(taxRates.id, ids), isNull(taxRates.deletedAt)))

  if (rows.length !== ids.length) {
    throw new ExpectedInvoiceError(t("invoices.validation.taxRateInvalid"))
  }

  return new Map(rows.map((row) => [row.id, Number(row.percentage)]))
}

async function getPaymentTermsDays(): Promise<number | null> {
  const row = await database.query.settings.findFirst({
    columns: { paymentTermsDays: true }
  })

  return row?.paymentTermsDays ?? null
}

async function countInvoiceLineItems(invoiceId: string): Promise<number> {
  const rows = await database
    .select({ id: lineItems.id })
    .from(lineItems)
    .where(and(eq(lineItems.invoiceId, invoiceId), isNull(lineItems.deletedAt)))

  return rows.length
}

function toLineItemInputs(
  values: InvoiceWriteValues,
  taxPercentages: Map<string, number>
): InvoiceLineItemInput[] {
  return values.lineItems.map((item) => ({
    quantity: item.quantity,
    unitPriceCents: item.unitPrice,
    discount: toInvoiceDiscount(item),
    taxPercentage: getTaxPercentage(item.taxRateId, taxPercentages)
  }))
}

function getTaxPercentage(taxRateId: string | null, taxPercentages: Map<string, number>): number {
  return taxRateId === null ? 0 : (taxPercentages.get(taxRateId) ?? 0)
}

function getChangedInvoiceFields(
  existing: typeof invoices.$inferSelect,
  next: InvoiceWriteValues
): string[] {
  const existingValues = {
    currency: existing.currency,
    templateId: existing.templateId,
    issueDate: existing.issueDate,
    dueDate: existing.dueDate,
    notes: existing.notes,
    discountKind: existing.discountType ?? "none"
  }

  const nextValues = {
    currency: next.currency,
    templateId: next.templateId,
    issueDate: next.issueDate,
    dueDate: next.dueDate,
    notes: emptyToNull(next.notes),
    discountKind: next.discountKind
  }

  return AUDIT_FIELDS.filter((field) => !isSameValue(existingValues[field], nextValues[field]))
}

function isSameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()

  if (a instanceof Date || b instanceof Date) return false

  return (a ?? null) === (b ?? null)
}
