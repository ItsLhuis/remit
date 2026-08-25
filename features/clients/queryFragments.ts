import { and, count, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm"

import { database } from "@/database"
import { invoices, payments } from "@/database/schema"

import { OUTSTANDING_INVOICE_STATUSES } from "./services"

// The three aggregates every client read joins against, extracted from queries.ts because all of
// listClients, getClientsSummary and the detail read build the same three and the file was at its
// line ceiling. They are `.as()` subqueries rather than lateral joins so one client with a thousand
// invoices does not turn the list read into a per-row aggregate.
export function getClientInvoiceTotalsSubquery() {
  return database
    .select({
      clientId: invoices.clientId,
      totalCents: sql<number>`cast(coalesce(sum(${invoices.totalCents}), 0) as bigint)`.as(
        "total_cents"
      )
    })
    .from(invoices)
    .where(
      and(
        isNotNull(invoices.clientId),
        isNull(invoices.deletedAt),
        inArray(invoices.status, OUTSTANDING_INVOICE_STATUSES)
      )
    )
    .groupBy(invoices.clientId)
    .as("client_invoice_totals")
}

export function getClientPaymentTotalsSubquery() {
  return database
    .select({
      clientId: invoices.clientId,
      paidCents: sql<number>`cast(coalesce(sum(${payments.amountCents}), 0) as bigint)`.as(
        "paid_cents"
      )
    })
    .from(invoices)
    .innerJoin(payments, and(eq(payments.invoiceId, invoices.id), isNull(payments.deletedAt)))
    .where(
      and(
        isNotNull(invoices.clientId),
        isNull(invoices.deletedAt),
        inArray(invoices.status, OUTSTANDING_INVOICE_STATUSES)
      )
    )
    .groupBy(invoices.clientId)
    .as("client_payment_totals")
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
