import { eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, settings } from "@/database/schema"

import { makeUser } from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  getCurrentRole: vi.fn(),
  getSession: vi.fn(),
  headers: vi.fn(),
  loggerError: vi.fn(),
  revalidatePath: vi.fn()
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

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    fatal: vi.fn(),
    warn: vi.fn()
  }
}))

const ownerId = "00000000-0000-4000-8000-000000000201"
const ownerEmail = "owner-invoicing@example.com"

const validInvoicingSettings = {
  invoicePrefix: "INV-",
  numberPaddingWidth: 5,
  nextInvoiceNumber: 42,
  paymentTermsDays: 14,
  defaultNotesInvoice: "Thank you for your business.",
  defaultInvoiceFooter: "Payment is due according to the terms above."
}

describe("invoicing settings mutations", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })

    mocks.headers.mockResolvedValue(
      new Headers({
        "user-agent": "Vitest",
        "x-forwarded-for": "203.0.113.30, 198.51.100.2"
      })
    )
    mocks.getSession.mockResolvedValue({
      user: { id: ownerId, email: ownerEmail }
    })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("stores invoice numbering, payment terms, notes, and footer defaults", async () => {
    const { saveInvoicingSettings } = await import("../mutations")

    const result = await saveInvoicingSettings(validInvoicingSettings)
    const [settingsRow] = await database.select().from(settings)
    const auditRows = await database.select().from(auditLogs)

    expect(result).toEqual({
      data: {
        settings: validInvoicingSettings
      }
    })
    expect(settingsRow).toEqual(
      expect.objectContaining({
        invoicePrefix: "INV-",
        numberPaddingWidth: 5,
        nextInvoiceNumber: 42,
        paymentTermsDays: 14,
        defaultNotesInvoice: "Thank you for your business.",
        defaultInvoiceFooter: "Payment is due according to the terms above."
      })
    )
    expect(auditRows).toHaveLength(1)
    expect(auditRows[0]?.event).toBe("settings.invoicing.updated")
    expect(auditRows[0]?.metadata).toEqual(
      expect.objectContaining({
        changedFields: [
          "invoicePrefix",
          "numberPaddingWidth",
          "nextInvoiceNumber",
          "paymentTermsDays",
          "defaultNotesInvoice",
          "defaultInvoiceFooter"
        ]
      })
    )
  })

  test("normalizes blank invoice notes and footer values to null in storage", async () => {
    const { saveInvoicingSettings } = await import("../mutations")

    await database.insert(settings).values({
      invoicePrefix: "INV-",
      numberPaddingWidth: 4,
      nextInvoiceNumber: 10,
      paymentTermsDays: 30,
      defaultNotesInvoice: "Existing notes",
      defaultInvoiceFooter: "Existing footer"
    })

    const result = await saveInvoicingSettings({
      ...validInvoicingSettings,
      numberPaddingWidth: 4,
      nextInvoiceNumber: 10,
      paymentTermsDays: 30,
      defaultNotesInvoice: "   ",
      defaultInvoiceFooter: ""
    })
    const [settingsRow] = await database.select().from(settings)

    expect(result).toEqual({
      data: {
        settings: expect.objectContaining({
          defaultNotesInvoice: "",
          defaultInvoiceFooter: ""
        })
      }
    })
    expect(settingsRow?.defaultNotesInvoice).toBeNull()
    expect(settingsRow?.defaultInvoiceFooter).toBeNull()
  })

  test("refuses to move the next invoice number backwards", async () => {
    const { saveInvoicingSettings } = await import("../mutations")

    await database.insert(settings).values({
      nextInvoiceNumber: 25
    })

    const result = await saveInvoicingSettings({
      ...validInvoicingSettings,
      nextInvoiceNumber: 24
    })
    const settingsRow = await database.query.settings.findFirst({
      columns: { nextInvoiceNumber: true }
    })
    const auditRows = await database.select().from(auditLogs)

    expect(result).toEqual({
      error: "Next invoice number cannot be lower than the current next number (25)."
    })
    expect(settingsRow?.nextInvoiceNumber).toBe(25)
    expect(auditRows).toHaveLength(0)
  })

  test("returns forbidden without writing settings when the current user is not the owner", async () => {
    const { saveInvoicingSettings } = await import("../mutations")

    mocks.getCurrentRole.mockResolvedValueOnce("assistant")

    const result = await saveInvoicingSettings(validInvoicingSettings)
    const settingsRows = await database
      .select()
      .from(settings)
      .where(eq(settings.nextInvoiceNumber, validInvoicingSettings.nextInvoiceNumber))

    expect(result).toEqual({ error: "You do not have permission to do that" })
    expect(settingsRows).toHaveLength(0)
  })
})
