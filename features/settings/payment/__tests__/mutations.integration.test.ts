import { eq } from "drizzle-orm"

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, settings } from "@/database/schema"

import { makeUser } from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => {
  class StripeConnectionTestError extends Error {
    constructor(
      readonly code: string,
      readonly stripeErrorType: string | null = null
    ) {
      super(code)
      this.name = "StripeConnectionTestError"
    }
  }

  return {
    emit: vi.fn(),
    getCurrentRole: vi.fn(),
    getSession: vi.fn(),
    headers: vi.fn(),
    loggerError: vi.fn(),
    revalidatePath: vi.fn(),
    StripeConnectionTestError,
    testStripeConnection: vi.fn()
  }
})

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

vi.mock("../stripe", () => ({
  StripeConnectionTestError: mocks.StripeConnectionTestError,
  testStripeConnection: mocks.testStripeConnection
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    fatal: vi.fn(),
    warn: vi.fn()
  }
}))

const ownerId = "00000000-0000-4000-8000-000000000101"
const ownerEmail = "owner-payment@example.com"

const validPaymentSettings = {
  paymentBankName: "Acme Bank",
  paymentIban: "GB82 WEST 1234 5698 7654 32",
  paymentIbanConfigured: false,
  paymentInstructions: "Use the invoice number as the transfer reference.",
  stripePublishableKey: "pk_test_123456789",
  stripeSecretKey: "sk_test_123456789",
  stripeSecretKeyConfigured: false,
  stripeWebhookSecret: "whsec_123456789",
  stripeWebhookSecretConfigured: false
}

describe("payment settings mutations", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })

    mocks.headers.mockResolvedValue(
      new Headers({
        "user-agent": "Vitest",
        "x-forwarded-for": "203.0.113.20, 198.51.100.2"
      })
    )
    mocks.getSession.mockResolvedValue({
      user: { id: ownerId, email: ownerEmail }
    })
    mocks.getCurrentRole.mockResolvedValue("owner")
    mocks.testStripeConnection.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test("stores bank transfer settings and does not return the IBAN to the client", async () => {
    const { savePaymentSettings } = await import("../mutations")

    const result = await savePaymentSettings({
      ...validPaymentSettings,
      stripePublishableKey: "",
      stripeSecretKey: "",
      stripeWebhookSecret: ""
    })
    const [settingsRow] = await database.select().from(settings)
    const auditRows = await database.select().from(auditLogs)

    expect(result).toEqual({
      data: {
        settings: expect.objectContaining({
          paymentBankName: "Acme Bank",
          paymentIban: "",
          paymentIbanConfigured: true,
          stripeSecretKeyConfigured: false
        })
      }
    })
    expect(settingsRow?.paymentIban).toBe("GB82WEST12345698765432")
    expect(auditRows).toHaveLength(1)
    expect(auditRows[0]?.event).toBe("settings.payment.updated")
    expect(auditRows[0]?.metadata).toEqual(
      expect.objectContaining({
        changedFields: ["paymentBankName", "paymentInstructions", "paymentIban"],
        secretFieldsChanged: ["paymentIban"]
      })
    )
    expect(JSON.stringify(auditRows[0]?.metadata)).not.toContain("GB82WEST")
  })

  test("preserves existing encrypted payment values when submitted secrets are blank", async () => {
    const { savePaymentSettings } = await import("../mutations")

    await database.insert(settings).values({
      paymentIban: "GB82WEST12345698765432",
      paymentBankName: "Old Bank",
      paymentInstructions: "Old instructions",
      stripePublishableKey: "pk_test_existing",
      stripeSecretKey: "sk_test_existing",
      stripeWebhookSecret: "whsec_existing"
    })

    const result = await savePaymentSettings({
      ...validPaymentSettings,
      paymentBankName: "New Bank",
      paymentIban: "",
      paymentIbanConfigured: true,
      paymentInstructions: "Old instructions",
      stripePublishableKey: "pk_test_existing",
      stripeSecretKey: "",
      stripeSecretKeyConfigured: true,
      stripeWebhookSecret: "",
      stripeWebhookSecretConfigured: true
    })
    const [settingsRow] = await database.select().from(settings)
    const auditRows = await database.select().from(auditLogs)

    expect(result).toEqual({
      data: {
        settings: expect.objectContaining({
          paymentBankName: "New Bank",
          paymentIban: "",
          paymentIbanConfigured: true,
          stripeSecretKey: "",
          stripeSecretKeyConfigured: true,
          stripeWebhookSecret: "",
          stripeWebhookSecretConfigured: true
        })
      }
    })
    expect(settingsRow?.paymentIban).toBe("GB82WEST12345698765432")
    expect(settingsRow?.stripeSecretKey).toBe("sk_test_existing")
    expect(settingsRow?.stripeWebhookSecret).toBe("whsec_existing")
    expect(auditRows).toHaveLength(1)
    expect(auditRows[0]?.metadata).toEqual(
      expect.objectContaining({
        changedFields: ["paymentBankName"],
        secretFieldsChanged: []
      })
    )
    expect(JSON.stringify(auditRows[0]?.metadata)).not.toContain("sk_test_existing")
    expect(JSON.stringify(auditRows[0]?.metadata)).not.toContain("whsec_existing")
  })

  test("stores new Stripe secrets and audits only field names", async () => {
    const { savePaymentSettings } = await import("../mutations")

    const result = await savePaymentSettings(validPaymentSettings)
    const [settingsRow] = await database.select().from(settings)
    const auditRows = await database.select().from(auditLogs)

    expect(result).toEqual({
      data: {
        settings: expect.objectContaining({
          stripePublishableKey: "pk_test_123456789",
          stripeSecretKey: "",
          stripeSecretKeyConfigured: true,
          stripeWebhookSecret: "",
          stripeWebhookSecretConfigured: true
        })
      }
    })
    expect(settingsRow?.stripeSecretKey).toBe("sk_test_123456789")
    expect(settingsRow?.stripeWebhookSecret).toBe("whsec_123456789")
    expect(auditRows).toHaveLength(1)
    expect(auditRows[0]?.metadata).toEqual(
      expect.objectContaining({
        secretFieldsChanged: ["paymentIban", "stripeSecretKey", "stripeWebhookSecret"]
      })
    )
    expect(JSON.stringify(auditRows[0]?.metadata)).not.toContain("sk_test_123456789")
    expect(JSON.stringify(auditRows[0]?.metadata)).not.toContain("whsec_123456789")
  })

  test("tests Stripe through the payment boundary and records the success timestamp", async () => {
    const now = new Date("2026-06-01T10:30:00.000Z")
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(now)

    const { testStripeConnection } = await import("../mutations")

    await database.insert(settings).values({
      stripePublishableKey: "pk_test_existing",
      stripeSecretKey: "sk_test_existing",
      stripeWebhookSecret: "whsec_existing"
    })

    const result = await testStripeConnection({})
    const settingsRow = await database.query.settings.findFirst({
      columns: { stripeTestConnectionAt: true }
    })
    const auditRows = await database.select().from(auditLogs)

    expect(result).toEqual({ data: { stripeTestConnectionAt: now.toISOString() } })
    expect(mocks.testStripeConnection).toHaveBeenCalledWith("sk_test_existing")
    expect(settingsRow?.stripeTestConnectionAt?.toISOString()).toBe(now.toISOString())
    expect(mocks.emit).toHaveBeenCalledOnce()
    expect(mocks.emit).toHaveBeenCalledWith("settings.payment.configured", { userId: ownerId })
    expect(auditRows).toHaveLength(1)
    expect(auditRows[0]?.metadata).toEqual(
      expect.objectContaining({
        changedFields: ["stripeTestConnectionAt"],
        secretFieldsChanged: []
      })
    )
    expect(JSON.stringify(auditRows[0]?.metadata)).not.toContain("sk_test_existing")
  })

  test("maps Stripe failures without updating the test timestamp", async () => {
    const { testStripeConnection } = await import("../mutations")

    await database.insert(settings).values({
      stripePublishableKey: "pk_test_existing",
      stripeSecretKey: "sk_test_existing"
    })
    mocks.testStripeConnection.mockRejectedValueOnce(
      new mocks.StripeConnectionTestError("auth", "StripeAuthenticationError")
    )

    const result = await testStripeConnection({})
    const settingsRow = await database.query.settings.findFirst({
      columns: { stripeTestConnectionAt: true }
    })
    const auditRows = await database.select().from(auditLogs)

    expect(result).toEqual({ error: "Stripe rejected the secret key" })
    expect(settingsRow?.stripeTestConnectionAt).toBeNull()
    expect(mocks.emit).not.toHaveBeenCalled()
    expect(auditRows).toHaveLength(0)
    expect(JSON.stringify(mocks.loggerError.mock.calls)).not.toContain("sk_test_existing")
  })

  test("returns forbidden without writing settings when the current user is not the owner", async () => {
    const { savePaymentSettings } = await import("../mutations")

    mocks.getCurrentRole.mockResolvedValueOnce("assistant")

    const result = await savePaymentSettings(validPaymentSettings)
    const settingsRows = await database
      .select()
      .from(settings)
      .where(eq(settings.paymentBankName, "Acme Bank"))

    expect(result).toEqual({ error: "You do not have permission to do that" })
    expect(settingsRows).toHaveLength(0)
  })
})
