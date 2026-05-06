"use server"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { t } from "@/lib/i18n/server"

import { database } from "@/database"
import { uploads } from "@/database/schema"

export async function changeEmailAddress(
  email: string
): Promise<{ error: string } | { success: true; pendingVerification: true }> {
  try {
    await auth.api.changeEmail({
      headers: await headers(),
      body: { newEmail: email, callbackURL: "/settings/profile" }
    })

    return { success: true, pendingVerification: true }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : t("settings.profile.errors.emailChangeFailed")

    return { error: message }
  }
}

export async function confirmAvatarUpload(
  objectKey: string,
  filename: string,
  mimeType: string,
  sizeBytes: number
): Promise<{ error: string } | { success: true; storageKey: string }> {
  const requestHeaders = await headers()

  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) return { error: t("settings.profile.errors.unauthorized") }

  try {
    await database.insert(uploads).values({
      filename,
      path: objectKey,
      mimeType,
      sizeBytes
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : t("settings.profile.errors.avatarUpdateFailed")

    return { error: message }
  }

  revalidatePath("/settings/profile")

  return { success: true, storageKey: objectKey }
}
