import { describe, expect, test } from "vitest"

import { TEMPLATE_TYPES } from "../../schemas"
import { summarizeTemplates, type TemplateSummaryRow } from "../summarizeTemplates"

function makeRow(overrides: Partial<TemplateSummaryRow> = {}): TemplateSummaryRow {
  return { type: "invoice", isSystem: false, isDefault: false, ...overrides }
}

describe("summarizeTemplates", () => {
  test("returns an empty summary when there are no templates", () => {
    const summary = summarizeTemplates([])

    expect(summary.total).toBe(0)
    expect(summary.coveredTypes).toBe(0)
    expect(summary.totalTypes).toBe(TEMPLATE_TYPES.length)
    expect(Object.values(summary.byType).every((count) => count === 0)).toBe(true)
  })

  test("splits templates into custom and system counts", () => {
    const rows = [makeRow(), makeRow({ isSystem: true }), makeRow({ isSystem: true })]

    const summary = summarizeTemplates(rows)

    expect(summary.total).toBe(3)
    expect(summary.custom).toBe(1)
    expect(summary.system).toBe(2)
  })

  test("splits templates into document and email counts by category", () => {
    const rows = [
      makeRow({ type: "invoice" }),
      makeRow({ type: "credit_note" }),
      makeRow({ type: "email_invoice_send" }),
      makeRow({ type: "email_overdue_reminder" })
    ]

    const summary = summarizeTemplates(rows)

    expect(summary.documents).toBe(2)
    expect(summary.emails).toBe(2)
  })

  test("counts templates per type", () => {
    const rows = [
      makeRow({ type: "proposal" }),
      makeRow({ type: "proposal" }),
      makeRow({ type: "contract" })
    ]

    const summary = summarizeTemplates(rows)

    expect(summary.byType.proposal).toBe(2)
    expect(summary.byType.contract).toBe(1)
    expect(summary.byType.invoice).toBe(0)
  })

  test("counts a type once when several of its templates are flagged default", () => {
    const rows = [
      makeRow({ type: "invoice", isDefault: true }),
      makeRow({ type: "invoice", isDefault: true }),
      makeRow({ type: "contract", isDefault: true }),
      makeRow({ type: "proposal" })
    ]

    const summary = summarizeTemplates(rows)

    expect(summary.coveredTypes).toBe(2)
  })

  test("reports full coverage when every type has a default", () => {
    const rows = TEMPLATE_TYPES.map((type) => makeRow({ type, isDefault: true }))

    const summary = summarizeTemplates(rows)

    expect(summary.coveredTypes).toBe(summary.totalTypes)
  })
})
