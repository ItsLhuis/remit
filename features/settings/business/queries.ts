import { eq } from "drizzle-orm"

import { database } from "@/database"
import { uploads } from "@/database/schema"

import { type BusinessSettingsValues } from "./schemas"

export type BusinessSettingsFormData = BusinessSettingsValues & {
  businessLogoStorageKey: string | null
}

export async function getBusinessSettings(): Promise<BusinessSettingsFormData> {
  const row = await database.query.settings.findFirst({
    columns: {
      businessName: true,
      businessEmail: true,
      businessPhone: true,
      businessWebsite: true,
      defaultCurrency: true,
      defaultLocale: true,
      defaultTimezone: true,
      businessTaxId: true,
      businessAddressLine1: true,
      businessAddressLine2: true,
      businessCity: true,
      businessState: true,
      businessPostalCode: true,
      businessCountry: true,
      businessLogoUploadId: true
    }
  })

  const logoUpload = row?.businessLogoUploadId
    ? await database.query.uploads.findFirst({
        columns: { path: true },
        where: eq(uploads.id, row.businessLogoUploadId)
      })
    : null

  return {
    businessName: row?.businessName ?? "",
    businessEmail: row?.businessEmail ?? "",
    businessPhone: row?.businessPhone ?? "",
    businessWebsite: row?.businessWebsite ?? "",
    defaultCurrency: row?.defaultCurrency ?? "EUR",
    defaultLocale: row?.defaultLocale ?? "en",
    defaultTimezone: row?.defaultTimezone ?? "UTC",
    businessTaxId: row?.businessTaxId ?? "",
    businessAddressLine1: row?.businessAddressLine1 ?? "",
    businessAddressLine2: row?.businessAddressLine2 ?? "",
    businessCity: row?.businessCity ?? "",
    businessState: row?.businessState ?? "",
    businessPostalCode: row?.businessPostalCode ?? "",
    businessCountry: row?.businessCountry ?? "",
    businessLogoStorageKey: logoUpload?.path ?? null
  }
}
