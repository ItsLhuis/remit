import { randomBytes } from "node:crypto"

import { database } from "@/database"
import { invoices } from "@/database/schema"

import {
  claimInvoiceNumber,
  writeInvoiceLineItems,
  type InvoiceLineItemRow,
  type InvoiceTransaction
} from "./invoiceWrites"
import {
  calculateInvoiceTotal,
  resolveInvoiceIssueDates,
  toInvoiceColumnDiscount
} from "./services"

// Re-exported so a job can build the lines it passes in without importing a second module from this
// feature — `systemWrites` is the whole worker-facing door (see the boundary rule in
// eslint.config.mjs).
export { type InvoiceLineItemRow } from "./invoiceWrites"

export type SystemInvoiceInput = {
  // The caller's transaction, not one opened here. A generated invoice and the counters on the
  // schedule that produced it must commit together, or a crash between them double-generates on the
  // next run — which is the whole idempotency guarantee ADR-0023 asks for.
  transaction: InvoiceTransaction
  clientId: string
  projectId: string | null
  templateId: string | null
  recurringInvoiceId: string
  currency: string
  status: "draft" | "sent"
  notes: string | null
  lineItems: InvoiceLineItemRow[]
  now: Date
}

export type SystemInvoiceResult = {
  id: string
  number: string
  totalCents: number
}

// The invoice write path for a caller with no session: a background job running as the system actor.
//
// It is deliberately not `createInvoice`. That action gates on a session, validates `unknown` form
// input, revalidates Next paths and returns a form read model — none of which a worker has or wants.
// What is shared is everything that must not diverge: the number claim, the totals math and the line
// insert. This module is not `"use server"` on purpose, so importing it from a worker yields plain
// functions rather than server-action references (the same reason `features/payments/paymentWrites.ts`
// exists).
//
// Auditing, event emission and the PDF enqueue stay with the caller: this function knows nothing
// about why the invoice is being raised, and a job that is mid-transaction should not be emitting.
export async function writeSystemInvoice(input: SystemInvoiceInput): Promise<SystemInvoiceResult> {
  const totals = calculateInvoiceTotal(
    input.lineItems.map((row) => ({
      quantity: row.quantity,
      unitPriceCents: row.unitPriceCents,
      discount: toInvoiceColumnDiscount(row.discount),
      taxPercentage: row.taxPercentage
    })),
    // A schedule carries no document-level discount of its own — `recurring_invoices` has no
    // discount columns. Per-line discounts still travel in the blueprint.
    null
  )

  // A draft is dated when someone sends it, exactly as a hand-written one is; only an auto-sent
  // invoice is stamped here. The `?? 0` matches `sendInvoice` rather than `getInvoiceDefaults`'
  // fallback of 30, so a manual send and an automatic one produce the same dates on an instance
  // whose settings row is missing.
  const dates =
    input.status === "sent"
      ? resolveInvoiceIssueDates({
          now: input.now,
          currentIssueDate: null,
          currentDueDate: null,
          paymentTermsDays: (await getPaymentTermsDays()) ?? 0
        })
      : null

  const number = await claimInvoiceNumber(input.transaction)

  const [created] = await input.transaction
    .insert(invoices)
    .values({
      projectId: input.projectId,
      clientId: input.clientId,
      recurringInvoiceId: input.recurringInvoiceId,
      templateId: input.templateId,
      number,
      status: input.status,
      currency: input.currency,
      subtotalCents: totals.subtotalCents,
      discountAmountTotalCents: totals.discountAmountTotalCents,
      taxAmountCents: totals.taxAmountCents,
      totalCents: totals.totalCents,
      issueDate: dates?.issueDate ?? null,
      dueDate: dates?.dueDate ?? null,
      notes: input.notes,
      publicToken: randomBytes(32).toString("base64url")
    })
    .returning({ id: invoices.id })

  if (!created) throw new Error("System invoice insert returned no row")

  await writeInvoiceLineItems(input.transaction, created.id, input.lineItems, null)

  return { id: created.id, number, totalCents: totals.totalCents }
}

async function getPaymentTermsDays(): Promise<number | null> {
  const row = await database.query.settings.findFirst({
    columns: { paymentTermsDays: true }
  })

  return row?.paymentTermsDays ?? null
}
