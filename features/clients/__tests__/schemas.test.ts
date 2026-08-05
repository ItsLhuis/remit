import { expect, test } from "vitest"

import {
  clientFormSchema,
  createClientSchema,
  updateClientSchema,
  type ClientFormInputValues
} from "../schemas"

const CLIENT_ID = "00000000-0000-4000-8000-000000000001"

const formInput: ClientFormInputValues = {
  name: "Acme",
  email: "billing@acme.test",
  phone: "",
  currency: "eur",
  taxId: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "pt",
  notes: "",
  website: "",
  defaultHourlyRate: ""
}

// ClientForm resolves without `raw`, so what travels to the server action is the schema's output,
// and createClientSchema is that same schema re-run over it. The round trip only holds because
// every transform here is idempotent — uppercasing an already-uppercase code. Adding a widening
// transform (a string to cents, a string to a Date) breaks this test rather than the running form.
test("accepts the values ClientForm submits when creating", () => {
  const parsed = clientFormSchema.parse(formInput)

  expect(createClientSchema.safeParse(parsed).success).toBe(true)
})

test("accepts the values ClientForm submits when editing", () => {
  const parsed = clientFormSchema.parse(formInput)

  expect(updateClientSchema.safeParse({ ...parsed, id: CLIENT_ID }).success).toBe(true)
})

test("normalises currency and country to upper case", () => {
  const result = clientFormSchema.safeParse(formInput)

  expect(result).toEqual({
    success: true,
    data: expect.objectContaining({ currency: "EUR", country: "PT" })
  })
})
