import { faker } from "@faker-js/faker"

import { type InferInsertModel } from "drizzle-orm"

import { recurringInvoices } from "@/database/schema"

import { database } from "@/tests/integration/database"

import { makeClient } from "./clients"
import { resolveProjectClientId } from "./projectParent"

// `clientId` is NOT NULL with a cascading delete, so a schedule cannot exist without a client; the
// factory creates one rather than making every caller do it. Watch the two check constraints when
// overriding: `chk_recurring_invoices_end_condition` forbids setting `endAfterCount` and `endByDate`
// together, and `chk_recurring_invoices_retainer` requires `includedHours` and `overageRateCents` to
// be both null or both non-negative.
export async function makeRecurringInvoice(
  overrides?: Partial<InferInsertModel<typeof recurringInvoices>>
) {
  const clientId =
    (await resolveProjectClientId(overrides?.projectId, overrides?.clientId)) ??
    (await makeClient()).id

  const [schedule] = await database
    .insert(recurringInvoices)
    .values({
      name: faker.commerce.productName(),
      cadence: "monthly",
      // A `date` column: only the UTC day survives the round trip, so the value is built through
      // `Date.UTC` rather than the local-time constructor.
      nextRunAt: new Date(Date.UTC(2026, 7, 5)),
      currency: "EUR",
      ...overrides,
      clientId
    })
    .returning()

  if (!schedule) throw new Error("makeRecurringInvoice: insert failed")

  return schedule
}
