"use server"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { eq } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole } from "@/lib/auth/session"

import { logger } from "@/lib/logger"

import { deleteStorageObject } from "@/lib/storage/s3"

import { database } from "@/database"
import { settings, uploads } from "@/database/schema"

import {
  businessAddressSettingsSchema,
  businessProfileSettingsSchema,
  confirmBusinessLogoUploadSchema,
  regionalDefaultsSettingsSchema,
  taxDetailsSettingsSchema,
  type BusinessAddressSettingsValues,
  type BusinessProfileSettingsValues,
  type RegionalDefaultsSettingsValues,
  type TaxDetailsSettingsValues
} from "./schemas"

export async function saveBusinessProfileSettings(
  input: unknown
): Promise<{ data: { settings: BusinessProfileSettingsValues } } | { error: string }> {
  const gate = await requireBusinessSettingsWrite("saveBusinessProfileSettings")

  if ("error" in gate) return gate

  const parsed = businessProfileSettingsSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    await upsertSettings(toBusinessProfileWrite(parsed.data))

    await mirrorBusinessOrganization({
      headers: gate.context.headers,
      data: { name: parsed.data.businessName }
    })
  } catch (error) {
    return handleSettingsWriteError(error, "saveBusinessProfileSettings")
  }

  revalidatePath("/settings/business")
  revalidatePath("/setup")
  revalidatePath("/")

  return { data: { settings: parsed.data } }
}

export async function saveRegionalDefaultsSettings(
  input: unknown
): Promise<{ data: { settings: RegionalDefaultsSettingsValues } } | { error: string }> {
  const gate = await requireBusinessSettingsWrite("saveRegionalDefaultsSettings")

  if ("error" in gate) return gate

  const parsed = regionalDefaultsSettingsSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    await upsertSettings(parsed.data)
  } catch (error) {
    return handleSettingsWriteError(error, "saveRegionalDefaultsSettings")
  }

  revalidatePath("/settings/business")

  return { data: { settings: parsed.data } }
}

export async function saveTaxDetailsSettings(
  input: unknown
): Promise<{ data: { settings: TaxDetailsSettingsValues } } | { error: string }> {
  const gate = await requireBusinessSettingsWrite("saveTaxDetailsSettings")

  if ("error" in gate) return gate

  const parsed = taxDetailsSettingsSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    await upsertSettings(toTaxDetailsWrite(parsed.data))
  } catch (error) {
    return handleSettingsWriteError(error, "saveTaxDetailsSettings")
  }

  revalidatePath("/settings/business")

  return { data: { settings: parsed.data } }
}

export async function saveBusinessAddressSettings(
  input: unknown
): Promise<{ data: { settings: BusinessAddressSettingsValues } } | { error: string }> {
  const gate = await requireBusinessSettingsWrite("saveBusinessAddressSettings")

  if ("error" in gate) return gate

  const parsed = businessAddressSettingsSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    await upsertSettings(toBusinessAddressWrite(parsed.data))
  } catch (error) {
    return handleSettingsWriteError(error, "saveBusinessAddressSettings")
  }

  revalidatePath("/settings/business")

  return { data: { settings: parsed.data } }
}

export async function confirmBusinessLogoUpload(
  input: unknown
): Promise<{ data: { storageKey: string } } | { error: string }> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
    query: { disableCookieCache: true }
  })

  if (!session) return { error: t("errors.unauthorized") }

  const role = await getCurrentRole({ headers: requestHeaders, userId: session.user.id })

  if (role !== "owner") return { error: t("errors.forbidden") }

  const parsed = confirmBusinessLogoUploadSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  let existingSettingsId: string | null = null
  let oldLogoUploadId: string | null = null
  let oldLogoPath: string | null = null

  try {
    const existingSettings = await database.query.settings.findFirst({
      columns: { id: true, businessLogoUploadId: true }
    })

    existingSettingsId = existingSettings?.id ?? null
    oldLogoUploadId = existingSettings?.businessLogoUploadId ?? null

    if (existingSettings?.businessLogoUploadId) {
      const oldUpload = await database.query.uploads.findFirst({
        columns: { path: true },
        where: eq(uploads.id, existingSettings.businessLogoUploadId)
      })

      oldLogoPath = oldUpload?.path ?? null
    }

    const [upload] = await database
      .insert(uploads)
      .values({
        filename: parsed.data.filename,
        path: parsed.data.objectKey,
        mimeType: parsed.data.contentType,
        sizeBytes: parsed.data.sizeBytes
      })
      .returning({ id: uploads.id })

    if (!upload) throw new Error("Business logo upload insert did not return an id")

    if (existingSettings) {
      await database
        .update(settings)
        .set({ businessLogoUploadId: upload.id })
        .where(eq(settings.id, existingSettings.id))
    } else {
      await database.insert(settings).values({ businessLogoUploadId: upload.id })
    }

    await mirrorBusinessOrganization({
      headers: requestHeaders,
      data: { logo: parsed.data.objectKey }
    })
  } catch (error) {
    await restoreBusinessLogoUpload({
      userId: session.user.id,
      settingsId: existingSettingsId,
      uploadId: oldLogoUploadId
    })
    await deleteNewLogoFiles(session.user.id, parsed.data.objectKey)

    logger.error(
      {
        action: "confirmBusinessLogoUpload",
        userId: session.user.id,
        objectKey: parsed.data.objectKey,
        err: error
      },
      "Business logo upload confirmation failed"
    )

    return { error: t("settings.business.errors.logoUpdateFailed") }
  }

  // Deleting the previous logo happens only after the whole write succeeded, and outside the try
  // above, so a failed update leaves the old file in place for `restoreBusinessLogoUpload` to point
  // back at. `deleteOldLogoFiles` then swallows its own failures: an orphaned object in storage is
  // an acceptable outcome, reporting a failed save after the settings row already changed is not.
  if (oldLogoPath) {
    await deleteOldLogoFiles(session.user.id, oldLogoPath)
  }

  revalidatePath("/settings/business")
  revalidatePath("/")

  return { data: { storageKey: parsed.data.objectKey } }
}

export async function removeBusinessLogo(): Promise<
  { data: { success: true } } | { error: string }
> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
    query: { disableCookieCache: true }
  })

  if (!session) return { error: t("errors.unauthorized") }

  const role = await getCurrentRole({ headers: requestHeaders, userId: session.user.id })

  if (role !== "owner") return { error: t("errors.forbidden") }

  let existingSettingsId: string | null = null
  let oldLogoUploadId: string | null = null
  let oldLogoPath: string | null = null

  try {
    const existingSettings = await database.query.settings.findFirst({
      columns: { id: true, businessLogoUploadId: true }
    })

    if (!existingSettings?.businessLogoUploadId) {
      return { data: { success: true } }
    }

    existingSettingsId = existingSettings.id
    oldLogoUploadId = existingSettings.businessLogoUploadId

    const oldUpload = await database.query.uploads.findFirst({
      columns: { path: true },
      where: eq(uploads.id, existingSettings.businessLogoUploadId)
    })

    oldLogoPath = oldUpload?.path ?? null

    await database
      .update(settings)
      .set({ businessLogoUploadId: null })
      .where(eq(settings.id, existingSettings.id))

    await mirrorBusinessOrganization({
      headers: requestHeaders,
      data: { logo: "" }
    })
  } catch (error) {
    await restoreBusinessLogoUpload({
      userId: session.user.id,
      settingsId: existingSettingsId,
      uploadId: oldLogoUploadId
    })

    logger.error(
      { action: "removeBusinessLogo", userId: session.user.id, err: error },
      "Business logo removal failed"
    )

    return { error: t("settings.business.errors.logoRemoveFailed") }
  }

  if (oldLogoPath) {
    await deleteOldLogoFiles(session.user.id, oldLogoPath)
  }

  revalidatePath("/settings/business")
  revalidatePath("/")

  return { data: { success: true } }
}

async function deleteOldLogoFiles(userId: string, objectKey: string): Promise<void> {
  try {
    await database.delete(uploads).where(eq(uploads.path, objectKey))
  } catch (error) {
    logger.warn(
      { action: "deleteOldLogoFiles", userId, objectKey, err: error },
      "Failed to delete old logo upload record"
    )
  }

  try {
    await deleteStorageObject(objectKey)
  } catch (error) {
    logger.warn(
      { action: "deleteOldLogoFiles", userId, objectKey, err: error },
      "Failed to delete old logo from storage"
    )
  }
}

async function deleteNewLogoFiles(userId: string, objectKey: string): Promise<void> {
  try {
    await database.delete(uploads).where(eq(uploads.path, objectKey))
  } catch (error) {
    logger.warn(
      { action: "deleteNewLogoFiles", userId, objectKey, err: error },
      "Failed to delete new logo upload record after failed update"
    )
  }

  try {
    await deleteStorageObject(objectKey)
  } catch (error) {
    logger.warn(
      { action: "deleteNewLogoFiles", userId, objectKey, err: error },
      "Failed to delete new logo from storage after failed update"
    )
  }
}

type RestoreBusinessLogoUploadInput = {
  userId: string
  settingsId: string | null
  uploadId: string | null
}

async function restoreBusinessLogoUpload({
  userId,
  settingsId,
  uploadId
}: RestoreBusinessLogoUploadInput): Promise<void> {
  if (!settingsId) return

  try {
    await database
      .update(settings)
      .set({ businessLogoUploadId: uploadId })
      .where(eq(settings.id, settingsId))
  } catch (error) {
    logger.warn(
      { action: "restoreBusinessLogoUpload", userId, settingsId, uploadId, err: error },
      "Failed to restore previous business logo after failed update"
    )
  }
}

function toBusinessProfileWrite(
  values: BusinessProfileSettingsValues
): typeof settings.$inferInsert {
  return {
    businessName: values.businessName,
    businessEmail: emptyToNull(values.businessEmail),
    businessPhone: emptyToNull(values.businessPhone),
    businessWebsite: emptyToNull(values.businessWebsite)
  }
}

function toTaxDetailsWrite(values: TaxDetailsSettingsValues): typeof settings.$inferInsert {
  return {
    businessTaxId: emptyToNull(values.businessTaxId)
  }
}

function toBusinessAddressWrite(
  values: BusinessAddressSettingsValues
): typeof settings.$inferInsert {
  return {
    businessAddressLine1: emptyToNull(values.businessAddressLine1),
    businessAddressLine2: emptyToNull(values.businessAddressLine2),
    businessCity: emptyToNull(values.businessCity),
    businessState: emptyToNull(values.businessState),
    businessPostalCode: emptyToNull(values.businessPostalCode),
    businessCountry: values.businessCountry
  }
}

function emptyToNull(value: string): string | null {
  return value.length > 0 ? value : null
}

type BusinessSettingsWriteContext = {
  headers: Headers
  userId: string
}

type BusinessSettingsWriteGate = { context: BusinessSettingsWriteContext } | { error: string }

async function requireBusinessSettingsWrite(action: string): Promise<BusinessSettingsWriteGate> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) return { error: t("errors.unauthorized") }

  const role = await getCurrentRole({ headers: requestHeaders, userId: session.user.id })

  if (role !== "owner") return { error: t("errors.forbidden") }

  void action

  return { context: { headers: requestHeaders, userId: session.user.id } }
}

async function upsertSettings(values: typeof settings.$inferInsert): Promise<void> {
  const existing = await database.query.settings.findFirst({
    columns: { id: true }
  })

  if (existing) {
    await database.update(settings).set(values).where(eq(settings.id, existing.id))

    return
  }

  await database.insert(settings).values(values)
}

function handleSettingsWriteError(error: unknown, action: string): { error: string } {
  if (error instanceof ExpectedSettingsWriteError) return { error: error.message }

  logger.error({ action, err: error }, "Business settings write failed")

  return { error: t("settings.business.errors.updateFailed") }
}

class ExpectedSettingsWriteError extends Error {}

type MirrorBusinessOrganizationInput = {
  headers: Headers
  data: {
    name?: string
    logo?: string
  }
}

// Business name and logo live on the settings row, but Better Auth keeps its own copy on the
// organization, so the two are mirrored here. Remit runs exactly one organization per instance,
// which is why taking the first is correct rather than a shortcut, and why a missing organization
// is a no-op instead of a failure.
async function mirrorBusinessOrganization({
  headers,
  data
}: MirrorBusinessOrganizationInput): Promise<void> {
  const organizations = await auth.api.listOrganizations({ headers })
  const organization = organizations[0]

  if (!organization) return

  await auth.api.updateOrganization({
    headers,
    body: {
      organizationId: organization.id,
      data
    }
  })
}
