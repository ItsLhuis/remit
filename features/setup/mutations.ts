"use server"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { eq } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"

import { database } from "@/database"
import { settings } from "@/database/schema"

import { businessProfileSchema } from "./schemas"

export async function saveBusinessProfile(
  input: unknown
): Promise<{ data: { success: true } } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) return { error: t("errors.unauthorized") }

  const parsed = businessProfileSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { businessName, businessEmail, businessTaxId, businessCountry, defaultCurrency } =
    parsed.data

  try {
    const existing = await database.query.settings.findFirst()

    if (existing) {
      await database
        .update(settings)
        .set({
          businessName,
          businessEmail: businessEmail || null,
          businessTaxId: businessTaxId || null,
          businessCountry,
          defaultCurrency
        })
        .where(eq(settings.id, existing.id))
    } else {
      await database.insert(settings).values({
        businessName,
        businessEmail: businessEmail || null,
        businessTaxId: businessTaxId || null,
        businessCountry,
        defaultCurrency
      })
    }
  } catch (error) {
    console.error("saveBusinessProfile: database write failed", { error })

    return { error: t("errors.somethingWentWrong") }
  }

  revalidatePath("/setup")
  revalidatePath("/")

  return { data: { success: true } }
}
