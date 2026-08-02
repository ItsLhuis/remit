"use server"

import { revalidatePath } from "next/cache"

import { randomBytes } from "node:crypto"

import { and, eq, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { database } from "@/database"
import { invoices, lineItems } from "@/database/schema"

import { emitInvoiceCreated } from "./events"
import {
  claimInvoiceNumber,
  handleInvoiceActionError,
  loadInvoiceResult,
  requireInvoiceWrite,
  revalidateInvoicePaths,
  writeInvoiceAudit,
  ExpectedInvoiceError
} from "./mutationContext"
import { getProposalInvoiceSnapshot } from "./queries"
import { createInvoiceFromProposalSchema } from "./schemas"
import {
  calculateInvoiceLineTotals,
  calculateInvoiceTotal,
  toInvoiceColumnDiscount,
  type InvoiceLineItemInput
} from "./services"
import { type InvoiceMutationResult, type ProposalInvoiceSnapshot } from "./types"

// The proposal-to-invoice path lives beside mutations.ts rather than inside it because it is a
// different kind of write: every number on the invoice comes from the accepted proposal's own rows,
// never from a submitted form, so the only untrusted input is the proposal id.
export async function createInvoiceFromProposal(input: unknown): Promise<InvoiceMutationResult> {
  const gate = await requireInvoiceWrite()

  if ("error" in gate) return gate

  const parsed = createInvoiceFromProposalSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const snapshot = await getProposalInvoiceSnapshot(parsed.data.proposalId)

    if (!snapshot) throw new ExpectedInvoiceError(t("invoices.errors.proposalNotConvertible"))

    if (snapshot.lineItems.length === 0) {
      throw new ExpectedInvoiceError(t("invoices.errors.proposalHasNoLineItems"))
    }

    const alreadyInvoiced = await database
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.proposalId, snapshot.id), isNull(invoices.deletedAt)))
      .limit(1)

    if (alreadyInvoiced.length > 0) {
      throw new ExpectedInvoiceError(t("invoices.errors.proposalAlreadyConverted"))
    }

    const snapshotLines = snapshot.lineItems.map(toSnapshotLineItemInput)
    const snapshotDiscount = toInvoiceColumnDiscount(snapshot)

    const totals = calculateInvoiceTotal(snapshotLines, snapshotDiscount)
    const lineTotals = calculateInvoiceLineTotals(snapshotLines, snapshotDiscount)

    const invoiceId = await database.transaction(async (transaction) => {
      const number = await claimInvoiceNumber(transaction)

      const [created] = await transaction
        .insert(invoices)
        .values({
          projectId: snapshot.projectId,
          clientId: snapshot.clientId,
          proposalId: snapshot.id,
          number,
          status: "draft",
          currency: snapshot.currency,
          discountType: snapshot.discountType,
          discountPercentage: snapshot.discountPercentage,
          discountAmountCents: snapshot.discountAmountCents,
          subtotalCents: totals.subtotalCents,
          discountAmountTotalCents: totals.discountAmountTotalCents,
          taxAmountCents: totals.taxAmountCents,
          totalCents: totals.totalCents,
          notes: snapshot.notes,
          publicToken: randomBytes(32).toString("base64url")
        })
        .returning({ id: invoices.id })

      if (!created) throw new Error("Invoice insert returned no row")

      await transaction.insert(lineItems).values(
        snapshot.lineItems.map((item, index) => ({
          invoiceId: created.id,
          taxRateId: item.taxRateId,
          position: index,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          discountType: item.discountType,
          discountPercentage: item.discountPercentage,
          discountAmountCents: item.discountAmountCents,
          // The proposal line's own snapshot, copied across untouched. Re-reading `tax_rates` here
          // would let a rate edited between acceptance and invoicing move a number the client has
          // already agreed to (ADR-0017).
          taxPercentageSnapshot: String(item.taxPercentage),
          subtotalCents: lineTotals[index]?.subtotalCents ?? 0,
          taxAmountCents: lineTotals[index]?.taxAmountCents ?? 0,
          totalCents: lineTotals[index]?.totalCents ?? 0
        }))
      )

      return created.id
    })

    await writeInvoiceAudit(context, "invoice.created", invoiceId, {
      proposalId: snapshot.id,
      projectId: snapshot.projectId,
      clientId: snapshot.clientId,
      totalCents: totals.totalCents,
      lineItemCount: snapshot.lineItems.length
    })
    await emitInvoiceCreated({
      invoiceId,
      projectId: snapshot.projectId,
      clientId: snapshot.clientId,
      userId: context.userId
    })

    revalidateInvoicePaths({
      id: invoiceId,
      projectId: snapshot.projectId,
      clientId: snapshot.clientId
    })
    revalidatePath(`/projects/${snapshot.projectId}/proposals/${snapshot.id}`)

    return await loadInvoiceResult(invoiceId)
  } catch (error) {
    return handleInvoiceActionError(error, {
      action: "createInvoiceFromProposal",
      userId: context.userId,
      fallbackMessage: toConversionErrorMessage(error)
    })
  }
}

function toSnapshotLineItemInput(
  item: ProposalInvoiceSnapshot["lineItems"][number]
): InvoiceLineItemInput {
  return {
    quantity: Number(item.quantity),
    unitPriceCents: item.unitPriceCents,
    discount: toInvoiceColumnDiscount(item),
    taxPercentage: item.taxPercentage
  }
}

// Two concurrent conversions of one proposal are serialized by nothing at the database level today —
// `invoices.proposal_id` carries an index, not a unique constraint — so the pre-check above is the
// guard and this maps a unique violation from any other source back to a message a user can act on.
function toConversionErrorMessage(error: unknown): string {
  const isUniqueViolation =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"

  return isUniqueViolation
    ? t("invoices.errors.proposalAlreadyConverted")
    : t("invoices.errors.createFailed")
}
