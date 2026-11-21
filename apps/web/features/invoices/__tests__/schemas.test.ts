import { expect, test } from "vitest"

import {
  createInvoiceSchema,
  invoiceFormSchema,
  updateInvoiceSchema,
  type InvoiceFormInputValues
} from "../schemas"

const PROJECT_ID = "00000000-0000-4000-8000-000000000001"
const INVOICE_ID = "00000000-0000-4000-8000-000000000002"
const TAX_RATE_ID = "00000000-0000-4000-8000-000000000003"

// What InvoiceForm holds in its controls, empty optional selects included: the `templateId` and
// date empty strings are the path the transform turns into `null`, which is exactly what a re-parse
// built from the string-input shape rejects.
const formInput: InvoiceFormInputValues = {
  currency: "eur",
  templateId: "",
  issueDate: "",
  dueDate: "",
  notes: "",
  discountKind: "percentage",
  discountPercentage: "10",
  discountAmount: "",
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

// InvoiceForm resolves with `raw: true`, so these are the values that travel to the server action.
// Without it the form would send the schema's transformed cents, dates and nulls, and every one of
// these re-parses would fail with "expected string, received number".
test("accepts the values InvoiceForm submits when creating", () => {
  const result = createInvoiceSchema.safeParse({ ...formInput, projectId: PROJECT_ID })

  expect(result.success).toBe(true)
})

test("accepts the values InvoiceForm submits when editing", () => {
  const result = updateInvoiceSchema.safeParse({ ...formInput, id: INVOICE_ID })

  expect(result.success).toBe(true)
})

test("parses an empty optional select to null rather than rejecting it", () => {
  const result = invoiceFormSchema.safeParse(formInput)

  expect(result).toEqual({
    success: true,
    data: expect.objectContaining({ templateId: null, issueDate: null, dueDate: null })
  })
})
