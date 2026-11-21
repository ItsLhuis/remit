import { describe, expect, test } from "vitest"

import {
  summarizeInvoiceLifecycle,
  type LifecycleInvoiceRow,
  type LifecycleStageId
} from "../summarizeInvoiceLifecycle"

function makeRow(overrides: Partial<LifecycleInvoiceRow> = {}): LifecycleInvoiceRow {
  return {
    status: "sent",
    currency: "EUR",
    totalCents: 100_000,
    receivableCents: 100_000,
    viewCount: 0,
    isOverdue: false,
    ...overrides
  }
}

function stageOf(rows: LifecycleInvoiceRow[], id: LifecycleStageId) {
  return summarizeInvoiceLifecycle(rows, "EUR").stages.find((stage) => stage.id === id)
}

describe("summarizeInvoiceLifecycle", () => {
  test("returns all five stages in order for an instance with no invoices", () => {
    const lifecycle = summarizeInvoiceLifecycle([], "EUR")

    expect(lifecycle.stages.map((stage) => stage.id)).toEqual([
      "draft",
      "sent",
      "viewed",
      "overdue",
      "paid"
    ])
    expect(lifecycle.issuedCount).toBe(0)
  })

  test("does not count a draft as issued", () => {
    const lifecycle = summarizeInvoiceLifecycle([makeRow({ status: "draft" })], "EUR")

    expect(lifecycle.issuedCount).toBe(0)
    expect(lifecycle.unviewedCount).toBe(0)
  })

  test("counts a viewed sent invoice in both sent and viewed", () => {
    const rows = [makeRow({ viewCount: 3 })]

    expect(stageOf(rows, "sent")?.count).toBe(1)
    expect(stageOf(rows, "viewed")?.count).toBe(1)
  })

  test("counts an overdue invoice the client never opened in sent and overdue but not viewed", () => {
    const rows = [makeRow({ isOverdue: true, viewCount: 0 })]

    expect(stageOf(rows, "sent")?.count).toBe(1)
    expect(stageOf(rows, "overdue")?.count).toBe(1)
    expect(stageOf(rows, "viewed")?.count).toBe(0)
  })

  test("reports how many issued invoices have never been opened", () => {
    const rows = [
      makeRow({ viewCount: 0 }),
      makeRow({ viewCount: 2 }),
      makeRow({ status: "paid", viewCount: 0 }),
      makeRow({ status: "draft", viewCount: 0 })
    ]

    expect(summarizeInvoiceLifecycle(rows, "EUR").unviewedCount).toBe(2)
  })

  test("values a sent invoice by what is still owed and a paid one by its total", () => {
    const rows = [
      makeRow({ totalCents: 100_000, receivableCents: 40_000 }),
      makeRow({ status: "paid", totalCents: 80_000, receivableCents: 0 })
    ]

    expect(stageOf(rows, "sent")?.cents).toBe(40_000)
    expect(stageOf(rows, "paid")?.cents).toBe(80_000)
  })

  test("ignores invoices billed in another currency", () => {
    const rows = [makeRow(), makeRow({ currency: "USD" })]

    expect(summarizeInvoiceLifecycle(rows, "EUR").issuedCount).toBe(1)
  })
})
