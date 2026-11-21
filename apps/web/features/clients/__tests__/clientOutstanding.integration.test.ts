import { expect, test } from "vitest"

import { makeClient, makeCreditNote, makeInvoice } from "@/tests/factories"

import { parseClientListQuery } from "../schemas"

// `queryFragments.ts`'s per-client subquery restates the invoice outstanding definition in SQL rather
// than importing it, so this pins it: each invoice contributes what it still owes after payments and
// credit notes, clamped on its own, and a draft contributes nothing.
test("reports a client's balance as the sum of what each of its invoices still owes", async () => {
  const client = await makeClient({ name: "Acme" })

  const credited = await makeInvoice({
    clientId: client.id,
    status: "sent",
    totalCents: 30000,
    amountPaidCents: 5000
  })
  const overCredited = await makeInvoice({
    clientId: client.id,
    status: "sent",
    totalCents: 20000,
    amountPaidCents: 0
  })

  await makeInvoice({ clientId: client.id, status: "draft", totalCents: 50000 })
  await makeInvoice({
    clientId: client.id,
    status: "paid",
    totalCents: 10000,
    amountPaidCents: 10000
  })
  await makeCreditNote({ invoiceId: credited.id, subtotalCents: 10000, totalCents: 10000 })
  await makeCreditNote({ invoiceId: overCredited.id, subtotalCents: 25000, totalCents: 25000 })

  const { listClients } = await import("../queries")

  const { rows } = await listClients(parseClientListQuery({}))

  expect(rows.find((row) => row.id === client.id)?.outstandingBalanceCents).toBe(15000)
})
