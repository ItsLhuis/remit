import { beforeEach, describe, expect, test, vi } from "vitest"

import { makeClient, makeExpense, makeInvoice, makeProject, makeUpload } from "@/tests/factories"

import { parseExpenseListQuery } from "../schemas"

const mocks = vi.hoisted(() => ({
  getSession: vi.fn()
}))

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mocks.getSession
    }
  }
}))

vi.mock("@/lib/auth/session", () => ({
  getSession: mocks.getSession
}))

const JANUARY = new Date("2026-01-15T00:00:00.000Z")
const AUGUST = new Date("2026-08-15T00:00:00.000Z")

async function listWith(searchParams: Record<string, string>) {
  const { listExpenses } = await import("../queries")

  return listExpenses(parseExpenseListQuery(searchParams))
}

describe("expense filters", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.getSession.mockResolvedValue(null)
  })

  test("returns only expenses on the selected project", async () => {
    const wanted = await makeProject()
    const other = await makeProject()

    await makeExpense({ projectId: wanted.id })
    await makeExpense({ projectId: other.id })

    const result = await listWith({ project: wanted.id })

    expect(result.rowCount).toBe(1)
    expect(result.rows[0]?.projectId).toBe(wanted.id)
  })

  test("returns only expenses on the selected client", async () => {
    const wanted = await makeClient()

    await makeExpense({ clientId: wanted.id })
    await makeExpense({ clientId: null })

    const result = await listWith({ client: wanted.id })

    expect(result.rowCount).toBe(1)
    expect(result.rows[0]?.clientId).toBe(wanted.id)
  })

  test("returns only expenses in the selected categories", async () => {
    await makeExpense({ category: "Travel" })
    await makeExpense({ category: "Software" })
    await makeExpense({ category: "Meals" })

    const result = await listWith({ category: "Travel,Software" })

    expect(result.rowCount).toBe(2)
    expect(result.rows.map((row) => row.category).sort()).toEqual(["Software", "Travel"])
  })

  test("returns only expenses in the selected currency", async () => {
    await makeExpense({ currency: "EUR" })
    await makeExpense({ currency: "USD" })

    const result = await listWith({ currency: "USD" })

    expect(result.rowCount).toBe(1)
    expect(result.rows[0]?.currency).toBe("USD")
  })

  test("returns only rebillable expenses when the rebillable filter is applied", async () => {
    await makeExpense({ rebillable: true })
    await makeExpense({ rebillable: false })

    const result = await listWith({ rebillable: "rebillable" })

    expect(result.rowCount).toBe(1)
    expect(result.rows[0]?.rebillable).toBe(true)
  })

  test("narrows nothing when both rebillable options are selected", async () => {
    await makeExpense({ rebillable: true })
    await makeExpense({ rebillable: false })

    const result = await listWith({ rebillable: "rebillable,nonRebillable" })

    expect(result.rowCount).toBe(2)
  })

  test("returns only unbilled expenses when the unbilled filter is applied", async () => {
    const invoice = await makeInvoice()

    await makeExpense({ invoicedInId: invoice.id })
    await makeExpense({ invoicedInId: null })

    const result = await listWith({ invoiced: "unbilled" })

    expect(result.rowCount).toBe(1)
    expect(result.rows[0]?.invoicedInId).toBeNull()
  })

  test("returns only expenses inside the spent range", async () => {
    await makeExpense({ spentAt: JANUARY })
    await makeExpense({ spentAt: AUGUST })

    const result = await listWith({
      spentAt: `${Date.UTC(2026, 7, 1)},${Date.UTC(2026, 7, 31)}`
    })

    expect(result.rowCount).toBe(1)
    expect(result.rows[0]?.spentAt.toISOString()).toBe(AUGUST.toISOString())
  })

  test("matches the search term against the description and the category", async () => {
    await makeExpense({ description: "Train to client site", category: "Travel" })
    await makeExpense({ description: "Design tool licence", category: "Software" })

    const byDescription = await listWith({ search: "Train" })
    const byCategory = await listWith({ search: "Softw" })

    expect(byDescription.rowCount).toBe(1)
    expect(byCategory.rowCount).toBe(1)
  })

  test("hides soft-deleted expenses by default and shows them on request", async () => {
    await makeExpense()
    await makeExpense({ deletedAt: new Date() })

    const active = await listWith({})
    const deleted = await listWith({ status: "deleted" })
    const all = await listWith({ status: "all" })

    expect(active.rowCount).toBe(1)
    expect(deleted.rowCount).toBe(1)
    expect(all.rowCount).toBe(2)
  })

  test("combines two filters rather than widening the result", async () => {
    const project = await makeProject()

    await makeExpense({ projectId: project.id, rebillable: true })
    await makeExpense({ projectId: project.id, rebillable: false })
    await makeExpense({ rebillable: true })

    const result = await listWith({ project: project.id, rebillable: "rebillable" })

    expect(result.rowCount).toBe(1)
  })

  test("carries the receipt file onto the read model", async () => {
    const upload = await makeUpload({ path: "expenses/receipt.pdf", mimeType: "application/pdf" })

    await makeExpense({ receiptUploadId: upload.id })

    const result = await listWith({})

    expect(result.rows[0]?.receipt).toEqual({
      uploadId: upload.id,
      filename: upload.filename,
      mimeType: "application/pdf",
      sizeBytes: upload.sizeBytes,
      path: "expenses/receipt.pdf"
    })
  })

  test("derives the rebillable amount from the amount and the markup", async () => {
    await makeExpense({ amountCents: 10_000, rebillable: true, markupPercentage: "15.00" })

    const result = await listWith({})

    expect(result.rows[0]?.rebillableCents).toBe(11_500)
  })
})

describe("listExpensesForExport", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.getSession.mockResolvedValue(null)
  })

  // The list is paginated and the export is not; a page-sized export would silently omit rows the
  // freelancer believes they are downloading.
  test("returns every filtered row rather than the first page", async () => {
    const { listExpensesForExport } = await import("../queries")

    for (let index = 0; index < 3; index += 1) {
      await makeExpense({ category: "Travel" })
    }

    const rows = await listExpensesForExport(
      parseExpenseListQuery({ category: "Travel", perPage: "2" })
    )

    expect(rows).toHaveLength(3)
  })

  test("applies the same filters as the list", async () => {
    const { listExpensesForExport } = await import("../queries")

    await makeExpense({ category: "Travel" })
    await makeExpense({ category: "Software" })

    const rows = await listExpensesForExport(parseExpenseListQuery({ category: "Travel" }))

    expect(rows).toHaveLength(1)
    expect(rows[0]?.category).toBe("Travel")
  })
})
