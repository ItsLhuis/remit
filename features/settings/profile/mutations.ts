"use server"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { t } from "@/lib/i18n/server"

import { env } from "@/lib/config/env"

import { auth } from "@/lib/auth"

import { logger } from "@/lib/logger"

import { database } from "@/database"
import { uploads } from "@/database/schema"

import { changeEmailSchema, confirmAvatarUploadSchema } from "./schemas"

export async function changeEmailAddress(
  input: unknown
): Promise<{ data: { pendingVerification: true } } | { error: string }> {
  const parsed = changeEmailSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    await auth.api.changeEmail({
      headers: await headers(),
      body: {
        newEmail: parsed.data.email,
        callbackURL: new URL("/settings/profile", env.BETTER_AUTH_URL).toString()
      }
    })

    return { data: { pendingVerification: true } }
  } catch (error) {
    logger.error(
      { action: "changeEmailAddress", err: error },
      "Profile email change request failed"
    )

    return { error: t("settings.profile.errors.emailChangeFailed") }
  }
}

export async function confirmAvatarUpload(
  input: unknown
): Promise<{ data: { storageKey: string } } | { error: string }> {
  const parsed = confirmAvatarUploadSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const requestHeaders = await headers()

  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) return { error: t("settings.profile.errors.unauthorized") }

  try {
    await database.insert(uploads).values({
      filename: parsed.data.filename,
      path: parsed.data.objectKey,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes
    })
  } catch (error) {
    logger.error(
      {
        action: "confirmAvatarUpload",
        userId: session.user.id,
        objectKey: parsed.data.objectKey,
        err: error
      },
      "Avatar upload confirmation failed"
    )

    return { error: t("settings.profile.errors.avatarUpdateFailed") }
  }

  revalidatePath("/settings/profile")

  return { data: { storageKey: parsed.data.objectKey } }
}
