import { describe, expect, test } from "vitest"

import { selectUpcomingInvoices, type UpcomingInvoiceRow } from "../selectUpcomingInvoices"

const NOW = new Date("2026-08-10T13:45:12.000Z")

function makeRow(overrides: Partial<UpcomingInvoiceRow> = {}): UpcomingInvoiceRow {
  return {
    id: "invoice-1",
    number: "INV-0001",
    parentName: "Acme",
    currency: "EUR",
    dueDate: new Date("2026-08-20T00:00:00.000Z"),
    receivableCents: 50_000,
    ...overrides
  }
}

describe("selectUpcomingInvoices", () => {
  test("reports an invoice due today as zero days away", () => {
    const rows = [makeRow({ dueDate: new Date("2026-08-10T00:00:00.000Z") })]

    expect(selectUpcomingInvoices(rows, NOW)[0]?.daysUntilDue).toBe(0)
  })

  test("includes an invoice due on the last day of the window", () => {
    const rows = [makeRow({ dueDate: new Date("2026-09-09T00:00:00.000Z") })]

    expect(selectUpcomingInvoices(rows, NOW)).toHaveLength(1)
  })

  test("excludes an invoice due one day past the window", () => {
    const rows = [makeRow({ dueDate: new Date("2026-09-10T00:00:00.000Z") })]

    expect(selectUpcomingInvoices(rows, NOW)).toEqual([])
  })

  test("excludes an invoice whose due date has already passed", () => {
    const rows = [makeRow({ dueDate: new Date("2026-08-09T00:00:00.000Z") })]

    expect(selectUpcomingInvoices(rows, NOW)).toEqual([])
  })

  test("excludes an invoice with no due date", () => {
    expect(selectUpcomingInvoices([makeRow({ dueDate: null })], NOW)).toEqual([])
  })

  test("excludes an invoice that no longer owes anything", () => {
    expect(selectUpcomingInvoices([makeRow({ receivableCents: 0 })], NOW)).toEqual([])
  })

  test("orders the soonest due invoice first", () => {
    const rows = [
      makeRow({ id: "later", dueDate: new Date("2026-08-25T00:00:00.000Z") }),
      makeRow({ id: "sooner", dueDate: new Date("2026-08-12T00:00:00.000Z") })
    ]

    expect(selectUpcomingInvoices(rows, NOW).map((invoice) => invoice.id)).toEqual([
      "sooner",
      "later"
    ])
  })

  test("caps the list at the requested limit", () => {
    const rows = Array.from({ length: 8 }, (_, index) =>
      makeRow({ id: `invoice-${index}`, dueDate: new Date("2026-08-20T00:00:00.000Z") })
    )

    expect(selectUpcomingInvoices(rows, NOW)).toHaveLength(5)
  })
})
