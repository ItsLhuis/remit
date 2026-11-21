import { and, count, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm"

import { database } from "@/database"
import { creditNotes, invoices } from "@/database/schema"

import { OUTSTANDING_INVOICE_STATUSES } from "./services"

// The aggregates every client read joins against, extracted from queries.ts because all of
// listClients, getClientsSummary and the detail read build the same ones and the file was at its
// line ceiling. They are `.as()` subqueries rather than lateral joins so one client with a thousand
// invoices does not turn the list read into a per-row aggregate.
// What each client still owes: the sum over its sent and paid invoices of the one per-invoice
// outstanding definition, credit notes netted and clamped per invoice. It is the SQL form of
// `services/calculateOutstandingBalance.ts`'s `calculateOutstandingBalanceCents`, and summing the
// per-invoice figure rather than subtracting a client's payments from its invoice totals is what keeps
// one over-credited invoice from hiding what another still owes. Payments are read through
// `invoices.amount_paid_cents`, the aggregate `features/payments/paymentWrites.ts` keeps equal to the
// live payment rows, so no join fans out one invoice row per payment.
//
// The per-invoice expression restates `features/invoices/queryFragments.ts`'s
// `getInvoiceOutstandingSql` rather than importing it: the invoices server barrel reaches this
// feature's own server graph, so the import would close a cycle. `__tests__/clientOutstanding
// .integration.test.ts` holds this sum equal to the pure definition.
export function getClientOutstandingSubquery() {
  const credited = database
    .select({
      invoiceId: creditNotes.invoiceId,
      creditedCents: sql<number>`coalesce(sum(${creditNotes.totalCents}), 0)`.as("credited_cents")
    })
    .from(creditNotes)
    .where(isNull(creditNotes.deletedAt))
    .groupBy(creditNotes.invoiceId)
    .as("client_invoice_credited")

  return database
    .select({
      clientId: invoices.clientId,
      outstandingCents:
        sql<number>`cast(coalesce(sum(greatest(${invoices.totalCents} - coalesce(${credited.creditedCents}, 0) - ${invoices.amountPaidCents}, 0)), 0) as bigint)`.as(
          "outstanding_cents"
        )
    })
    .from(invoices)
    .leftJoin(credited, eq(credited.invoiceId, invoices.id))
    .where(
      and(
        isNotNull(invoices.clientId),
        isNull(invoices.deletedAt),
        inArray(invoices.status, OUTSTANDING_INVOICE_STATUSES)
      )
    )
    .groupBy(invoices.clientId)
    .as("client_outstanding")
}

export function getClientInvoiceCountSubquery() {
  return database
    .select({
      clientId: invoices.clientId,
      invoiceCount: count().as("invoice_count")
    })
    .from(invoices)
    .where(and(isNotNull(invoices.clientId), isNull(invoices.deletedAt)))
    .groupBy(invoices.clientId)
    .as("client_invoice_counts")
}
