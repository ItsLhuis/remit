import { eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { organizations, settings } from "@/database/schema"

import { makeOrganization, makeSettings, makeUser } from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  createOrganization: vi.fn(),
  getActiveMemberRole: vi.fn(),
  getSession: vi.fn(),
  headers: vi.fn(),
  loggerError: vi.fn(),
  revalidatePath: vi.fn(),
  setActiveOrganization: vi.fn()
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
      createOrganization: mocks.createOrganization,
      getActiveMemberRole: mocks.getActiveMemberRole,
      getSession: mocks.getSession,
      setActiveOrganization: mocks.setActiveOrganization
    }
  }
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError
  }
}))

const ownerId = "00000000-0000-4000-8000-000000000031"
const ownerEmail = "owner-setup@example.com"

const validBusinessProfile = {
  businessName: "Acme Studio",
  businessEmail: "billing@example.com",
  businessTaxId: "VAT123",
  businessCountry: "US",
  defaultCurrency: "USD"
}

describe("setup mutations", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })

    mocks.headers.mockResolvedValue(new Headers({ "user-agent": "Vitest" }))
    mocks.getSession.mockResolvedValue({
      user: { id: ownerId, email: ownerEmail }
    })
    mocks.createOrganization.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000032"
    })
    mocks.setActiveOrganization.mockResolvedValue(undefined)
    mocks.getActiveMemberRole.mockResolvedValue({ role: "owner" })
  })

  test("creates settings and creates the owner organization when setup starts from an empty database", async () => {
    const { saveBusinessProfile } = await import("../mutations")

    const result = await saveBusinessProfile(validBusinessProfile)
    const settingsRow = await database.query.settings.findFirst()
    const organizationRows = await database.select().from(organizations)

    expect(result).toEqual({ data: { success: true } })
    expect(settingsRow).toEqual(
      expect.objectContaining({
        businessName: "Acme Studio",
        businessEmail: "billing@example.com",
        businessTaxId: "VAT123",
        businessCountry: "US",
        defaultCurrency: "USD"
      })
    )
    expect(organizationRows).toHaveLength(0)
    expect(mocks.createOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {
        name: "Acme Studio",
        slug: "acme-studio"
      }
    })
    expect(mocks.setActiveOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {
        organizationId: "00000000-0000-4000-8000-000000000032"
      }
    })
  })

  test("updates existing settings and activates the existing organization when setup is resumed", async () => {
    const { saveBusinessProfile } = await import("../mutations")

    await makeSettings({ businessName: "Old Studio" })
    const organization = await makeOrganization({ name: "Old Studio", slug: "old-studio" })

    const result = await saveBusinessProfile({
      ...validBusinessProfile,
      businessEmail: "",
      businessTaxId: ""
    })
    const settingsRow = await database.query.settings.findFirst()

    expect(result).toEqual({ data: { success: true } })
    expect(settingsRow).toEqual(
      expect.objectContaining({
        businessName: "Acme Studio",
        businessEmail: null,
        businessTaxId: null,
        businessCountry: "US",
        defaultCurrency: "USD"
      })
    )
    expect(mocks.createOrganization).not.toHaveBeenCalled()
    expect(mocks.setActiveOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {
        organizationId: organization.id
      }
    })
    expect(mocks.getActiveMemberRole).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      query: {
        organizationId: organization.id
      }
    })
  })

  test("returns unauthorized without writing setup settings when there is no session", async () => {
    const { saveBusinessProfile } = await import("../mutations")

    mocks.getSession.mockResolvedValueOnce(null)

    const result = await saveBusinessProfile(validBusinessProfile)
    const settingsRows = await database
      .select()
      .from(settings)
      .where(eq(settings.businessName, "Acme Studio"))

    expect(result).toEqual({ error: "You must be signed in to do that" })
    expect(settingsRows).toHaveLength(0)
    expect(mocks.createOrganization).not.toHaveBeenCalled()
    expect(mocks.setActiveOrganization).not.toHaveBeenCalled()
  })
})
