import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  revalidatePath: vi.fn(),
  getSession: vi.fn(),
  getCurrentRole: vi.fn(),
  listOrganizations: vi.fn(),
  updateOrganization: vi.fn(),
  settingsFindFirst: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  insertValues: vi.fn(),
  insertReturning: vi.fn(),
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
      listOrganizations: mocks.listOrganizations,
      updateOrganization: mocks.updateOrganization
    }
  }
}))

vi.mock("@/lib/auth/session", () => ({
  getCurrentRole: mocks.getCurrentRole
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError
  }
}))

vi.mock("@/database/schema", () => ({
  settings: {
    id: "settings.id"
  },
  uploads: {
    id: "uploads.id"
  }
}))

vi.mock("@/database", () => ({
  database: {
    query: {
      settings: {
        findFirst: mocks.settingsFindFirst
      }
    },
    insert: mocks.insert,
    update: mocks.update
  }
}))

const validProfileSettings = {
  businessName: "Acme Studio",
  businessEmail: "billing@example.com",
  businessPhone: "+1 555 0100",
  businessWebsite: "https://example.com"
}

const validRegionalDefaults = {
  defaultCurrency: "USD",
  defaultTimezone: "UTC"
}

const validAddressSettings = {
  businessAddressLine1: "1 Main Street",
  businessAddressLine2: "",
  businessCity: "Portland",
  businessState: "OR",
  businessPostalCode: "97201",
  businessCountry: "US"
}

describe("business settings mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.headers.mockResolvedValue(new Headers())
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } })
    mocks.getCurrentRole.mockResolvedValue("owner")
    mocks.listOrganizations.mockResolvedValue([{ id: "org-1" }])
    mocks.updateOrganization.mockResolvedValue({ id: "org-1" })
    mocks.settingsFindFirst.mockResolvedValue({ id: "settings-1" })
    mocks.eq.mockReturnValue("settings-id-predicate")
    mocks.insertReturning.mockResolvedValue([{ id: "upload-1" }])

    mocks.insert.mockImplementation((table: unknown) => ({
      values: (values: unknown) => {
        mocks.insertValues(table, values)

        return {
          returning: (selection: unknown) => {
            mocks.insertReturning(table, selection)

            return Promise.resolve([{ id: "upload-1" }])
          }
        }
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

  test("updates the settings row and mirrors the business name to the organization", async () => {
    const { saveBusinessProfileSettings } = await import("../mutations")

    const result = await saveBusinessProfileSettings({
      ...validProfileSettings,
      businessEmail: ""
    })

    expect(result).toEqual({
      data: {
        settings: {
          ...validProfileSettings,
          businessEmail: ""
        }
      }
    })
    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ id: "settings.id" }),
      expect.objectContaining({
        businessName: "Acme Studio",
        businessEmail: null,
        businessPhone: "+1 555 0100",
        businessWebsite: "https://example.com"
      })
    )
    expect(mocks.updateOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {
        organizationId: "org-1",
        data: { name: "Acme Studio" }
      }
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings/business")
  })

  test("returns a validation error without writing settings when the business name is missing", async () => {
    const { saveBusinessProfileSettings } = await import("../mutations")

    const result = await saveBusinessProfileSettings({
      ...validProfileSettings,
      businessName: ""
    })

    expect(result).toEqual({ error: "settings.business.validation.nameRequired" })
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  test("updates regional defaults independently", async () => {
    const { saveRegionalDefaultsSettings } = await import("../mutations")

    const result = await saveRegionalDefaultsSettings(validRegionalDefaults)

    expect(result).toEqual({ data: { settings: validRegionalDefaults } })
    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ id: "settings.id" }),
      validRegionalDefaults
    )
    expect(mocks.updateOrganization).not.toHaveBeenCalled()
  })

  test("updates the business address independently", async () => {
    const { saveBusinessAddressSettings } = await import("../mutations")

    const result = await saveBusinessAddressSettings(validAddressSettings)

    expect(result).toEqual({ data: { settings: validAddressSettings } })
    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ id: "settings.id" }),
      expect.objectContaining({
        businessAddressLine1: "1 Main Street",
        businessAddressLine2: null,
        businessCountry: "US"
      })
    )
    expect(mocks.updateOrganization).not.toHaveBeenCalled()
  })

  test("records a logo upload and mirrors the storage key to the organization", async () => {
    const { confirmBusinessLogoUpload } = await import("../mutations")

    const result = await confirmBusinessLogoUpload({
      objectKey: "business-logos/123.png",
      filename: "logo.png",
      contentType: "image/png",
      sizeBytes: 1024
    })

    expect(result).toEqual({ data: { storageKey: "business-logos/123.png" } })
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({ id: "uploads.id" }), {
      filename: "logo.png",
      path: "business-logos/123.png",
      mimeType: "image/png",
      sizeBytes: 1024
    })
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ id: "settings.id" }), {
      businessLogoUploadId: "upload-1"
    })
    expect(mocks.updateOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {
        organizationId: "org-1",
        data: { logo: "business-logos/123.png" }
      }
    })
  })
})
