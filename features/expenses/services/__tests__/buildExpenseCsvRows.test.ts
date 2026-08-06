import { describe, expect, test } from "vitest"

import { serializeCsv } from "@/lib/utils"

import { buildExpenseCsvRows, type ExpenseCsvRow } from "../buildExpenseCsvRows"

const headers = {
  spentAt: "Date",
  category: "Category",
  description: "Description",
  project: "Project",
  client: "Client",
  amount: "Amount",
  currency: "Currency",
  rebillable: "Rebillable",
  markupPercentage: "Markup %",
  rebillableAmount: "Rebillable amount",
  invoiced: "Invoiced",
  receipt: "Receipt"
}

const booleans = { yes: "Yes", no: "No" }

function expense(overrides: Partial<ExpenseCsvRow> = {}): ExpenseCsvRow {
  return {
    spentAt: new Date("2026-08-06T00:00:00.000Z"),
    category: "Travel",
    description: "Train to client site",
    projectName: "Website rebuild",
    clientName: "Acme",
    amountCents: 12_050,
    currency: "EUR",
    rebillable: true,
    markupPercentage: null,
    invoicedInId: null,
    receiptFilename: "ticket.pdf",
    ...overrides
  }
}

describe("buildExpenseCsvRows", () => {
  test("puts the translated headers in the first row", () => {
    const rows = buildExpenseCsvRows({ expenses: [], headers, booleans })

    expect(rows).toEqual([Object.values(headers)])
  })

  test("writes the day as an ISO date and the amount as a plain decimal", () => {
    const [, row] = buildExpenseCsvRows({ expenses: [expense()], headers, booleans })

    expect(row?.[0]).toBe("2026-08-06")
    expect(row?.[5]).toBe("120.50")
    expect(row?.[6]).toBe("EUR")
  })

  test("writes the marked-up amount rather than the raw cost when a markup applies", () => {
    const [, row] = buildExpenseCsvRows({
      expenses: [expense({ markupPercentage: 10 })],
      headers,
      booleans
    })

    expect(row?.[8]).toBe("10")
    expect(row?.[9]).toBe("132.55")
  })

  test("writes a zero rebillable amount for an expense the freelancer absorbs", () => {
    const [, row] = buildExpenseCsvRows({
      expenses: [expense({ rebillable: false })],
      headers,
      booleans
    })

    expect(row?.[7]).toBe("No")
    expect(row?.[9]).toBe("0.00")
  })

  test("writes empty cells for a missing project, client and receipt", () => {
    const [, row] = buildExpenseCsvRows({
      expenses: [expense({ projectName: null, clientName: null, receiptFilename: null })],
      headers,
      booleans
    })

    expect(row?.[3]).toBe("")
    expect(row?.[4]).toBe("")
    expect(row?.[11]).toBe("")
  })

  test("serializes a description containing a comma, a quote and a newline into one field", () => {
    const description = 'Taxi, hotel and "extras"\nreimbursed later'

    const csv = serializeCsv(
      buildExpenseCsvRows({ expenses: [expense({ description })], headers, booleans })
    )

    expect(csv).toContain('"Taxi, hotel and ""extras""\nreimbursed later"')
  })
})
