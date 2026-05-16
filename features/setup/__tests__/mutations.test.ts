import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  revalidatePath: vi.fn(),
  getSession: vi.fn(),
  createOrganization: vi.fn(),
  setActiveOrganization: vi.fn(),
  getActiveMemberRole: vi.fn(),
  settingsFindFirst: vi.fn(),
  organizationsFindFirst: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  insertValues: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  eq: vi.fn(),
  loggerError: vi.fn()
}))

vi.mock("next/headers", () => ({
  headers: mocks.headers
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}))

vi.mock("drizzle-orm", () => ({
  eq: mocks.eq
}))

vi.mock("@/lib/i18n/server", () => ({
  t: (key: string) => key
}))

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mocks.getSession,
      createOrganization: mocks.createOrganization,
      setActiveOrganization: mocks.setActiveOrganization,
      getActiveMemberRole: mocks.getActiveMemberRole
    }
  }
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError
  }
}))

vi.mock("@/features/settings", () => ({
  totpVerifySchema: {},
  TotpVerifyValues: {}
}))

vi.mock("@/database/schema", () => ({
  settings: {
    id: "settings.id"
  }
}))

vi.mock("@/database", () => ({
  database: {
    query: {
      settings: {
        findFirst: mocks.settingsFindFirst
      },
      organizations: {
        findFirst: mocks.organizationsFindFirst
      }
    },
    insert: mocks.insert,
    update: mocks.update
  }
}))

const validBusinessProfile = {
  businessName: "Acme Studio",
  businessEmail: "billing@example.com",
  businessTaxId: "VAT123",
  businessCountry: "US",
  defaultCurrency: "USD"
}

describe("setup business profile mutation", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.headers.mockResolvedValue(new Headers())
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } })
    mocks.settingsFindFirst.mockResolvedValue(null)
    mocks.organizationsFindFirst.mockResolvedValue(null)
    mocks.createOrganization.mockImplementation(() => Promise.resolve({ id: "org-1" }))
    mocks.setActiveOrganization.mockResolvedValue(undefined)
    mocks.getActiveMemberRole.mockResolvedValue({ role: "owner" })
    mocks.eq.mockReturnValue("settings-id-predicate")

    mocks.insert.mockImplementation((table: unknown) => ({
      values: (values: unknown) => {
        mocks.insertValues(table, values)

        return Promise.resolve()
      }
    }))

    mocks.update.mockImplementation((table: unknown) => ({
      set: (values: unknown) => {
        mocks.updateSet(table, values)

        return {
          where: (predicate: unknown) => {
            mocks.updateWhere(table, predicate)

            return Promise.resolve()
          }
        }
      }
    }))
  })

  test("creates settings and owner organization when setup has no existing rows", async () => {
    const { saveBusinessProfile } = await import("../mutations")

    const result = await saveBusinessProfile(validBusinessProfile)

    expect(result).toEqual({ data: { success: true } })
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ id: "settings.id" }),
      {
        businessName: "Acme Studio",
        businessEmail: "billing@example.com",
        businessTaxId: "VAT123",
        businessCountry: "US",
        defaultCurrency: "USD"
      }
    )
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
        organizationId: "org-1"
      }
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/setup")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/")
  })

  test("updates settings and requires owner role when an organization already exists", async () => {
    mocks.settingsFindFirst.mockResolvedValueOnce({ id: "settings-1" })
    mocks.organizationsFindFirst.mockResolvedValueOnce({ id: "org-1" })

    const { saveBusinessProfile } = await import("../mutations")

    const result = await saveBusinessProfile({
      ...validBusinessProfile,
      businessEmail: "",
      businessTaxId: ""
    })

    expect(result).toEqual({ data: { success: true } })
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ id: "settings.id" }), {
      businessName: "Acme Studio",
      businessEmail: null,
      businessTaxId: null,
      businessCountry: "US",
      defaultCurrency: "USD"
    })
    expect(mocks.createOrganization).not.toHaveBeenCalled()
    expect(mocks.getActiveMemberRole).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      query: {
        organizationId: "org-1"
      }
    })
  })

  test("returns unauthorized without writing settings when there is no session", async () => {
    mocks.getSession.mockResolvedValueOnce(null)

    const { saveBusinessProfile } = await import("../mutations")

    const result = await saveBusinessProfile(validBusinessProfile)

    expect(result).toEqual({ error: "errors.unauthorized" })
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.createOrganization).not.toHaveBeenCalled()
  })

  test("returns a validation error without writing settings when the profile is invalid", async () => {
    const { saveBusinessProfile } = await import("../mutations")

    const result = await saveBusinessProfile({
      ...validBusinessProfile,
      businessName: ""
    })

    expect(result).toEqual({ error: "Business name is required." })
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.createOrganization).not.toHaveBeenCalled()
  })
})
