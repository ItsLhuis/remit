import { describe, expect, test } from "vitest"

import {
  summarizeReceivablesAging,
  type AgingBucketId,
  type AgingInvoiceRow
} from "../summarizeReceivablesAging"

const NOW = new Date("2026-08-17T09:30:00.000Z")

function makeRow(overrides: Partial<AgingInvoiceRow> = {}): AgingInvoiceRow {
  return {
    currency: "EUR",
    receivableCents: 10_000,
    dueDate: new Date("2026-09-01T00:00:00.000Z"),
    ...overrides
  }
}

function bucketOf(rows: AgingInvoiceRow[], id: AgingBucketId) {
  const aging = summarizeReceivablesAging(rows, "EUR", NOW)

  return aging.buckets.find((bucket) => bucket.id === id)
}

describe("summarizeReceivablesAging", () => {
  test("returns all four buckets in order even when the instance has no receivable", () => {
    const aging = summarizeReceivablesAging([], "EUR", NOW)

    expect(aging.buckets.map((bucket) => bucket.id)).toEqual([
      "notDue",
      "days1To30",
      "days31To60",
      "days61Plus"
    ])
    expect(aging.totalCents).toBe(0)
  })

  test("counts an invoice with no due date as current", () => {
    expect(bucketOf([makeRow({ dueDate: null })], "notDue")?.cents).toBe(10_000)
  })

  test("counts an invoice due today as current rather than late", () => {
    const rows = [makeRow({ dueDate: new Date("2026-08-17T23:00:00.000Z") })]

    expect(bucketOf(rows, "notDue")?.cents).toBe(10_000)
    expect(summarizeReceivablesAging(rows, "EUR", NOW).lateCents).toBe(0)
  })

  test("counts an invoice one day past its due date in the first late bucket", () => {
    const rows = [makeRow({ dueDate: new Date("2026-08-16T00:00:00.000Z") })]

    expect(bucketOf(rows, "days1To30")?.count).toBe(1)
  })

  test("keeps a thirty-day-old invoice out of the thirty-one-to-sixty bucket", () => {
    const rows = [makeRow({ dueDate: new Date("2026-07-18T00:00:00.000Z") })]

    expect(bucketOf(rows, "days1To30")?.count).toBe(1)
    expect(bucketOf(rows, "days31To60")?.count).toBe(0)
  })

  test("places an invoice sixty-one days late in the oldest bucket", () => {
    const rows = [makeRow({ dueDate: new Date("2026-06-17T00:00:00.000Z") })]

    expect(bucketOf(rows, "days61Plus")?.count).toBe(1)
  })

  test("reports the age of the oldest late invoice", () => {
    const rows = [
      makeRow({ dueDate: new Date("2026-08-10T00:00:00.000Z") }),
      makeRow({ dueDate: new Date("2026-05-17T00:00:00.000Z") })
    ]

    expect(summarizeReceivablesAging(rows, "EUR", NOW).oldestDaysLate).toBe(92)
  })

  test("ignores invoices billed in another currency", () => {
    const rows = [makeRow(), makeRow({ currency: "USD", receivableCents: 99_000 })]

    expect(summarizeReceivablesAging(rows, "EUR", NOW).totalCents).toBe(10_000)
  })

  test("ignores a fully settled invoice", () => {
    expect(
      summarizeReceivablesAging([makeRow({ receivableCents: 0 })], "EUR", NOW).totalCents
    ).toBe(0)
  })

  test("reports each bucket's share of the whole receivable", () => {
    const rows = [
      makeRow({ receivableCents: 75_000 }),
      makeRow({ receivableCents: 25_000, dueDate: new Date("2026-08-01T00:00:00.000Z") })
    ]

    expect(bucketOf(rows, "notDue")?.sharePercentage).toBe(75)
    expect(bucketOf(rows, "days1To30")?.sharePercentage).toBe(25)
  })
})
