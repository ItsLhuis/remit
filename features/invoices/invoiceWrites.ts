import { and, asc, eq, isNull, sql } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { type database } from "@/database"
import { lineItems, settings } from "@/database/schema"

import {
  calculateInvoiceLineTotals,
  calculateInvoiceTotal,
  generateInvoiceNumber,
  toInvoiceColumnDiscount,
  type InvoiceDiscount,
  type InvoiceDiscountColumns,
  type InvoiceTotals
} from "./services"

// The parts of the invoice write path that carry no request context, split out of mutationContext.ts
// so a background worker can reach them: that module imports `next/cache` and `next/headers` at the
// top level, and a standalone worker process has neither. Everything session-bound stays there.
//
// `mutationContext.ts` re-exports the three shared declarations below, so no action call site had to
// change when they moved.
export type InvoiceTransaction = Parameters<Parameters<typeof database.transaction>[0]>[0]

// A failure the user is meant to read: thrown to unwind whatever the action was midway through and
// caught by handleInvoiceActionError, which passes the message straight back rather than logging it
// as an incident.
export class ExpectedInvoiceError extends Error {}

// One line as it is written, with every value already resolved: the tax percentage looked up or
// snapshotted, the discount already in column shape, the quantity a number. Callers differ in where
// those come from — a form, a proposal snapshot, a recurring blueprint — and agreeing on this shape
// is what stops the insert below from being written a third time.
export type InvoiceLineItemRow = {
  taxRateId: string | null
  description: string
  unit: string | null
  quantity: number
  unitPriceCents: number
  discount: InvoiceDiscountColumns
  taxPercentage: number
  // Per-line provenance, written only by a caller that can name a single source row. It is not a
  // mirror of `time_entries.invoiced_in_id` / `expenses.invoiced_in_id` and neither may be derived
  // from the other — see ARCHITECTURE.md's key invariants and
  // services/billableConversion.ts's toTimeLineDraft.
  sourceTimeEntryId?: string | null
  sourceExpenseId?: string | null
}

// A single atomic increment rather than read-then-write: two concurrent creates that both read the
// same `next_invoice_number` would mint the same number and one would fail the unique index on
// `invoices.number`. The returned value is the counter *after* the bump, so the number this call
// owns is one below it. Running inside the caller's transaction is what makes a failed create give
// the number back instead of burning it.
export async function claimInvoiceNumber(transaction: InvoiceTransaction): Promise<string> {
  const [row] = await transaction
    .update(settings)
    .set({ nextInvoiceNumber: sql`${settings.nextInvoiceNumber} + 1` })
    .returning({
      nextNumber: settings.nextInvoiceNumber,
      prefix: settings.invoicePrefix,
      paddingWidth: settings.numberPaddingWidth
    })

  if (!row) throw new ExpectedInvoiceError(t("invoices.errors.updateFailed"))

  return generateInvoiceNumber({
    prefix: row.prefix,
    paddingWidth: row.paddingWidth,
    nextSequence: row.nextNumber - 1
  })
}

// `quantity` and `taxPercentageSnapshot` are written as strings because both columns are `numeric`,
// which Drizzle types as `string`. Passing a number compiles nowhere and would round-trip through
// the driver differently if it did.
//
// The percentage is copied onto the line, never joined at read time: editing the `tax_rates` row
// later must not move the totals of an invoice the client has already seen (ADR-0017).
export async function writeInvoiceLineItems(
  transaction: InvoiceTransaction,
  invoiceId: string,
  rows: InvoiceLineItemRow[],
  invoiceDiscount: InvoiceDiscount | null
): Promise<void> {
  const lineTotals = calculateInvoiceLineTotals(
    rows.map((row) => ({
      quantity: row.quantity,
      unitPriceCents: row.unitPriceCents,
      discount: toInvoiceColumnDiscount(row.discount),
      taxPercentage: row.taxPercentage
    })),
    invoiceDiscount
  )

  await transaction.insert(lineItems).values(
    rows.map((row, index) => ({
      invoiceId,
      taxRateId: row.taxRateId,
      position: index,
      description: row.description,
      unit: row.unit,
      quantity: String(row.quantity),
      unitPriceCents: row.unitPriceCents,
      ...row.discount,
      taxPercentageSnapshot: String(row.taxPercentage),
      subtotalCents: lineTotals[index]?.subtotalCents ?? 0,
      taxAmountCents: lineTotals[index]?.taxAmountCents ?? 0,
      totalCents: lineTotals[index]?.totalCents ?? 0,
      sourceTimeEntryId: row.sourceTimeEntryId ?? null,
      sourceExpenseId: row.sourceExpenseId ?? null
    }))
  )
}

// Appending to a draft is not "insert some more rows": a document-level discount is shared across
// every line by calculateInvoiceTotal's largest-remainder allocation, so adding a line moves the
// share — and therefore the taxable base and the tax — of every line already there. The existing
// lines are re-derived from their own stored quantity, unit price, discount and tax snapshot, never
// re-read from a tax rate or a source row, so this recomputation redistributes the discount without
// re-pricing anything (ADR-0017).
//
// Positions continue after the highest one present rather than being renumbered from zero:
// `uq_line_items_invoice_position` is a unique partial index on `(invoice_id, position)`, and
// renumbering would collide with the rows it is about to replace.
export async function appendInvoiceLineItems(
  transaction: InvoiceTransaction,
  invoiceId: string,
  rows: InvoiceLineItemRow[],
  invoiceDiscount: InvoiceDiscount | null
): Promise<InvoiceTotals> {
  const existing = await transaction
    .select({
      id: lineItems.id,
      position: lineItems.position,
      quantity: lineItems.quantity,
      unitPriceCents: lineItems.unitPriceCents,
      discountType: lineItems.discountType,
      discountPercentage: lineItems.discountPercentage,
      discountAmountCents: lineItems.discountAmountCents,
      taxPercentageSnapshot: lineItems.taxPercentageSnapshot
    })
    .from(lineItems)
    .where(and(eq(lineItems.invoiceId, invoiceId), isNull(lineItems.deletedAt)))
    .orderBy(asc(lineItems.position))

  const nextPosition = existing.reduce((highest, line) => Math.max(highest, line.position + 1), 0)

  const inserted = await transaction
    .insert(lineItems)
    .values(
      rows.map((row, index) => ({
        invoiceId,
        taxRateId: row.taxRateId,
        position: nextPosition + index,
        description: row.description,
        unit: row.unit,
        quantity: String(row.quantity),
        unitPriceCents: row.unitPriceCents,
        ...row.discount,
        taxPercentageSnapshot: String(row.taxPercentage),
        sourceTimeEntryId: row.sourceTimeEntryId ?? null,
        sourceExpenseId: row.sourceExpenseId ?? null
      }))
    )
    .returning({ id: lineItems.id, position: lineItems.position })

  const allInputs = [
    ...existing.map((line) => ({
      quantity: Number(line.quantity),
      unitPriceCents: Number(line.unitPriceCents),
      discount: toInvoiceColumnDiscount({
        discountType: line.discountType,
        discountPercentage: line.discountPercentage,
        discountAmountCents: line.discountAmountCents
      }),
      taxPercentage: Number(line.taxPercentageSnapshot)
    })),
    ...rows.map((row) => ({
      quantity: row.quantity,
      unitPriceCents: row.unitPriceCents,
      discount: toInvoiceColumnDiscount(row.discount),
      taxPercentage: row.taxPercentage
    }))
  ]

  const lineTotals = calculateInvoiceLineTotals(allInputs, invoiceDiscount)

  // Ordered by position, never by the order `returning` handed the rows back: `allInputs` is the
  // existing lines in position order followed by the new ones in the order they were given
  // positions, and pairing a computed total with the wrong line would move money on both.
  const ids = [
    ...existing.map((line) => line.id),
    ...[...inserted].sort((a, b) => a.position - b.position).map((line) => line.id)
  ]

  // One UPDATE ... FROM (VALUES …) rather than one statement per line: every line's totals move when
  // a document discount is redistributed, and issuing n round trips inside the transaction would
  // hold it open for the whole set.
  const values = ids.map(
    (id, index) =>
      sql`(${id}::uuid, ${lineTotals[index]?.subtotalCents ?? 0}::bigint, ${lineTotals[index]?.taxAmountCents ?? 0}::bigint, ${lineTotals[index]?.totalCents ?? 0}::bigint)`
  )

  await transaction.execute(sql`
    update ${lineItems} set
      subtotal_cents = totals.subtotal_cents,
      tax_amount_cents = totals.tax_amount_cents,
      total_cents = totals.total_cents
    from (values ${sql.join(values, sql`, `)}) as totals(id, subtotal_cents, tax_amount_cents, total_cents)
    where ${lineItems.id} = totals.id
  `)

  return calculateInvoiceTotal(allInputs, invoiceDiscount)
}
