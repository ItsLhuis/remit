import { expect, test } from "vitest"

import {
  createProposalSchema,
  proposalFormSchema,
  updateProposalSchema,
  type ProposalFormInputValues
} from "../schemas"

const PROJECT_ID = "00000000-0000-4000-8000-000000000001"
const PROPOSAL_ID = "00000000-0000-4000-8000-000000000002"
const TAX_RATE_ID = "00000000-0000-4000-8000-000000000003"

// What ProposalForm holds in its controls, empty optional selects included: the `templateId` and
// `validUntil` empty strings are the path the transform turns into `null`, which is exactly what a
// re-parse built from the string-input shape rejects.
const formInput: ProposalFormInputValues = {
  currency: "eur",
  templateId: "",
  validUntil: "",
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

// ProposalForm resolves with `raw: true`, so these are the values that travel to the server action.
// Without it the form would send the schema's transformed cents, dates and nulls, and every one of
// these re-parses would fail with "expected string, received number".
test("accepts the values ProposalForm submits when creating", () => {
  const result = createProposalSchema.safeParse({ ...formInput, projectId: PROJECT_ID })

  expect(result.success).toBe(true)
})

test("accepts the values ProposalForm submits when editing", () => {
  const result = updateProposalSchema.safeParse({ ...formInput, id: PROPOSAL_ID })

  expect(result.success).toBe(true)
})

test("parses an empty optional select to null rather than rejecting it", () => {
  const result = proposalFormSchema.safeParse(formInput)

  expect(result).toEqual({
    success: true,
    data: expect.objectContaining({ templateId: null, validUntil: null })
  })
})
