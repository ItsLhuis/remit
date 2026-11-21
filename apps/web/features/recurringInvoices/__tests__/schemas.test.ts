import { describe, expect, test } from "vitest"

import {
  createRecurringInvoiceSchema,
  recurringInvoiceBlueprintSchema,
  recurringInvoiceFormSchema,
  type RecurringInvoiceFormInputValues
} from "../schemas"

const CLIENT_ID = "00000000-0000-4000-8000-000000000201"
const TAX_RATE_ID = "00000000-0000-4000-8000-000000000202"

// What RecurringInvoiceForm holds in its controls: every value a string, empty optional selects
// included. The empty `projectId` is the path the transform turns into `null`.
const formInput: RecurringInvoiceFormInputValues = {
  name: "Monthly retainer",
  clientId: CLIENT_ID,
  projectId: "",
  templateId: "",
  cadence: "monthly",
  cadenceDay: "5",
  nextRunAt: "2026-09-05",
  endCondition: "never",
  endAfterCount: "",
  endByDate: "",
  autoSend: false,
  currency: "eur",
  includedHours: "",
  overageRate: "",
  notes: "",
  lineItems: [
    {
      description: "Retainer",
      unit: "",
      quantity: "1",
      unitPrice: "1500.00",
      taxRateId: TAX_RATE_ID,
      discountKind: "none",
      discountPercentage: "",
      discountAmount: ""
    }
  ]
}

// The form resolves with `raw: true`, so these are the values that travel to the server action.
// Without it the form would send the schema's transformed cents and Dates, and this re-parse would
// fail with "expected string, received number".
test("accepts the values RecurringInvoiceForm submits", () => {
  const result = createRecurringInvoiceSchema.safeParse(formInput)

  expect(result.success).toBe(true)
})

test("transforms the string inputs into cents, numbers and dates", () => {
  const result = createRecurringInvoiceSchema.parse(formInput)

  expect(result.lineItems[0]?.unitPrice).toBe(150_000)
  expect(result.lineItems[0]?.quantity).toBe(1)
  expect(result.cadenceDay).toBe(5)
  expect(result.currency).toBe("EUR")
  expect(result.nextRunAt.toISOString()).toBe("2026-09-05T00:00:00.000Z")
})

test("parses empty optional selects to null rather than rejecting them", () => {
  const result = recurringInvoiceFormSchema.parse(formInput)

  expect(result.projectId).toBeNull()
  expect(result.templateId).toBeNull()
  expect(result.includedHours).toBeNull()
  expect(result.overageRate).toBeNull()
})

describe("cadence day", () => {
  test("rejects a weekday above seven for a weekly cadence", () => {
    const result = recurringInvoiceFormSchema.safeParse({
      ...formInput,
      cadence: "weekly",
      cadenceDay: "31"
    })

    expect(result.success).toBe(false)
  })

  test("accepts the same value for a monthly cadence", () => {
    const result = recurringInvoiceFormSchema.safeParse({ ...formInput, cadenceDay: "31" })

    expect(result.success).toBe(true)
  })
})

describe("end condition", () => {
  test("requires a count when the schedule ends after N occurrences", () => {
    const result = recurringInvoiceFormSchema.safeParse({
      ...formInput,
      endCondition: "after_count",
      endAfterCount: ""
    })

    expect(result.success).toBe(false)
  })

  test("requires a date when the schedule ends on a date", () => {
    const result = recurringInvoiceFormSchema.safeParse({
      ...formInput,
      endCondition: "by_date",
      endByDate: ""
    })

    expect(result.success).toBe(false)
  })

  test("rejects an end date before the first run", () => {
    const result = recurringInvoiceFormSchema.safeParse({
      ...formInput,
      endCondition: "by_date",
      endByDate: "2026-08-01"
    })

    expect(result.success).toBe(false)
  })
})

// `chk_recurring_invoices_retainer` permits an included-hours pool with no overage rate, which would
// bill nothing once the pool ran out. The schema is the only thing that forbids the half-configured
// pair, so both directions are pinned here.
describe("retainer pair", () => {
  test.each([
    { includedHours: "10", overageRate: "" },
    { includedHours: "", overageRate: "85.00" }
  ])("rejects the half-configured pair %j", (overrides) => {
    const result = recurringInvoiceFormSchema.safeParse({ ...formInput, ...overrides })

    expect(result.success).toBe(false)
  })

  test("accepts both set together", () => {
    const result = recurringInvoiceFormSchema.safeParse({
      ...formInput,
      includedHours: "10",
      overageRate: "85.00"
    })

    expect(result.success).toBe(true)
  })
})

// `line_items_blueprint` is jsonb with no database-level shape, so this schema is the trust boundary
// every read crosses. It validates the PERSISTED shape — cents and numbers — not the form's strings.
describe("blueprint", () => {
  test("accepts a persisted line", () => {
    const result = recurringInvoiceBlueprintSchema.safeParse([
      {
        description: "Retainer",
        unit: null,
        quantity: 1,
        unitPriceCents: 150_000,
        taxRateId: null,
        taxPercentage: 23,
        discountType: null,
        discountPercentage: null,
        discountAmountCents: null
      }
    ])

    expect(result.success).toBe(true)
  })

  test("rejects a line carrying the form's string values", () => {
    const result = recurringInvoiceBlueprintSchema.safeParse([
      { description: "Retainer", quantity: "1", unitPriceCents: "150000" }
    ])

    expect(result.success).toBe(false)
  })

  test("accepts an empty blueprint, which the generation job refuses separately", () => {
    expect(recurringInvoiceBlueprintSchema.safeParse([]).success).toBe(true)
  })
})
