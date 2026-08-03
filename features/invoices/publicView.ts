import { and, eq, isNull, ne, sql } from "drizzle-orm"

import { database } from "@/database"
import { invoices } from "@/database/schema"

import { publicInvoiceTokenSchema } from "./schemas"

// The write side of `/i/[token]`, paired with the read side in `publicQueries.ts`.

// One statement and no preceding read: the counter moves in SQL rather than read-modify-write, so
// two simultaneous views cannot lose each other and `chk_invoices_view_count` can only ever be
// pushed upward. `coalesce` is what makes `first_viewed_at` stick to the first view.
//
// It is keyed on the token because the public read model deliberately carries neither the invoice id
// nor the token, and it returns nothing at all: a caller cannot tell a view that landed from one
// that did not, so this cannot be turned into an existence oracle. The token is never logged.
export async function recordPublicInvoiceView(input: unknown): Promise<void> {
  const parsed = publicInvoiceTokenSchema.safeParse(input)

  if (!parsed.success) return

  const viewedAt = new Date()

  await database
    .update(invoices)
    .set({
      // `.toISOString()` because a raw `sql` fragment bypasses the column's own driver mapping, and
      // the Postgres client cannot serialize a bare `Date` on its own.
      firstViewedAt: sql`coalesce(${invoices.firstViewedAt}, ${viewedAt.toISOString()}::timestamptz)`,
      lastViewedAt: viewedAt,
      viewCount: sql`${invoices.viewCount} + 1`
    })
    .where(
      and(
        eq(invoices.publicToken, parsed.data.token),
        ne(invoices.status, "draft"),
        isNull(invoices.deletedAt)
      )
    )
}
