import { expect, test } from "vitest"

import { makeCreditNote, makeInvoice, makeProject, makeSettings } from "@/tests/factories"

import { parseInvoiceOverviewQuery } from "../schemas"

// `queryFragments.ts`'s SQL mirror decides the order the invoice list sorts by, and the pure
// `getInvoiceOutstandingCents` decides the amount each row prints. The two must agree for every
// combination of payments and credit notes, including an invoice credited past what it owed.
test("sorts the invoice list by the same outstanding amount each row prints", async () => {
  await makeSettings()

  const project = await makeProject()

  const cases = [
    { number: "INV-CREDITED", totalCents: 30000, amountPaidCents: 5000, creditedCents: 10000 },
    { number: "INV-OVERCREDITED", totalCents: 20000, amountPaidCents: 0, creditedCents: 25000 },
    { number: "INV-UNTOUCHED", totalCents: 12000, amountPaidCents: 0, creditedCents: 0 },
    { number: "INV-PARTIAL", totalCents: 40000, amountPaidCents: 30000, creditedCents: 0 }
  ]

  for (const item of cases) {
    const invoice = await makeInvoice({
      projectId: project.id,
      number: item.number,
      status: "sent",
      totalCents: item.totalCents,
      amountPaidCents: item.amountPaidCents
    })

    if (item.creditedCents > 0) {
      await makeCreditNote({
        invoiceId: invoice.id,
        subtotalCents: item.creditedCents,
        totalCents: item.creditedCents
      })
    }
  }

  const { listInvoiceOverview } = await import("../overviewQueries")

  const { rows } = await listInvoiceOverview(
    { ...parseInvoiceOverviewQuery({}), sort: [{ id: "outstanding", desc: true }] },
    "EUR",
    new Date("2026-09-01T12:00:00.000Z")
  )

  expect(rows.map((row) => [row.number, row.outstandingCents])).toEqual([
    ["INV-CREDITED", 15000],
    ["INV-UNTOUCHED", 12000],
    ["INV-PARTIAL", 10000],
    ["INV-OVERCREDITED", 0]
  ])
})
