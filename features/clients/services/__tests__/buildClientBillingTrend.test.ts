import { expect, test } from "vitest"

import {
  buildClientBillingTrend,
  type ClientBillingTrendInput,
  type ClientInvoiceTrendRow
} from "../buildClientBillingTrend"

const NOW = new Date("2026-06-08T12:00:00.000Z")

function makeInput(overrides: Partial<ClientBillingTrendInput> = {}): ClientBillingTrendInput {
  return {
    invoices: [],
    projects: [],
    recurringInvoices: [],
    ...overrides
  }
}

function makeRow(overrides: Partial<ClientInvoiceTrendRow> = {}): ClientInvoiceTrendRow {
  return {
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    totalCents: 0,
    ...overrides
  }
}

test("returns six month buckets ending on the current month", () => {
  const trend = buildClientBillingTrend(makeInput(), NOW)

  expect(trend.map((point) => point.month)).toEqual([
    "2026-01",
    "2026-02",
    "2026-03",
    "2026-04",
    "2026-05",
    "2026-06"
  ])
})

test("sums billed cents and counts invoices within each month", () => {
  const input = makeInput({
    invoices: [
      makeRow({ createdAt: new Date("2026-05-03T00:00:00.000Z"), totalCents: 1000 }),
      makeRow({ createdAt: new Date("2026-05-20T00:00:00.000Z"), totalCents: 2500 }),
      makeRow({ createdAt: new Date("2026-06-02T00:00:00.000Z"), totalCents: 4000 })
    ]
  })

  const trend = buildClientBillingTrend(input, NOW)

  expect(trend.find((point) => point.month === "2026-05")).toEqual({
    month: "2026-05",
    billedCents: 3500,
    invoiceCount: 2,
    projectCount: 0,
    recurringCount: 0
  })
  expect(trend.find((point) => point.month === "2026-06")).toEqual({
    month: "2026-06",
    billedCents: 4000,
    invoiceCount: 1,
    projectCount: 0,
    recurringCount: 0
  })
})

test("counts projects and recurring invoices created within each month", () => {
  const input = makeInput({
    projects: [
      { createdAt: new Date("2026-05-10T00:00:00.000Z") },
      { createdAt: new Date("2026-06-04T00:00:00.000Z") }
    ],
    recurringInvoices: [{ createdAt: new Date("2026-06-01T00:00:00.000Z") }]
  })

  const trend = buildClientBillingTrend(input, NOW)

  expect(trend.find((point) => point.month === "2026-05")?.projectCount).toBe(1)
  expect(trend.find((point) => point.month === "2026-06")?.projectCount).toBe(1)
  expect(trend.find((point) => point.month === "2026-06")?.recurringCount).toBe(1)
})

test("excludes invoices outside the trend window", () => {
  const input = makeInput({
    invoices: [makeRow({ createdAt: new Date("2025-12-31T23:59:59.000Z"), totalCents: 9999 })]
  })

  const trend = buildClientBillingTrend(input, NOW)

  expect(trend.every((point) => point.billedCents === 0 && point.invoiceCount === 0)).toBe(true)
})

test("crosses year boundaries when the window spans into the previous year", () => {
  const trend = buildClientBillingTrend(makeInput(), new Date("2026-02-15T00:00:00.000Z"))

  expect(trend.map((point) => point.month)).toEqual([
    "2025-09",
    "2025-10",
    "2025-11",
    "2025-12",
    "2026-01",
    "2026-02"
  ])
})
