import { eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, expenses, uploads } from "@/database/schema"

import {
  makeClient,
  makeExpense,
  makeInvoice,
  makeProject,
  makeSettings,
  makeUpload,
  makeUser
} from "@/tests/factories"
import { database } from "@/tests/integration/database"

import { parseExpenseListQuery } from "../schemas"

const mocks = vi.hoisted(() => ({
  deleteStorageObject: vi.fn(),
  emit: vi.fn(),
  getStorageObjectBytes: vi.fn(),
  getCurrentRole: vi.fn(),
  getSession: vi.fn(),
  headers: vi.fn(),
  loggerError: vi.fn(),
  revalidatePath: vi.fn()
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}))

vi.mock("next/headers", () => ({
  headers: mocks.headers
}))

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mocks.getSession
    }
  }
}))

vi.mock("@/lib/auth/session", () => ({
  getCurrentRole: mocks.getCurrentRole,
  getSession: mocks.getSession
}))

vi.mock("@/lib/events", () => ({
  emit: mocks.emit
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    fatal: vi.fn(),
    warn: vi.fn()
  }
}))

vi.mock("@/lib/storage/s3", () => ({
  deleteStorageObject: mocks.deleteStorageObject,
  getStorageObjectBytes: mocks.getStorageObjectBytes
}))

const ownerId = "00000000-0000-4000-8000-000000000c01"
const ownerEmail = "owner-expenses@example.com"

const receipt = {
  objectKey: "expenses/00000000-0000-4000-8000-000000000c02.pdf",
  filename: "ticket.pdf",
  mimeType: "application/pdf",
  sizeBytes: 24_000
}

function expenseInput(overrides?: Record<string, unknown>) {
  return {
    projectId: "",
    clientId: "",
    spentAt: "2026-08-06",
    amount: "120.50",
    currency: "EUR",
    category: "Travel",
    description: "Train to client site",
    rebillable: false,
    markupPercentage: "",
    receipt: null,
    ...overrides
  }
}

describe("expense mutations", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    // `confirmExpenseReceipt` verifies the stored object before it inserts into `uploads`
    // (lib/storage/verifyUploadedObject.ts), and the row's size and checksum come from these bytes.
    mocks.getStorageObjectBytes.mockResolvedValue(Buffer.from("stored-receipt-bytes"))

    await makeUser({ id: ownerId, email: ownerEmail })
    await makeSettings()

    mocks.headers.mockResolvedValue(
      new Headers({
        "user-agent": "Vitest",
        "x-forwarded-for": "203.0.113.50, 198.51.100.2"
      })
    )
    mocks.getSession.mockResolvedValue({ user: { id: ownerId, email: ownerEmail } })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("stores the amount in whole cents", async () => {
    const { createExpense } = await import("../mutations")

    const result = await createExpense(expenseInput())
    const [row] = await database.select().from(expenses)

    expect("data" in result).toBe(true)
    expect(row?.amountCents).toBe(12_050)
    expect(row?.currency).toBe("EUR")
  })

  test("creates an expense with no receipt and no scope", async () => {
    const { createExpense } = await import("../mutations")

    await createExpense(expenseInput())
    const [row] = await database.select().from(expenses)
    const uploadRows = await database.select().from(uploads)

    expect(row?.receiptUploadId).toBeNull()
    expect(row?.projectId).toBeNull()
    expect(row?.clientId).toBeNull()
    expect(uploadRows).toHaveLength(0)
  })

  test("records the receipt in uploads and points the expense at it", async () => {
    const { createExpense } = await import("../mutations")

    await createExpense(expenseInput({ receipt }))
    const [row] = await database.select().from(expenses)
    const [upload] = await database.select().from(uploads)

    expect(upload?.path).toBe(receipt.objectKey)
    expect(upload?.mimeType).toBe("application/pdf")
    expect(row?.receiptUploadId).toBe(upload?.id)
  })

  test("refuses a receipt keyed outside the expenses prefix", async () => {
    const { createExpense } = await import("../mutations")

    const result = await createExpense(
      expenseInput({ receipt: { ...receipt, objectKey: "avatars/someone/secret.png" } })
    )
    const rows = await database.select().from(expenses)

    expect("error" in result).toBe(true)
    expect(rows).toHaveLength(0)
  })

  test("stores a markup on a rebillable expense", async () => {
    const { createExpense } = await import("../mutations")

    await createExpense(expenseInput({ rebillable: true, markupPercentage: "12.5" }))
    const [row] = await database.select().from(expenses)

    expect(row?.rebillable).toBe(true)
    expect(Number(row?.markupPercentage)).toBe(12.5)
  })

  test("refuses a markup above the bound the check constraint enforces", async () => {
    const { createExpense } = await import("../mutations")

    const result = await createExpense(expenseInput({ rebillable: true, markupPercentage: "1001" }))
    const rows = await database.select().from(expenses)

    expect("error" in result).toBe(true)
    expect(rows).toHaveLength(0)
  })

  test("refuses a client that does not own the selected project", async () => {
    const { createExpense } = await import("../mutations")

    const project = await makeProject()
    const otherClient = await makeClient()

    const result = await createExpense(
      expenseInput({ projectId: project.id, clientId: otherClient.id })
    )

    expect("error" in result).toBe(true)
  })

  test("accepts the project's own client", async () => {
    const { createExpense } = await import("../mutations")

    const client = await makeClient()
    const project = await makeProject({ clientId: client.id })

    const result = await createExpense(expenseInput({ projectId: project.id, clientId: client.id }))
    const [row] = await database.select().from(expenses)

    expect("data" in result).toBe(true)
    expect(row?.projectId).toBe(project.id)
    expect(row?.clientId).toBe(client.id)
  })

  test("emits expense.created once the row exists", async () => {
    const { createExpense } = await import("../mutations")

    await createExpense(expenseInput({ rebillable: true }))
    const [row] = await database.select().from(expenses)

    expect(mocks.emit).toHaveBeenCalledWith("expense.created", {
      expenseId: row?.id,
      projectId: null,
      clientId: null,
      userId: ownerId,
      rebillable: true
    })
  })

  test("writes an audit entry carrying the request metadata", async () => {
    const { createExpense } = await import("../mutations")

    await createExpense(expenseInput())
    const [entry] = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.event, "expense.created"))

    expect(entry?.actorUserId).toBe(ownerId)
    expect(entry?.targetEntityType).toBe("expense")
    expect(entry?.ipAddress).toBe("203.0.113.50")
    expect(entry?.userAgent).toBe("Vitest")
  })

  test("replaces the receipt and discards the object the expense stopped pointing at", async () => {
    const { updateExpense } = await import("../mutations")

    const upload = await makeUpload({ path: "expenses/old.pdf" })
    const expense = await makeExpense({ receiptUploadId: upload.id })

    const nextReceipt = { ...receipt, objectKey: "expenses/new.pdf" }

    await updateExpense(expenseInput({ id: expense.id, receipt: nextReceipt }))
    const [row] = await database.select().from(expenses).where(eq(expenses.id, expense.id))
    const uploadRows = await database.select().from(uploads)

    expect(uploadRows).toHaveLength(1)
    expect(uploadRows[0]?.path).toBe("expenses/new.pdf")
    expect(row?.receiptUploadId).toBe(uploadRows[0]?.id)
    expect(mocks.deleteStorageObject).toHaveBeenCalledWith("expenses/old.pdf")
  })

  test("keeps the existing receipt when the form sends the key back unchanged", async () => {
    const { updateExpense } = await import("../mutations")

    const upload = await makeUpload({ path: "expenses/kept.pdf" })
    const expense = await makeExpense({ receiptUploadId: upload.id })

    await updateExpense(
      expenseInput({ id: expense.id, receipt: { ...receipt, objectKey: "expenses/kept.pdf" } })
    )
    const [row] = await database.select().from(expenses).where(eq(expenses.id, expense.id))

    expect(row?.receiptUploadId).toBe(upload.id)
    expect(mocks.deleteStorageObject).not.toHaveBeenCalled()
  })

  test("detaches the receipt when the form sends none", async () => {
    const { updateExpense } = await import("../mutations")

    const upload = await makeUpload({ path: "expenses/dropped.pdf" })
    const expense = await makeExpense({ receiptUploadId: upload.id })

    await updateExpense(expenseInput({ id: expense.id, receipt: null }))
    const [row] = await database.select().from(expenses).where(eq(expenses.id, expense.id))
    const uploadRows = await database.select().from(uploads)

    expect(row?.receiptUploadId).toBeNull()
    expect(uploadRows).toHaveLength(0)
    expect(mocks.deleteStorageObject).toHaveBeenCalledWith("expenses/dropped.pdf")
  })

  test("refuses to edit an expense that is already on an invoice", async () => {
    const { updateExpense } = await import("../mutations")

    const invoice = await makeInvoice()
    const expense = await makeExpense({ invoicedInId: invoice.id, amountCents: 1000 })

    const result = await updateExpense(expenseInput({ id: expense.id, amount: "999.00" }))
    const [row] = await database.select().from(expenses).where(eq(expenses.id, expense.id))

    expect("error" in result).toBe(true)
    expect(row?.amountCents).toBe(1000)
  })

  test("soft deletes rather than removing the row", async () => {
    const { softDeleteExpense } = await import("../mutations")

    const expense = await makeExpense()

    await softDeleteExpense({ id: expense.id })
    const [row] = await database.select().from(expenses).where(eq(expenses.id, expense.id))

    expect(row?.deletedAt).not.toBeNull()
  })

  test("refuses to delete an expense that is already on an invoice", async () => {
    const { softDeleteExpense } = await import("../mutations")

    const invoice = await makeInvoice()
    const expense = await makeExpense({ invoicedInId: invoice.id })

    const result = await softDeleteExpense({ id: expense.id })
    const [row] = await database.select().from(expenses).where(eq(expenses.id, expense.id))

    expect("error" in result).toBe(true)
    expect(row?.deletedAt).toBeNull()
  })

  test("refuses a write from a role that may only read", async () => {
    const { createExpense } = await import("../mutations")

    mocks.getCurrentRole.mockResolvedValue("accountant")

    const result = await createExpense(expenseInput())
    const rows = await database.select().from(expenses)

    expect("error" in result).toBe(true)
    expect(rows).toHaveLength(0)
  })
})

describe("exportExpensesCsv", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })
    await makeSettings()

    mocks.headers.mockResolvedValue(
      new Headers({
        "user-agent": "Vitest",
        "x-forwarded-for": "203.0.113.50, 198.51.100.2"
      })
    )
    mocks.getSession.mockResolvedValue({ user: { id: ownerId, email: ownerEmail } })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("exports only the filtered set", async () => {
    const { exportExpensesCsv } = await import("../mutations")

    await makeExpense({ category: "Travel" })
    await makeExpense({ category: "Software" })

    const result = await exportExpensesCsv(parseExpenseListQuery({ category: "Travel" }))

    expect("data" in result && result.data.rowCount).toBe(1)
  })

  test("keeps a description containing a comma, a quote and a newline in one field", async () => {
    const { exportExpensesCsv } = await import("../mutations")

    const description = 'Taxi, hotel and "extras"\nreimbursed later'

    await makeExpense({ description })

    const result = await exportExpensesCsv(parseExpenseListQuery({}))

    expect("data" in result).toBe(true)

    if (!("data" in result)) return

    expect(result.data.csv).toContain('"Taxi, hotel and ""extras""\nreimbursed later"')
    expect(result.data.filename).toMatch(/^expenses-\d{4}-\d{2}-\d{2}\.csv$/)
  })

  // The description and the category are free text, and the export is opened in a spreadsheet by
  // whoever does the books. Anything the freelancer or an intake form put in those columns must
  // arrive as text, never as something Excel evaluates.
  test("defuses a description a spreadsheet would evaluate as a formula", async () => {
    const { exportExpensesCsv } = await import("../mutations")

    await makeExpense({
      description: '=HYPERLINK("http://evil.test","Refund")',
      category: "@SUM(1+1)"
    })

    const result = await exportExpensesCsv(parseExpenseListQuery({}))

    expect("data" in result).toBe(true)

    if (!("data" in result)) return

    expect(result.data.csv).toContain(`'=HYPERLINK`)
    expect(result.data.csv).toContain(`'@SUM(1+1)`)
    expect(result.data.csv).not.toMatch(/(^|,)=HYPERLINK/)
  })

  test("writes an audit entry with the filter snapshot, the row count and the request metadata", async () => {
    const { exportExpensesCsv } = await import("../mutations")

    await makeExpense({ category: "Travel", rebillable: true })

    await exportExpensesCsv(parseExpenseListQuery({ category: "Travel", rebillable: "rebillable" }))
    const [entry] = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.event, "expense.exported"))

    expect(entry?.actorUserId).toBe(ownerId)
    expect(entry?.ipAddress).toBe("203.0.113.50")
    expect(entry?.userAgent).toBe("Vitest")
    expect(entry?.metadata).toMatchObject({
      rowCount: 1,
      filters: { categories: ["Travel"], rebillable: ["rebillable"] }
    })
  })

  test("refuses an export from a role that may only enter expenses", async () => {
    const { exportExpensesCsv } = await import("../mutations")

    mocks.getCurrentRole.mockResolvedValue("assistant")

    const result = await exportExpensesCsv(parseExpenseListQuery({}))
    const entries = await database
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.event, "expense.exported"))

    expect("error" in result).toBe(true)
    expect(entries).toHaveLength(0)
  })
})
