"use server"

import { mkdir, writeFile } from "fs/promises"

import path from "path"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { auth } from "@/lib/auth"

import { database } from "@/database"
import { uploads } from "@/database/schema"

export async function updateProfileName(
  name: string
): Promise<{ error: string } | { success: true }> {
  try {
    await auth.api.updateUser({
      headers: await headers(),
      body: { name }
    })

    revalidatePath("/settings/profile")

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update name."

    return { error: message }
  }
}

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

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_FILE_SIZE = 5 * 1024 * 1024

export async function uploadAvatar(
  formData: FormData
): Promise<{ error: string } | { success: true; imageUrl: string }> {
  const requestHeaders = await headers()

  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) return { error: "Unauthorized." }

  const file = formData.get("file")

  if (!(file instanceof File) || file.size === 0) return { error: "No file provided." }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { error: "Invalid file type. Use JPG, PNG, WebP, or GIF." }
  }

  if (file.size > MAX_FILE_SIZE) return { error: "File too large. Maximum size is 5MB." }

  const userId = session.user.id
  const timestamp = Date.now()
  const extension = file.name.split(".").pop() ?? "jpg"
  const filename = `${timestamp}.${extension}`
  const relativePath = `/uploads/avatars/${userId}/${filename}`
  const absolutePath = path.join(process.cwd(), "public", relativePath)

  const buffer = Buffer.from(await file.arrayBuffer())

  await mkdir(path.dirname(absolutePath), { recursive: true })

  await writeFile(absolutePath, buffer)

  await database.insert(uploads).values({
    userId,
    filename: file.name,
    path: relativePath,
    mimeType: file.type,
    sizeBytes: file.size
  })

  try {
    await auth.api.updateUser({
      headers: requestHeaders,
      body: { image: relativePath }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update profile picture."

    return { error: message }
  }

  revalidatePath("/settings/profile")

  return { success: true, imageUrl: relativePath }
}
