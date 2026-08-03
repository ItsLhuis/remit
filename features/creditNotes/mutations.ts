"use server"

import { and, eq, inArray, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { enqueueJob } from "@/lib/jobs"

import { database } from "@/database"
import { creditNotes, invoices, lineItems, taxRates } from "@/database/schema"

import { emitCreditNoteDeleted, emitCreditNoteIssued } from "./events"
import {
  claimCreditNoteNumber,
  emptyToNull,
  handleCreditNoteActionError,
  requireCreditNoteDelete,
  requireCreditNoteWrite,
  revalidateCreditNotePaths,
  writeCreditNoteAudit,
  ExpectedCreditNoteError,
  type CreditNoteTransaction
} from "./mutationContext"
import { createCreditNoteSchema, creditNoteIdSchema, type CreateCreditNoteValues } from "./schemas"
import {
  calculateCreditNoteLineTotals,
  calculateCreditNoteTotal,
  toCreditNoteDiscount,
  toCreditNoteDiscountColumns,
  type CreditNoteLineItemInput
} from "./services"
import { type CreditNoteMutationResult } from "./types"

export async function createCreditNote(input: unknown): Promise<CreditNoteMutationResult> {
  const gate = await requireCreditNoteWrite()

  if ("error" in gate) return gate

  const parsed = createCreditNoteSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const invoice = await database.query.invoices.findFirst({
      where: and(eq(invoices.id, parsed.data.invoiceId), isNull(invoices.deletedAt)),
      columns: { id: true, status: true, currency: true, projectId: true, clientId: true }
    })

    if (!invoice) throw new ExpectedCreditNoteError(t("creditNotes.errors.invoiceNotFound"))

    // A draft has never left the instance, so there is nothing to credit: the correction is to edit
    // the invoice itself, which is still editable precisely because it is a draft.
    if (invoice.status === "draft") {
      throw new ExpectedCreditNoteError(t("creditNotes.errors.invoiceNotIssued"))
    }

    const taxPercentages = await getTaxPercentages(parsed.data)
    const totals = calculateCreditNoteTotal(toLineItemInputs(parsed.data, taxPercentages))

    if (totals.totalCents <= 0) {
      throw new ExpectedCreditNoteError(t("creditNotes.errors.totalNotPositive"))
    }

    const creditNoteId = await database.transaction(async (transaction) => {
      const number = await claimCreditNoteNumber(transaction)

      const [created] = await transaction
        .insert(creditNotes)
        .values({
          invoiceId: invoice.id,
          number,
          reason: emptyToNull(parsed.data.reason),
          // Copied from the invoice rather than chosen: a credit note priced in another currency
          // could not reduce that invoice's receivable (services/effectiveReceivable.ts).
          currency: invoice.currency,
          subtotalCents: totals.subtotalCents,
          taxAmountCents: totals.taxAmountCents,
          totalCents: totals.totalCents
        })
        .returning({ id: creditNotes.id })

      if (!created) throw new Error("Credit note insert returned no row")

      await writeCreditNoteLineItems(transaction, created.id, parsed.data, taxPercentages)

      return created.id
    })

    await writeCreditNoteAudit(context, "credit_note.created", creditNoteId, {
      invoiceId: invoice.id,
      projectId: invoice.projectId,
      clientId: invoice.clientId,
      currency: invoice.currency,
      totalCents: totals.totalCents,
      lineItemCount: parsed.data.lineItems.length
    })
    await emitCreditNoteIssued({
      creditNoteId,
      invoiceId: invoice.id,
      userId: context.userId
    })
    // Enqueued, never rendered here: the document is drawn by the headless-browser worker from the
    // block renderer (ADR-0022), and a server action that waited on a browser would hold the
    // request open for the length of a render.
    await enqueueJob("credit_note.pdf.render", { creditNoteId })

    revalidateCreditNotePaths(invoice)

    return { data: { id: creditNoteId } }
  } catch (error) {
    return handleCreditNoteActionError(error, {
      action: "createCreditNote",
      userId: context.userId,
      fallbackMessage: t("creditNotes.errors.createFailed")
    })
  }
}

export async function softDeleteCreditNote(input: unknown): Promise<CreditNoteMutationResult> {
  const gate = await requireCreditNoteDelete()

  if ("error" in gate) return gate

  const parsed = creditNoteIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const [deleted] = await database
      .update(creditNotes)
      .set({ deletedAt: new Date() })
      .where(and(eq(creditNotes.id, parsed.data.id), isNull(creditNotes.deletedAt)))
      .returning({
        id: creditNotes.id,
        invoiceId: creditNotes.invoiceId,
        number: creditNotes.number,
        totalCents: creditNotes.totalCents
      })

    if (!deleted) throw new ExpectedCreditNoteError(t("creditNotes.errors.notFound"))

    const invoice = await database.query.invoices.findFirst({
      where: eq(invoices.id, deleted.invoiceId),
      columns: { id: true, projectId: true, clientId: true }
    })

    // The number is recorded but not released: `next_credit_note_number` never moves backwards, so a
    // deleted note's number is retired rather than handed to the next one.
    await writeCreditNoteAudit(context, "credit_note.deleted", deleted.id, {
      invoiceId: deleted.invoiceId,
      number: deleted.number,
      totalCents: Number(deleted.totalCents),
      softDeleted: true
    })
    await emitCreditNoteDeleted({
      creditNoteId: deleted.id,
      invoiceId: deleted.invoiceId,
      userId: context.userId
    })

    revalidateCreditNotePaths(invoice ?? { id: deleted.invoiceId, projectId: null, clientId: null })

    return { data: { id: deleted.id } }
  } catch (error) {
    return handleCreditNoteActionError(error, {
      action: "softDeleteCreditNote",
      userId: context.userId,
      creditNoteId: parsed.data.id,
      fallbackMessage: t("creditNotes.errors.deleteFailed")
    })
  }
}

async function writeCreditNoteLineItems(
  transaction: CreditNoteTransaction,
  creditNoteId: string,
  values: CreateCreditNoteValues,
  taxPercentages: Map<string, number>
): Promise<void> {
  const lineTotals = calculateCreditNoteLineTotals(toLineItemInputs(values, taxPercentages))

  await transaction.insert(lineItems).values(
    values.lineItems.map((item, index) => ({
      // `credit_note_id` is the only parent set: `chk_line_items_parent` requires exactly one of
      // proposal / invoice / credit note, and the omitted columns default to null (ADR-0017).
      creditNoteId,
      taxRateId: item.taxRateId,
      position: index,
      description: item.description,
      unit: emptyToNull(item.unit),
      quantity: String(item.quantity),
      unitPriceCents: item.unitPrice,
      ...toCreditNoteDiscountColumns(item),
      // The percentage is copied onto the line, never joined at read time: editing the `tax_rates`
      // row later must not move the totals of a credit note already issued (ADR-0017).
      taxPercentageSnapshot: String(getTaxPercentage(item.taxRateId, taxPercentages)),
      subtotalCents: lineTotals[index]?.subtotalCents ?? 0,
      taxAmountCents: lineTotals[index]?.taxAmountCents ?? 0,
      totalCents: lineTotals[index]?.totalCents ?? 0
    }))
  )
}

async function getTaxPercentages(values: CreateCreditNoteValues): Promise<Map<string, number>> {
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
    throw new ExpectedCreditNoteError(t("creditNotes.validation.taxRateInvalid"))
  }

  return new Map(rows.map((row) => [row.id, Number(row.percentage)]))
}

function toLineItemInputs(
  values: CreateCreditNoteValues,
  taxPercentages: Map<string, number>
): CreditNoteLineItemInput[] {
  return values.lineItems.map((item) => ({
    quantity: item.quantity,
    unitPriceCents: item.unitPrice,
    discount: toCreditNoteDiscount(item),
    taxPercentage: getTaxPercentage(item.taxRateId, taxPercentages)
  }))
}

function getTaxPercentage(taxRateId: string | null, taxPercentages: Map<string, number>): number {
  return taxRateId === null ? 0 : (taxPercentages.get(taxRateId) ?? 0)
}
