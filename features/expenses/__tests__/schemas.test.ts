import { describe, expect, test } from "vitest"

import {
  expenseFormSchema,
  parseExpenseListQuery,
  updateExpenseSchema,
  EXPENSE_RECEIPT_MAX_BYTES,
  type ExpenseFormInputValues
} from "../schemas"

const PROJECT_ID = "00000000-0000-4000-8000-000000000001"
const CLIENT_ID = "00000000-0000-4000-8000-000000000002"

const receipt = {
  objectKey: "expenses/00000000-0000-4000-8000-000000000003.pdf",
  filename: "ticket.pdf",
  mimeType: "application/pdf",
  sizeBytes: 24_000
}

const formInput: ExpenseFormInputValues = {
  projectId: "",
  clientId: "",
  spentAt: "2026-08-06",
  amount: "120.50",
  currency: "eur",
  category: "Travel",
  description: "Train to client site",
  rebillable: false,
  markupPercentage: "",
  receipt: null
}

describe("expenseFormSchema money", () => {
  test("accepts the values ExpenseForm holds", () => {
    const result = expenseFormSchema.safeParse(formInput)

    expect(result.success).toBe(true)
  })

  test("parses a decimal amount into whole cents", () => {
    const result = expenseFormSchema.parse(formInput)

    expect(result.amount).toBe(12_050)
  })

  test("keeps a zero amount, which the amount check constraint allows", () => {
    const result = expenseFormSchema.parse({ ...formInput, amount: "0" })

    expect(result.amount).toBe(0)
  })

  test("rejects a missing amount", () => {
    const result = expenseFormSchema.safeParse({ ...formInput, amount: "" })

    expect(result.success).toBe(false)
  })

  test("rejects a negative amount", () => {
    const result = expenseFormSchema.safeParse({ ...formInput, amount: "-10.00" })

    expect(result.success).toBe(false)
  })

  test("rejects an amount with more than two decimal places", () => {
    const result = expenseFormSchema.safeParse({ ...formInput, amount: "10.005" })

    expect(result.success).toBe(false)
  })

  test("uppercases the currency code", () => {
    const result = expenseFormSchema.parse(formInput)

    expect(result.currency).toBe("EUR")
  })

  test("rejects a currency that is not three characters", () => {
    const result = expenseFormSchema.safeParse({ ...formInput, currency: "EURO" })

    expect(result.success).toBe(false)
  })
})

describe("expenseFormSchema markup", () => {
  test("accepts no markup on a rebillable expense", () => {
    const result = expenseFormSchema.parse({ ...formInput, rebillable: true })

    expect(result.markupPercentage).toBeNull()
  })

  test("accepts a markup at the lower bound", () => {
    const result = expenseFormSchema.parse({
      ...formInput,
      rebillable: true,
      markupPercentage: "0"
    })

    expect(result.markupPercentage).toBe(0)
  })

  test("accepts a markup at the upper bound the check constraint allows", () => {
    const result = expenseFormSchema.parse({
      ...formInput,
      rebillable: true,
      markupPercentage: "1000"
    })

    expect(result.markupPercentage).toBe(1000)
  })

  test("rejects a markup above the upper bound", () => {
    const result = expenseFormSchema.safeParse({
      ...formInput,
      rebillable: true,
      markupPercentage: "1000.01"
    })

    expect(result.success).toBe(false)
  })

  test("rejects a negative markup", () => {
    const result = expenseFormSchema.safeParse({
      ...formInput,
      rebillable: true,
      markupPercentage: "-5"
    })

    expect(result.success).toBe(false)
  })

  test("rejects a markup on an expense that is not rebillable", () => {
    const result = expenseFormSchema.safeParse({ ...formInput, markupPercentage: "10" })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(["markupPercentage"])
  })
})

describe("expenseFormSchema scope and date", () => {
  test("turns blank project and client ids into no scope", () => {
    const result = expenseFormSchema.parse(formInput)

    expect(result.projectId).toBeNull()
    expect(result.clientId).toBeNull()
  })

  test("keeps a project and client that are both selected", () => {
    const result = expenseFormSchema.parse({
      ...formInput,
      projectId: PROJECT_ID,
      clientId: CLIENT_ID
    })

    expect(result.projectId).toBe(PROJECT_ID)
    expect(result.clientId).toBe(CLIENT_ID)
  })

  test("rejects a project id that is not a uuid", () => {
    const result = expenseFormSchema.safeParse({ ...formInput, projectId: "not-a-uuid" })

    expect(result.success).toBe(false)
  })

  test("pins the spent date to UTC midnight", () => {
    const result = expenseFormSchema.parse(formInput)

    expect(result.spentAt.toISOString()).toBe("2026-08-06T00:00:00.000Z")
  })

  test("rejects a date that carries a time", () => {
    const result = expenseFormSchema.safeParse({ ...formInput, spentAt: "2026-08-06T09:00" })

    expect(result.success).toBe(false)
  })

  test("rejects a missing date", () => {
    const result = expenseFormSchema.safeParse({ ...formInput, spentAt: "" })

    expect(result.success).toBe(false)
  })
})

describe("expenseFormSchema receipt", () => {
  test("accepts a receipt keyed under the expenses prefix", () => {
    const result = expenseFormSchema.safeParse({ ...formInput, receipt })

    expect(result.success).toBe(true)
  })

  test("rejects a receipt pointing outside the expenses prefix", () => {
    const result = expenseFormSchema.safeParse({
      ...formInput,
      receipt: { ...receipt, objectKey: "avatars/someone/secret.png" }
    })

    expect(result.success).toBe(false)
  })

  test("rejects a receipt whose type is not an image or a PDF", () => {
    const result = expenseFormSchema.safeParse({
      ...formInput,
      receipt: { ...receipt, mimeType: "text/html" }
    })

    expect(result.success).toBe(false)
  })

  test("rejects a receipt larger than the upload limit", () => {
    const result = expenseFormSchema.safeParse({
      ...formInput,
      receipt: { ...receipt, sizeBytes: EXPENSE_RECEIPT_MAX_BYTES + 1 }
    })

    expect(result.success).toBe(false)
  })

  test("rejects an empty receipt file", () => {
    const result = expenseFormSchema.safeParse({
      ...formInput,
      receipt: { ...receipt, sizeBytes: 0 }
    })

    expect(result.success).toBe(false)
  })
})

describe("updateExpenseSchema", () => {
  test("requires an expense id", () => {
    const result = updateExpenseSchema.safeParse(formInput)

    expect(result.success).toBe(false)
  })

  test("accepts the form values with a valid id", () => {
    const result = updateExpenseSchema.safeParse({ ...formInput, id: PROJECT_ID })

    expect(result.success).toBe(true)
  })
})

describe("parseExpenseListQuery", () => {
  test("defaults to active expenses newest first when no parameters are given", () => {
    const result = parseExpenseListQuery({})

    expect(result.status).toBe("active")
    expect(result.sort).toEqual([{ id: "spentAt", desc: true }])
  })

  test("reads the comma-separated filter parameters the data table writes", () => {
    const result = parseExpenseListQuery({
      project: `${PROJECT_ID},${CLIENT_ID}`,
      client: CLIENT_ID,
      category: "Travel,Software",
      currency: "EUR",
      rebillable: "rebillable",
      invoiced: "unbilled"
    })

    expect(result.projectIds).toEqual([PROJECT_ID, CLIENT_ID])
    expect(result.clientIds).toEqual([CLIENT_ID])
    expect(result.categories).toEqual(["Travel", "Software"])
    expect(result.currencies).toEqual(["EUR"])
    expect(result.rebillable).toEqual(["rebillable"])
    expect(result.invoiced).toEqual(["unbilled"])
  })

  test("drops a filter value that is not one of its options", () => {
    const result = parseExpenseListQuery({ rebillable: "maybe", invoiced: "someday" })

    expect(result.rebillable).toEqual([])
    expect(result.invoiced).toEqual([])
  })

  test("reads the spent range as epoch milliseconds", () => {
    const from = Date.UTC(2026, 7, 1)
    const to = Date.UTC(2026, 7, 31)

    const result = parseExpenseListQuery({ spentAt: `${from},${to}` })

    expect(result.spentFrom).toEqual(new Date(from))
    expect(result.spentTo).toEqual(new Date(to))
  })

  test("falls back to the defaults when the parameters are malformed", () => {
    const result = parseExpenseListQuery({ status: "nonsense", sort: "not json", page: "-4" })

    expect(result.status).toBe("active")
    expect(result.sort).toEqual([{ id: "spentAt", desc: true }])
    expect(result.page).toBe(1)
  })
})
