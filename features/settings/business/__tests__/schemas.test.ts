import { expect, test } from "vitest"

import { businessSettingsSchema } from "../schemas"

const validSettings = {
  businessName: "Acme Studio",
  businessEmail: "billing@example.com",
  businessPhone: "+1 555 0100",
  businessWebsite: "https://example.com",
  defaultCurrency: "USD",
  defaultTimezone: "UTC",
  businessTaxId: "VAT123",
  businessAddressLine1: "1 Main Street",
  businessAddressLine2: "Suite 4",
  businessCity: "Portland",
  businessState: "OR",
  businessPostalCode: "97201",
  businessCountry: "US"
}

test("accepts a complete business settings payload", () => {
  const result = businessSettingsSchema.safeParse(validSettings)

  expect(result.success).toBe(true)
})

test("rejects an invalid optional business email", () => {
  const result = businessSettingsSchema.safeParse({
    ...validSettings,
    businessEmail: "not-an-email"
  })

  expect(result.success).toBe(false)
})

test("rejects an invalid timezone", () => {
  const result = businessSettingsSchema.safeParse({
    ...validSettings,
    defaultTimezone: "Invalid/Timezone"
  })

  expect(result.success).toBe(false)
})
