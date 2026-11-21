import { expect, test } from "vitest"

import {
  createCreditNoteSchema,
  creditNoteFormSchema,
  type CreditNoteFormInputValues
} from "../schemas"

const INVOICE_ID = "00000000-0000-4000-8000-000000000101"
const TAX_RATE_ID = "00000000-0000-4000-8000-000000000102"

// What CreditNoteForm holds in its controls, empty optional select included: the `taxRateId` empty
// string is the path the transform turns into `null`, which is exactly what a re-parse built from
// the string-input shape rejects.
const formInput: CreditNoteFormInputValues = {
  reason: "Cancelled the second sprint",
  lineItems: [
    {
      description: "Discovery",
      unit: "hour",
      quantity: "1.5",
      unitPrice: "100.00",
      discountKind: "fixed",
      discountPercentage: "",
      discountAmount: "5.00",
      taxRateId: TAX_RATE_ID
    }
  ]
}

// CreditNoteForm resolves with `raw: true`, so these are the values that travel to the server
// action. Without it the form would send the schema's transformed cents and nulls, and this
// re-parse would fail with "expected string, received number".
test("accepts the values CreditNoteForm submits", () => {
  const result = createCreditNoteSchema.safeParse({ ...formInput, invoiceId: INVOICE_ID })

  expect(result.success).toBe(true)
})

test("parses an empty tax-rate select to null rather than rejecting it", () => {
  const result = creditNoteFormSchema.safeParse({
    ...formInput,
    lineItems: [{ ...formInput.lineItems[0], taxRateId: "", discountKind: "none" }]
  })

  expect(result).toEqual({
    success: true,
    data: expect.objectContaining({
      lineItems: [expect.objectContaining({ taxRateId: null })]
    })
  })
})

test("transforms a decimal amount into integer cents", () => {
  const result = creditNoteFormSchema.parse(formInput)

  expect(result.lineItems[0]).toEqual(
    expect.objectContaining({ unitPrice: 10000, discountAmount: 500, quantity: 1.5 })
  )
})

test("rejects a credit note with no line items", () => {
  const result = creditNoteFormSchema.safeParse({ ...formInput, lineItems: [] })

  expect(result.success).toBe(false)
})

test("rejects a percentage discount with no percentage supplied", () => {
  const result = creditNoteFormSchema.safeParse({
    ...formInput,
    lineItems: [{ ...formInput.lineItems[0], discountKind: "percentage", discountPercentage: "" }]
  })

  expect(result.success).toBe(false)
})

test("rejects a zero quantity", () => {
  const result = creditNoteFormSchema.safeParse({
    ...formInput,
    lineItems: [{ ...formInput.lineItems[0], quantity: "0" }]
  })

  expect(result.success).toBe(false)
})

test("rejects an invoice id that is not a uuid", () => {
  const result = createCreditNoteSchema.safeParse({ ...formInput, invoiceId: "not-a-uuid" })

  expect(result.success).toBe(false)
})
