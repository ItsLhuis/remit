"use server"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { eq } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole } from "@/lib/auth/session"

import { logger } from "@/lib/logger"

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
  const parsed = businessProfileSettingsSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    const context = await requireBusinessSettingsWrite("saveBusinessProfileSettings")

    await upsertSettings(toBusinessProfileWrite(parsed.data))

    await mirrorBusinessOrganization({
      headers: context.headers,
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
  const parsed = regionalDefaultsSettingsSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    await requireBusinessSettingsWrite("saveRegionalDefaultsSettings")
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
  const parsed = taxDetailsSettingsSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    await requireBusinessSettingsWrite("saveTaxDetailsSettings")
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
  const parsed = businessAddressSettingsSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    await requireBusinessSettingsWrite("saveBusinessAddressSettings")
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
  const parsed = confirmBusinessLogoUploadSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) return { error: t("errors.unauthorized") }

  const role = await getCurrentRole({ headers: requestHeaders, userId: session.user.id })

  if (role !== "owner") return { error: t("errors.forbidden") }

  try {
    const [upload] = await database
      .insert(uploads)
      .values({
        filename: parsed.data.filename,
        path: parsed.data.objectKey,
        mimeType: parsed.data.contentType,
        sizeBytes: parsed.data.sizeBytes
      })
      .returning({ id: uploads.id })

    if (!upload) return { error: t("settings.business.errors.logoUpdateFailed") }

    const existing = await database.query.settings.findFirst({
      columns: { id: true }
    })

    if (existing) {
      await database
        .update(settings)
        .set({ businessLogoUploadId: upload.id })
        .where(eq(settings.id, existing.id))
    } else {
      await database.insert(settings).values({ businessLogoUploadId: upload.id })
    }

    await mirrorBusinessOrganization({
      headers: requestHeaders,
      data: { logo: parsed.data.objectKey }
    })
  } catch (error) {
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

  revalidatePath("/settings/business")
  revalidatePath("/")

  return { data: { storageKey: parsed.data.objectKey } }
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

async function requireBusinessSettingsWrite(action: string): Promise<BusinessSettingsWriteContext> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) throw new ExpectedSettingsWriteError(t("errors.unauthorized"))

  const role = await getCurrentRole({ headers: requestHeaders, userId: session.user.id })

  if (role !== "owner") throw new ExpectedSettingsWriteError(t("errors.forbidden"))

  void action

  return { headers: requestHeaders, userId: session.user.id }
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
