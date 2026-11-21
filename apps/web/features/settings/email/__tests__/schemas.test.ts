import { expect, test } from "vitest"

import { emailSettingsSchema, testEmailSettingsSchema } from "../schemas"

const validSmtpSettings = {
  emailProvider: "smtp",
  smtpHost: "smtp.example.com",
  smtpPort: 587,
  smtpUser: "mailer@example.com",
  smtpPass: "smtp-secret",
  smtpPassConfigured: false,
  smtpSecure: false,
  resendApiKey: "",
  resendApiKeyConfigured: false,
  emailFromName: "Acme Studio",
  emailFromAddress: "billing@example.com"
}

test("accepts a complete SMTP settings payload", () => {
  const result = emailSettingsSchema.safeParse(validSmtpSettings)

  expect(result.success).toBe(true)
})

test("accepts Resend settings without requiring hidden SMTP fields", () => {
  const result = emailSettingsSchema.safeParse({
    ...validSmtpSettings,
    emailProvider: "resend",
    smtpHost: "",
    smtpPort: 0,
    smtpUser: "",
    smtpPass: "",
    resendApiKey: "re_test_secret"
  })

  expect(result.success).toBe(true)
})

test("rejects SMTP settings without a host", () => {
  const result = emailSettingsSchema.safeParse({
    ...validSmtpSettings,
    smtpHost: ""
  })

  expect(result.success).toBe(false)
})

test("rejects SMTP settings without a password when none is configured", () => {
  const result = emailSettingsSchema.safeParse({ ...validSmtpSettings, smtpPass: "" })

  expect(result.success).toBe(false)
})

test("accepts SMTP settings with an empty password when one is already configured", () => {
  const result = emailSettingsSchema.safeParse({
    ...validSmtpSettings,
    smtpPass: "",
    smtpPassConfigured: true
  })

  expect(result.success).toBe(true)
})

test("rejects Resend settings without an API key when none is configured", () => {
  const result = emailSettingsSchema.safeParse({
    ...validSmtpSettings,
    emailProvider: "resend",
    resendApiKey: ""
  })

  expect(result.success).toBe(false)
})

test("accepts Resend settings with an empty key when one is already configured", () => {
  const result = emailSettingsSchema.safeParse({
    ...validSmtpSettings,
    emailProvider: "resend",
    resendApiKey: "",
    resendApiKeyConfigured: true
  })

  expect(result.success).toBe(true)
})

test("rejects an invalid test recipient", () => {
  const result = testEmailSettingsSchema.safeParse({ recipientEmail: "not-an-email" })

  expect(result.success).toBe(false)
})
