import { describe, expect, test } from "vitest"

import { resolveInvoiceIssueDates } from "../invoiceDates"

describe("resolveInvoiceIssueDates", () => {
  test("stamps today as the issue date when the draft carries none", () => {
    const { issueDate } = resolveInvoiceIssueDates({
      now: new Date("2026-08-02T22:30:00.000Z"),
      currentIssueDate: null,
      currentDueDate: null,
      paymentTermsDays: 30
    })

    expect(issueDate.toISOString()).toBe("2026-08-02T00:00:00.000Z")
  })

  test("derives the due date from payment terms in whole UTC days", () => {
    const { dueDate } = resolveInvoiceIssueDates({
      now: new Date("2026-08-02T00:00:00.000Z"),
      currentIssueDate: null,
      currentDueDate: null,
      paymentTermsDays: 30
    })

    expect(dueDate.toISOString()).toBe("2026-09-01T00:00:00.000Z")
  })

  test("keeps an issue date the draft already carries", () => {
    const { issueDate } = resolveInvoiceIssueDates({
      now: new Date("2026-08-02T00:00:00.000Z"),
      currentIssueDate: new Date("2026-07-01T00:00:00.000Z"),
      currentDueDate: null,
      paymentTermsDays: 14
    })

    expect(issueDate.toISOString()).toBe("2026-07-01T00:00:00.000Z")
  })

  test("keeps a hand-picked due date that is not before the issue date", () => {
    const { dueDate } = resolveInvoiceIssueDates({
      now: new Date("2026-08-02T00:00:00.000Z"),
      currentIssueDate: null,
      currentDueDate: new Date("2026-08-10T00:00:00.000Z"),
      paymentTermsDays: 30
    })

    expect(dueDate.toISOString()).toBe("2026-08-10T00:00:00.000Z")
  })

  test("recomputes a stale due date that predates the issue date", () => {
    const { dueDate } = resolveInvoiceIssueDates({
      now: new Date("2026-08-02T00:00:00.000Z"),
      currentIssueDate: null,
      currentDueDate: new Date("2026-07-01T00:00:00.000Z"),
      paymentTermsDays: 7
    })

    expect(dueDate.toISOString()).toBe("2026-08-09T00:00:00.000Z")
  })

  test("makes the due date the issue date when payment terms are zero", () => {
    const { issueDate, dueDate } = resolveInvoiceIssueDates({
      now: new Date("2026-08-02T00:00:00.000Z"),
      currentIssueDate: null,
      currentDueDate: null,
      paymentTermsDays: 0
    })

    expect(dueDate.toISOString()).toBe(issueDate.toISOString())
  })
})
