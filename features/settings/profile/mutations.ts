"use server"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { eq } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"

import { logger } from "@/lib/logger"

import { env } from "@/lib/config/env"
import { IMAGE_UPLOAD_MAX_BYTES } from "@/lib/storage"
import { deleteStorageObject } from "@/lib/storage/s3"
import { verifyUploadedObject } from "@/lib/storage/verifyUploadedObject"

import { database } from "@/database"
import { uploads } from "@/database/schema"

import { changeEmailSchema, confirmAvatarUploadSchema } from "./schemas"

export async function changeEmailAddress(
  input: unknown
): Promise<{ data: { pendingVerification: true } } | { error: string }> {
  const requestHeaders = await headers()

  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) return { error: t("settings.profile.errors.unauthorized") }

  const parsed = changeEmailSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    await auth.api.changeEmail({
      headers: requestHeaders,
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
  const requestHeaders = await headers()

  // One of the call sites `lib/auth/index.ts`'s cookie-cache note is about. `session.user.image` is
  // not just read here, it decides which object the cleanup below deletes, and the cached copy can
  // be up to five minutes old — long enough for a second avatar change to make it name a key that
  // has already been replaced, orphaning the real previous file.
  const session = await auth.api.getSession({
    headers: requestHeaders,
    query: { disableCookieCache: true }
  })

  if (!session) return { error: t("settings.profile.errors.unauthorized") }

  const parsed = confirmAvatarUploadSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const oldKey = session.user.image

  // The presigned PUT is a URL, not proof that anything was stored. Reading the object back is what
  // turns the client's report into a fact, and it is what supplies the size and checksum the row
  // records (`lib/storage/verifyUploadedObject.ts`).
  const verified = await verifyUploadedObject({
    objectKey: parsed.data.objectKey,
    bucket: "public",
    maxBytes: IMAGE_UPLOAD_MAX_BYTES
  })

  if (!verified) return { error: t("settings.profile.uploadFailed") }

  try {
    await database.insert(uploads).values({
      filename: parsed.data.filename,
      path: parsed.data.objectKey,
      mimeType: parsed.data.mimeType,
      sizeBytes: verified.sizeBytes,
      checksumSha256: verified.checksumSha256
    })

    await auth.api.updateUser({
      headers: requestHeaders,
      body: { image: parsed.data.objectKey }
    })
  } catch (error) {
    await deleteNewAvatarFile(session.user.id, parsed.data.objectKey)

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

  if (isStorageKey(oldKey)) {
    await deleteOldAvatarFiles(session.user.id, oldKey)
  }

  revalidatePath("/settings/profile")

  return { data: { storageKey: parsed.data.objectKey } }
}

export async function removeAvatar(): Promise<{ data: { success: true } } | { error: string }> {
  const requestHeaders = await headers()

  // One of the call sites `lib/auth/index.ts`'s cookie-cache note is about. `session.user.image` is
  // not just read here, it decides which object the cleanup below deletes, and the cached copy can
  // be up to five minutes old — long enough for a second avatar change to make it name a key that
  // has already been replaced, orphaning the real previous file.
  const session = await auth.api.getSession({
    headers: requestHeaders,
    query: { disableCookieCache: true }
  })

  if (!session) return { error: t("settings.profile.errors.unauthorized") }

  const oldKey = session.user.image

  try {
    await auth.api.updateUser({
      headers: requestHeaders,
      body: { image: null }
    })
  } catch (error) {
    logger.error(
      { action: "removeAvatar", userId: session.user.id, err: error },
      "Avatar removal failed"
    )

    return { error: t("settings.profile.errors.avatarRemoveFailed") }
  }

  if (isStorageKey(oldKey)) {
    await deleteOldAvatarFiles(session.user.id, oldKey)
  }

  revalidatePath("/settings/profile")

  return { data: { success: true } }
}

function isStorageKey(value: string | null | undefined): value is string {
  if (!value) return false

  return !value.startsWith("http://") && !value.startsWith("https://")
}

async function deleteOldAvatarFiles(userId: string, objectKey: string): Promise<void> {
  try {
    await database.delete(uploads).where(eq(uploads.path, objectKey))
  } catch (error) {
    logger.warn(
      { action: "deleteOldAvatarFiles", userId, objectKey, err: error },
      "Failed to delete old avatar upload record"
    )
  }

  try {
    await deleteStorageObject(objectKey)
  } catch (error) {
    logger.warn(
      { action: "deleteOldAvatarFiles", userId, objectKey, err: error },
      "Failed to delete old avatar from storage"
    )
  }
}

async function deleteNewAvatarFile(userId: string, objectKey: string): Promise<void> {
  try {
    await database.delete(uploads).where(eq(uploads.path, objectKey))
  } catch (error) {
    logger.warn(
      { action: "deleteNewAvatarFile", userId, objectKey, err: error },
      "Failed to delete new avatar upload record after failed update"
    )
  }

  try {
    await deleteStorageObject(objectKey)
  } catch (error) {
    logger.warn(
      { action: "deleteNewAvatarFile", userId, objectKey, err: error },
      "Failed to delete new avatar from storage after failed update"
    )
  }
}
