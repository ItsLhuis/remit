import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  revalidatePath: vi.fn(),
  getSession: vi.fn(),
  getCurrentRole: vi.fn(),
  listOrganizations: vi.fn(),
  updateOrganization: vi.fn(),
  settingsFindFirst: vi.fn(),
  uploadsFindFirst: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  insertValues: vi.fn(),
  insertReturning: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  deleteWhere: vi.fn(),
  eq: vi.fn(),
  deleteStorageObject: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn()
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
    error: mocks.loggerError,
    warn: mocks.loggerWarn
  }
}))

vi.mock("@/lib/storage/s3", () => ({
  deleteStorageObject: mocks.deleteStorageObject
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
      },
      uploads: {
        findFirst: mocks.uploadsFindFirst
      }
    },
    insert: mocks.insert,
    update: mocks.update,
    delete: mocks.delete
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
  defaultLocale: "en",
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
    mocks.uploadsFindFirst.mockResolvedValue(null)
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
    mocks.delete.mockImplementation((table: unknown) => ({
      where: (predicate: unknown) => {
        mocks.deleteWhere(table, predicate)

        return Promise.resolve()
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

    expect(result).toEqual({ error: "Business name is required." })
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

  test("removes the previous logo from storage after a successful replacement", async () => {
    mocks.settingsFindFirst.mockResolvedValueOnce({
      id: "settings-1",
      businessLogoUploadId: "upload-old"
    })
    mocks.uploadsFindFirst.mockResolvedValueOnce({ path: "logos/old.png" })

    const { confirmBusinessLogoUpload } = await import("../mutations")

    await confirmBusinessLogoUpload({
      objectKey: "business-logos/123.png",
      filename: "logo.png",
      contentType: "image/png",
      sizeBytes: 1024
    })

    expect(mocks.deleteStorageObject).toHaveBeenCalledWith("logos/old.png")
  })

  test("cleans up the new logo when confirmation fails", async () => {
    mocks.update.mockImplementationOnce(() => ({
      set: () => ({
        where: () => Promise.reject(new Error("database unavailable"))
      })
    }))

    const { confirmBusinessLogoUpload } = await import("../mutations")

    const result = await confirmBusinessLogoUpload({
      objectKey: "logos/new.png",
      filename: "logo.png",
      contentType: "image/png",
      sizeBytes: 1024
    })

    expect(result).toEqual({ error: "settings.business.errors.logoUpdateFailed" })
    expect(mocks.deleteWhere).toHaveBeenCalledWith(
      expect.objectContaining({ id: "uploads.id" }),
      "settings-id-predicate"
    )
    expect(mocks.deleteStorageObject).toHaveBeenCalledWith("logos/new.png")
  })

  test("removes the business logo and clears organization logo", async () => {
    mocks.settingsFindFirst.mockResolvedValueOnce({
      id: "settings-1",
      businessLogoUploadId: "upload-old"
    })
    mocks.uploadsFindFirst.mockResolvedValueOnce({ path: "logos/old.png" })

    const { removeBusinessLogo } = await import("../mutations")

    const result = await removeBusinessLogo()

    expect(result).toEqual({ data: { success: true } })
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ id: "settings.id" }), {
      businessLogoUploadId: null
    })
    expect(mocks.updateOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {
        organizationId: "org-1",
        data: { logo: "" }
      }
    })
    expect(mocks.deleteStorageObject).toHaveBeenCalledWith("logos/old.png")
  })

  test("saves tax details and converts empty tax ID to null", async () => {
    const { saveTaxDetailsSettings } = await import("../mutations")

    const result = await saveTaxDetailsSettings({ businessTaxId: "VAT-DE123" })

    expect(result).toEqual({ data: { settings: { businessTaxId: "VAT-DE123" } } })
    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ id: "settings.id" }),
      expect.objectContaining({ businessTaxId: "VAT-DE123" })
    )
    expect(mocks.updateOrganization).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings/business")
  })

  test("returns forbidden when the current user is not the owner", async () => {
    mocks.getCurrentRole.mockResolvedValueOnce("accountant")

    const { saveTaxDetailsSettings } = await import("../mutations")

    const result = await saveTaxDetailsSettings({ businessTaxId: "VAT123" })

    expect(result).toEqual({ error: "errors.forbidden" })
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.insert).not.toHaveBeenCalled()
  })
})
