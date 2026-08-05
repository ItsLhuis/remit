import { sql } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { type database } from "@/database"
import { lineItems, settings } from "@/database/schema"

import {
  calculateInvoiceLineTotals,
  generateInvoiceNumber,
  toInvoiceColumnDiscount,
  type InvoiceDiscount,
  type InvoiceDiscountColumns
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
      totalCents: lineTotals[index]?.totalCents ?? 0
    }))
  )
}
