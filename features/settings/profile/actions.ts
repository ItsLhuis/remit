"use server"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { auth } from "@/lib/auth"

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
    const message = error instanceof Error ? error.message : "Failed to initiate email change."

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

  if (!session) return { error: "Unauthorized." }

  try {
    await database.insert(uploads).values({
      userId: session.user.id,
      filename,
      path: objectKey,
      mimeType,
      sizeBytes
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update profile picture."

    return { error: message }
  }

  revalidatePath("/settings/profile")

  return { success: true, storageKey: objectKey }
}
