import { eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { settings, uploads } from "@/database/schema"

import { makeOrganization, makeSettings, makeUpload, makeUser } from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  deleteStorageObject: vi.fn(),
  getStorageObjectBytes: vi.fn(),
  getCurrentRole: vi.fn(),
  getSession: vi.fn(),
  headers: vi.fn(),
  listOrganizations: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  revalidatePath: vi.fn(),
  updateOrganization: vi.fn()
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
  deleteStorageObject: mocks.deleteStorageObject,
  getStorageObjectBytes: mocks.getStorageObjectBytes
}))

const ownerId = "00000000-0000-4000-8000-000000000011"
const ownerEmail = "owner-business@example.com"

describe("business settings mutations", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })

    mocks.headers.mockResolvedValue(new Headers({ "user-agent": "Vitest" }))
    mocks.getSession.mockResolvedValue({
      user: { id: ownerId, email: ownerEmail }
    })
    mocks.getCurrentRole.mockResolvedValue("owner")
    mocks.listOrganizations.mockResolvedValue([{ id: "00000000-0000-4000-8000-000000000012" }])
    mocks.updateOrganization.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000012" })
    mocks.deleteStorageObject.mockResolvedValue(undefined)
    mocks.getStorageObjectBytes.mockResolvedValue(Buffer.from("stored-logo-bytes"))
  })

  test("persists profile settings and mirrors the organization name when the owner saves profile details", async () => {
    const { saveBusinessProfileSettings } = await import("../mutations")

    await makeSettings({ businessName: "Old Studio" })

    const result = await saveBusinessProfileSettings({
      businessName: "Acme Studio",
      businessEmail: "",
      businessPhone: "+1 555 0100",
      businessWebsite: "https://example.com"
    })
    const settingsRow = await database.query.settings.findFirst()

    expect(result).toEqual({
      data: {
        settings: {
          businessName: "Acme Studio",
          businessEmail: "",
          businessPhone: "+1 555 0100",
          businessWebsite: "https://example.com"
        }
      }
    })
    expect(settingsRow).toEqual(
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
        organizationId: "00000000-0000-4000-8000-000000000012",
        data: { name: "Acme Studio" }
      }
    })
  })

  test("persists regional defaults independently from profile details", async () => {
    const { saveRegionalDefaultsSettings } = await import("../mutations")

    await makeSettings({ businessName: "Acme Studio" })

    const result = await saveRegionalDefaultsSettings({
      defaultCurrency: "USD",
      defaultLocale: "en",
      defaultTimezone: "America/New_York"
    })
    const settingsRow = await database.query.settings.findFirst()

    expect(result).toEqual({
      data: {
        settings: {
          defaultCurrency: "USD",
          defaultLocale: "en",
          defaultTimezone: "America/New_York"
        }
      }
    })
    expect(settingsRow).toEqual(
      expect.objectContaining({
        businessName: "Acme Studio",
        defaultCurrency: "USD",
        defaultLocale: "en",
        defaultTimezone: "America/New_York"
      })
    )
    expect(mocks.updateOrganization).not.toHaveBeenCalled()
  })

  test("persists tax details while preserving an empty tax id as null", async () => {
    const { saveTaxDetailsSettings } = await import("../mutations")

    await makeSettings({ businessTaxId: "VAT-OLD" })

    const result = await saveTaxDetailsSettings({ businessTaxId: "" })
    const settingsRow = await database.query.settings.findFirst()

    expect(result).toEqual({ data: { settings: { businessTaxId: "" } } })
    expect(settingsRow?.businessTaxId).toBeNull()
    expect(mocks.updateOrganization).not.toHaveBeenCalled()
  })

  test("persists address settings with optional address fields stored as null", async () => {
    const { saveBusinessAddressSettings } = await import("../mutations")

    await makeSettings({ businessName: "Acme Studio" })

    const result = await saveBusinessAddressSettings({
      businessAddressLine1: "1 Main Street",
      businessAddressLine2: "",
      businessCity: "Portland",
      businessState: "",
      businessPostalCode: "97201",
      businessCountry: "US"
    })
    const settingsRow = await database.query.settings.findFirst()

    expect(result).toEqual({
      data: {
        settings: {
          businessAddressLine1: "1 Main Street",
          businessAddressLine2: "",
          businessCity: "Portland",
          businessState: "",
          businessPostalCode: "97201",
          businessCountry: "US"
        }
      }
    })
    expect(settingsRow).toEqual(
      expect.objectContaining({
        businessAddressLine1: "1 Main Street",
        businessAddressLine2: null,
        businessCity: "Portland",
        businessState: null,
        businessPostalCode: "97201",
        businessCountry: "US"
      })
    )
  })

  test("records a logo upload and mirrors the storage key to the organization", async () => {
    const { confirmBusinessLogoUpload } = await import("../mutations")

    await makeSettings({ businessName: "Acme Studio" })

    const result = await confirmBusinessLogoUpload({
      objectKey: "business-logos/new.png",
      filename: "new.png",
      contentType: "image/png",
      sizeBytes: 1024
    })
    const uploadRows = await database
      .select()
      .from(uploads)
      .where(eq(uploads.path, "business-logos/new.png"))
    const settingsRow = await database.query.settings.findFirst()

    expect(result).toEqual({ data: { storageKey: "business-logos/new.png" } })
    expect(uploadRows).toHaveLength(1)
    expect(settingsRow?.businessLogoUploadId).toBe(uploadRows[0]?.id)
    expect(mocks.updateOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {
        organizationId: "00000000-0000-4000-8000-000000000012",
        data: { logo: "business-logos/new.png" }
      }
    })
  })

  test("clears the business logo and deletes the previous upload when the owner removes it", async () => {
    const { removeBusinessLogo } = await import("../mutations")

    const organization = await makeOrganization({ name: "Acme Studio", slug: "acme-studio" })
    const upload = await makeUpload({ path: "business-logos/old.png" })
    await makeSettings({ businessLogoUploadId: upload.id })
    mocks.listOrganizations.mockResolvedValueOnce([organization])

    const result = await removeBusinessLogo()
    const uploadRows = await database
      .select()
      .from(uploads)
      .where(eq(uploads.path, "business-logos/old.png"))
    const settingsRow = await database.query.settings.findFirst({
      columns: { businessLogoUploadId: true }
    })

    expect(result).toEqual({ data: { success: true } })
    expect(settingsRow?.businessLogoUploadId).toBeNull()
    expect(uploadRows).toHaveLength(0)
    expect(mocks.deleteStorageObject).toHaveBeenCalledWith("business-logos/old.png")
    expect(mocks.updateOrganization).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {
        organizationId: organization.id,
        data: { logo: "" }
      }
    })
  })

  test("returns forbidden without persisting profile changes when the current user is not the owner", async () => {
    const { saveBusinessProfileSettings } = await import("../mutations")

    await makeSettings({ businessName: "Old Studio" })
    mocks.getCurrentRole.mockResolvedValueOnce("assistant")

    const result = await saveBusinessProfileSettings({
      businessName: "Acme Studio",
      businessEmail: "",
      businessPhone: "",
      businessWebsite: ""
    })
    const settingsRows = await database
      .select()
      .from(settings)
      .where(eq(settings.businessName, "Acme Studio"))

    expect(result).toEqual({ error: "You do not have permission to do that" })
    expect(settingsRows).toHaveLength(0)
    expect(mocks.updateOrganization).not.toHaveBeenCalled()
  })
})
