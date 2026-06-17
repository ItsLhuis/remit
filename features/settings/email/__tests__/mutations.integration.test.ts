import { eq } from "drizzle-orm"

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, settings } from "@/database/schema"

import { makeUser } from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  emit: vi.fn(),
  getCurrentRole: vi.fn(),
  getSession: vi.fn(),
  headers: vi.fn(),
  loggerError: vi.fn(),
  revalidatePath: vi.fn(),
  sendTransactionalEmail: vi.fn()
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}))

vi.mock("next/headers", () => ({
  headers: mocks.headers
}))

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mocks.getSession
    }
  }
}))

vi.mock("@/lib/auth/session", () => ({
  getCurrentRole: mocks.getCurrentRole
}))

vi.mock("@/lib/events", () => ({
  emit: mocks.emit
}))

vi.mock("@/features/email/server", () => ({
  sendTransactionalEmail: mocks.sendTransactionalEmail
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    fatal: vi.fn(),
    warn: vi.fn()
  }
}))

const ownerId = "00000000-0000-4000-8000-000000000001"
const ownerEmail = "owner@example.com"

const validSmtpSettings = {
  emailProvider: "smtp",
  smtpHost: "smtp.example.com",
  smtpPort: 587,
  smtpUser: "mailer@example.com",
  smtpPass: "",
  smtpPassConfigured: true,
  smtpSecure: false,
  resendApiKey: "",
  resendApiKeyConfigured: false,
  emailFromName: "Acme Studio",
  emailFromAddress: "billing@example.com"
}

describe("email settings mutations", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })

    mocks.headers.mockResolvedValue(
      new Headers({
        "user-agent": "Vitest",
        "x-forwarded-for": "203.0.113.10, 198.51.100.2"
      })
    )
    mocks.getSession.mockResolvedValue({
      user: { id: ownerId, email: ownerEmail }
    })
    mocks.getCurrentRole.mockResolvedValue("owner")
    mocks.sendTransactionalEmail.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test("preserves an existing SMTP password when the submitted secret is blank", async () => {
    const { saveEmailSettings } = await import("../mutations")

    await database.insert(settings).values({
      emailProvider: "smtp",
      smtpHost: "smtp.old.example.com",
      smtpPort: 465,
      smtpUser: "old@example.com",
      smtpPass: "existing-smtp-password",
      smtpSecure: true,
      emailFromName: "Old Name",
      emailFromAddress: "old@example.com"
    })

    const result = await saveEmailSettings(validSmtpSettings)
    const [settingsRow] = await database.select().from(settings)
    const auditRows = await database.select().from(auditLogs)

    expect(result).toEqual({
      data: {
        settings: expect.objectContaining({
          smtpPass: "",
          smtpPassConfigured: true,
          smtpHost: "smtp.example.com"
        })
      }
    })
    expect(settingsRow?.smtpPass).toBe("existing-smtp-password")
    expect(settingsRow?.smtpHost).toBe("smtp.example.com")
    expect(auditRows).toHaveLength(1)
    expect(auditRows[0]?.event).toBe("settings.email.updated")
    expect(JSON.stringify(auditRows[0]?.metadata)).not.toContain("existing-smtp-password")
  })

  test("stores a new Resend API key and audits only field names", async () => {
    const { saveEmailSettings } = await import("../mutations")

    const result = await saveEmailSettings({
      ...validSmtpSettings,
      emailProvider: "resend",
      smtpHost: "",
      smtpUser: "",
      smtpPassConfigured: false,
      resendApiKey: "re_test_new_secret",
      emailFromAddress: "sender@example.com"
    })
    const [settingsRow] = await database.select().from(settings)
    const auditRows = await database.select().from(auditLogs)

    expect(result).toEqual({
      data: {
        settings: expect.objectContaining({
          emailProvider: "resend",
          resendApiKey: "",
          resendApiKeyConfigured: true
        })
      }
    })
    expect(settingsRow?.resendApiKey).toBe("re_test_new_secret")
    expect(auditRows).toHaveLength(1)
    expect(auditRows[0]?.metadata).toEqual(
      expect.objectContaining({
        secretFieldsChanged: ["resendApiKey"]
      })
    )
    expect(JSON.stringify(auditRows[0]?.metadata)).not.toContain("re_test_new_secret")
  })

  test("sends a test email through the email boundary and records the success timestamp", async () => {
    const now = new Date("2026-05-29T10:30:00.000Z")
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(now)

    const { sendEmailSettingsTest } = await import("../mutations")

    await database.insert(settings).values({
      emailProvider: "smtp",
      smtpHost: "smtp.example.com",
      smtpPort: 587,
      smtpUser: "mailer@example.com",
      smtpPass: "existing-smtp-password",
      smtpSecure: false,
      emailFromName: "Acme Studio",
      emailFromAddress: "billing@example.com"
    })

    const result = await sendEmailSettingsTest({ recipientEmail: "recipient@example.com" })
    const settingsRow = await database.query.settings.findFirst({
      columns: { emailTestSendAt: true }
    })

    expect(result).toEqual({ data: { emailTestSendAt: now.toISOString() } })
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith({
      to: "recipient@example.com",
      subject: "Remit test email",
      text: "This is a test email from Remit. Your email provider is configured correctly."
    })
    expect(settingsRow?.emailTestSendAt?.toISOString()).toBe(now.toISOString())
    expect(mocks.emit).toHaveBeenCalledOnce()
    expect(mocks.emit).toHaveBeenCalledWith("settings.email.configured", { userId: ownerId })
  })

  test("maps provider failures without updating the test timestamp", async () => {
    const { sendEmailSettingsTest } = await import("../mutations")

    await database.insert(settings).values({
      emailProvider: "smtp",
      smtpHost: "smtp.example.com",
      smtpPort: 587,
      smtpUser: "mailer@example.com",
      smtpPass: "existing-smtp-password",
      smtpSecure: false,
      emailFromName: "Acme Studio",
      emailFromAddress: "billing@example.com"
    })
    mocks.sendTransactionalEmail.mockRejectedValueOnce({ code: "smtp_auth" })

    const result = await sendEmailSettingsTest({ recipientEmail: "" })
    const settingsRow = await database.query.settings.findFirst({
      columns: { emailTestSendAt: true }
    })

    expect(result).toEqual({
      error: "SMTP authentication failed. Check the username and password"
    })
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: ownerEmail })
    )
    expect(settingsRow?.emailTestSendAt).toBeNull()
    expect(mocks.emit).not.toHaveBeenCalled()
  })

  test("returns forbidden without writing settings when the current user is not the owner", async () => {
    const { saveEmailSettings } = await import("../mutations")

    mocks.getCurrentRole.mockResolvedValueOnce("assistant")

    const result = await saveEmailSettings(validSmtpSettings)
    const settingsRows = await database
      .select()
      .from(settings)
      .where(eq(settings.emailProvider, "smtp"))

    expect(result).toEqual({ error: "You do not have permission to do that" })
    expect(settingsRows).toHaveLength(0)
  })
})
