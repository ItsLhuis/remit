import { expect, test } from "vitest"

import {
  createInvoicingSettingsSchema,
  INVOICE_PREFIX_MAX_LENGTH,
  invoicingSettingsSchema
} from "../schemas"

const validInvoicingSettings = {
  invoicePrefix: "INV-",
  numberPaddingWidth: 4,
  nextInvoiceNumber: 42,
  paymentTermsDays: 30,
  defaultNotesInvoice: "Thank you for your business.",
  defaultInvoiceFooter: "Payment is due according to the terms above.",
  defaultHourlyRate: "85.00",
  lateFeeEnabled: false,
  lateFeeType: "percentage",
  lateFeePercentage: "",
  lateFeeAmount: "",
  lateFeeGraceDays: 0,
  lateFeeMax: ""
}

test("accepts a blank default hourly rate as no configured rate", () => {
  const result = invoicingSettingsSchema.safeParse({
    ...validInvoicingSettings,
    defaultHourlyRate: ""
  })

  expect(result.success).toBe(true)
})

test("rejects a default hourly rate that is not a plain amount", () => {
  const result = invoicingSettingsSchema.safeParse({
    ...validInvoicingSettings,
    defaultHourlyRate: "85,00"
  })

  expect(result.success).toBe(false)
})

test("accepts valid invoice numbering and document defaults", () => {
  const result = invoicingSettingsSchema.safeParse(validInvoicingSettings)

  expect(result.success).toBe(true)
})

test("trims optional invoice notes and footer text", () => {
  const result = invoicingSettingsSchema.safeParse({
    ...validInvoicingSettings,
    defaultNotesInvoice: "  Thanks  ",
    defaultInvoiceFooter: "  Footer  "
  })

  expect(result).toEqual({
    success: true,
    data: expect.objectContaining({
      defaultNotesInvoice: "Thanks",
      defaultInvoiceFooter: "Footer"
    })
  })
})

test("rejects an invoice prefix with non-printable or non-ASCII characters", () => {
  const result = invoicingSettingsSchema.safeParse({
    ...validInvoicingSettings,
    invoicePrefix: "INV-\u20AC"
  })

  expect(result.success).toBe(false)
})

test("rejects an invoice prefix over the length cap", () => {
  const result = invoicingSettingsSchema.safeParse({
    ...validInvoicingSettings,
    invoicePrefix: "I".repeat(INVOICE_PREFIX_MAX_LENGTH + 1)
  })

  expect(result.success).toBe(false)
})

test("rejects padding widths outside the supported range", () => {
  const tooSmall = invoicingSettingsSchema.safeParse({
    ...validInvoicingSettings,
    numberPaddingWidth: 0
  })
  const tooLarge = invoicingSettingsSchema.safeParse({
    ...validInvoicingSettings,
    numberPaddingWidth: 11
  })

  expect(tooSmall.success).toBe(false)
  expect(tooLarge.success).toBe(false)
})

test("rejects a next invoice number lower than the current persisted next number", () => {
  const schema = createInvoicingSettingsSchema(50)

  const result = schema.safeParse({
    ...validInvoicingSettings,
    nextInvoiceNumber: 49
  })

  expect(result.success).toBe(false)
})

test("rejects payment terms outside the supported day range", () => {
  const tooSmall = invoicingSettingsSchema.safeParse({
    ...validInvoicingSettings,
    paymentTermsDays: -1
  })
  const tooLarge = invoicingSettingsSchema.safeParse({
    ...validInvoicingSettings,
    paymentTermsDays: 366
  })

  expect(tooSmall.success).toBe(false)
  expect(tooLarge.success).toBe(false)
})

test("accepts an unconfigured late-fee policy while the switch is off", () => {
  const result = invoicingSettingsSchema.safeParse(validInvoicingSettings)

  expect(result.success).toBe(true)
})

test("rejects enabling the late fee with no percentage entered", () => {
  const result = invoicingSettingsSchema.safeParse({
    ...validInvoicingSettings,
    lateFeeEnabled: true
  })

  expect(result.success).toBe(false)
})

test("rejects enabling a flat late fee with no amount entered", () => {
  const result = invoicingSettingsSchema.safeParse({
    ...validInvoicingSettings,
    lateFeeEnabled: true,
    lateFeeType: "fixed"
  })

  expect(result.success).toBe(false)
})

test("accepts an enabled percentage policy with a grace period and a cap", () => {
  const result = invoicingSettingsSchema.safeParse({
    ...validInvoicingSettings,
    lateFeeEnabled: true,
    lateFeePercentage: "7.5",
    lateFeeGraceDays: 5,
    lateFeeMax: "40.00"
  })

  expect(result.success).toBe(true)
})

test("rejects a late-fee percentage above one hundred", () => {
  const result = invoicingSettingsSchema.safeParse({
    ...validInvoicingSettings,
    lateFeeEnabled: true,
    lateFeePercentage: "120"
  })

  expect(result.success).toBe(false)
})

test("rejects a grace period longer than a year", () => {
  const result = invoicingSettingsSchema.safeParse({
    ...validInvoicingSettings,
    lateFeeGraceDays: 400
  })

  expect(result.success).toBe(false)
})
