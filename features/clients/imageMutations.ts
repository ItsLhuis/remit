"use server"

import { revalidatePath } from "next/cache"

import { and, eq, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { logger } from "@/lib/logger"

import { IMAGE_UPLOAD_MAX_BYTES } from "@/lib/storage"
import { deleteStorageObject } from "@/lib/storage/s3"
import { verifyUploadedObject } from "@/lib/storage/verifyUploadedObject"

import { database } from "@/database"
import { clients, uploads } from "@/database/schema"

import { handleClientActionError, requireClientWrite, writeClientAudit } from "./mutationContext"
import { clientIdSchema, confirmClientImageUploadSchema } from "./schemas"

const clientsPath = "/clients"

export type ClientImageResult = { data: { storageKey: string | null } } | { error: string }

export async function confirmClientImageUpload(input: unknown): Promise<ClientImageResult> {
  const gate = await requireClientWrite()

  if ("error" in gate) return gate

  const parsed = confirmClientImageUploadSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  const verified = await verifyUploadedObject({
    objectKey: parsed.data.objectKey,
    bucket: "public",
    maxBytes: IMAGE_UPLOAD_MAX_BYTES
  })

  if (!verified) return { error: t("clients.errors.imageUpdateFailed") }

  try {
    const existing = await database.query.clients.findFirst({
      columns: { imageUploadId: true },
      where: and(eq(clients.id, parsed.data.clientId), isNull(clients.deletedAt)),
      with: { image: { columns: { path: true } } }
    })

    if (!existing) return { error: t("clients.errors.notFound") }

    const [upload] = await database
      .insert(uploads)
      .values({
        filename: parsed.data.filename,
        path: parsed.data.objectKey,
        mimeType: parsed.data.contentType,
        sizeBytes: verified.sizeBytes,
        checksumSha256: verified.checksumSha256
      })
      .returning({ id: uploads.id })

    if (!upload) throw new Error("Client image upload insert returned no row")

    await database
      .update(clients)
      .set({ imageUploadId: upload.id })
      .where(eq(clients.id, parsed.data.clientId))

    // Only after the column points at the new upload. Deleting first would leave the client with no
    // image at all if the update below failed, and the old object is the one thing that cannot be
    // recovered.
    await deleteReplacedClientImage(existing.imageUploadId, existing.image?.path ?? null)

    await writeClientAudit(context, "client.updated", parsed.data.clientId, {
      changedFields: ["image"]
    })

    revalidatePath(clientsPath)
    revalidatePath(`${clientsPath}/${parsed.data.clientId}`)

    return { data: { storageKey: parsed.data.objectKey } }
  } catch (error) {
    return handleClientActionError(error, "confirmClientImageUpload", context.userId)
  }
}

export async function removeClientImage(input: unknown): Promise<ClientImageResult> {
  const gate = await requireClientWrite()

  if ("error" in gate) return gate

  const parsed = clientIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await database.query.clients.findFirst({
      columns: { imageUploadId: true },
      where: and(eq(clients.id, parsed.data.id), isNull(clients.deletedAt)),
      with: { image: { columns: { path: true } } }
    })

    if (!existing) return { error: t("clients.errors.notFound") }

    await database
      .update(clients)
      .set({ imageUploadId: null })
      .where(eq(clients.id, parsed.data.id))

    await deleteReplacedClientImage(existing.imageUploadId, existing.image?.path ?? null)

    await writeClientAudit(context, "client.updated", parsed.data.id, {
      changedFields: ["image"]
    })

    revalidatePath(clientsPath)
    revalidatePath(`${clientsPath}/${parsed.data.id}`)

    return { data: { storageKey: null } }
  } catch (error) {
    return handleClientActionError(error, "removeClientImage", context.userId, parsed.data.id)
  }
}

// Best-effort cleanup of the image a client just stopped pointing at. Swallowed rather than surfaced
// because the column is already correct by the time it runs: failing the whole action here would
// tell the user their image did not change when it did, and the orphaned object is invisible.
async function deleteReplacedClientImage(
  uploadId: string | null,
  storageKey: string | null
): Promise<void> {
  if (!uploadId) return

  try {
    await database.delete(uploads).where(eq(uploads.id, uploadId))

    if (storageKey) await deleteStorageObject(storageKey)
  } catch (error) {
    logger.error(
      { action: "deleteReplacedClientImage", uploadId, err: error },
      "Client image cleanup failed"
    )
  }
}
