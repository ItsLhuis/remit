import { and, eq, isNull, sql, type SQL } from "drizzle-orm"

import { database } from "@/database"
import { creditNotes, invoices } from "@/database/schema"

// The SQL face of `services/invoiceStatusView.ts`'s `getInvoiceOutstandingCents`, for the reads that
// sort, filter or aggregate on what an invoice still owes and so cannot compute it row by row in
// TypeScript: the invoice list, the client list and the client detail. The two must give the same
// answer for every invoice, and `__tests__/outstandingSql.integration.test.ts` pins them together.
// Extracted from the queries modules on the precedent of `features/clients/queryFragments.ts`,
// because more than one read builds the same fragments.

// Live credit notes only: a soft-deleted note no longer reduces what is owed, which is also what
// restoring one puts back.
export function getInvoiceCreditedTotalsSubquery() {
  return database
    .select({
      invoiceId: creditNotes.invoiceId,
      creditedCents: sql<number>`cast(coalesce(sum(${creditNotes.totalCents}), 0) as bigint)`.as(
        "credited_cents"
      )
    })
    .from(creditNotes)
    .where(isNull(creditNotes.deletedAt))
    .groupBy(creditNotes.invoiceId)
    .as("invoice_credited_totals")
}

// Takes the credited column of whichever subquery the caller joined, so an invoice with no credit
// notes — a null from the left join — nets nothing rather than nulling the whole expression.
export function getInvoiceOutstandingSql(creditedCents: SQL.Aliased<number>): SQL<number> {
  return sql<number>`cast(greatest(${invoices.totalCents} - coalesce(${creditedCents}, 0) - ${invoices.amountPaidCents}, 0) as bigint)`
}

type CreditedReader = Pick<typeof database, "select">

// Takes the caller's transaction when there is one, so a write that holds the invoice lock decides
// against the credit notes that transaction can see.
export async function readInvoiceCreditedCents(
  invoiceId: string,
  reader: CreditedReader = database
): Promise<number> {
  const [row] = await reader
    .select({ total: sql<string>`coalesce(sum(${creditNotes.totalCents}), 0)` })
    .from(creditNotes)
    .where(and(eq(creditNotes.invoiceId, invoiceId), isNull(creditNotes.deletedAt)))

  return Number(row?.total ?? 0)
}
