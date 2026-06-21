import { describe, expect, it } from "vitest"

import { isEmailConfigured, type EmailSettings } from "../isEmailConfigured"

const configuredSmtpSettings: EmailSettings = {
  emailProvider: "smtp",
  resendApiKey: null,
  smtpHost: "smtp.example.com",
  smtpPass: "password",
  smtpPort: 587,
  smtpUser: "mailer@example.com"
}

const configuredResendSettings: EmailSettings = {
  emailProvider: "resend",
  resendApiKey: "re_123",
  smtpHost: null,
  smtpPass: null,
  smtpPort: null,
  smtpUser: null
}

describe("isEmailConfigured", () => {
  it("returns false for null settings", () => {
    expect(isEmailConfigured(null)).toBe(false)
  })

  it("returns false for undefined settings", () => {
    expect(isEmailConfigured(undefined)).toBe(false)
  })

  it("returns false when emailProvider is null", () => {
    expect(
      isEmailConfigured({
        ...configuredSmtpSettings,
        emailProvider: null
      })
    ).toBe(false)
  })

  it("returns true when smtp provider has smtpHost, smtpPort, smtpUser, smtpPass", () => {
    expect(isEmailConfigured(configuredSmtpSettings)).toBe(true)
  })

  it.each([
    ["smtpHost", null],
    ["smtpHost", ""],
    ["smtpPort", null],
    ["smtpPort", 0],
    ["smtpUser", null],
    ["smtpUser", ""],
    ["smtpPass", null],
    ["smtpPass", ""]
  ] satisfies Array<[keyof EmailSettings, EmailSettings[keyof EmailSettings]]>)(
    "returns false when smtp provider has falsy %s",
    (fieldName, fieldValue) => {
      expect(
        isEmailConfigured({
          ...configuredSmtpSettings,
          [fieldName]: fieldValue
        })
      ).toBe(false)
    }
  )

  it("returns true when resend provider has resendApiKey", () => {
    expect(isEmailConfigured(configuredResendSettings)).toBe(true)
  })

  it.each([null, ""])(
    "returns false when resend provider has falsy resendApiKey %#",
    (resendApiKey) => {
      expect(
        isEmailConfigured({
          ...configuredResendSettings,
          resendApiKey
        })
      ).toBe(false)
    }
  )

  it("returns false for unknown provider such as postmark", () => {
    expect(
      isEmailConfigured({
        ...configuredResendSettings,
        emailProvider: "postmark"
      })
    ).toBe(false)
  })
})
