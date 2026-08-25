"use server"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { eq } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole, type Role } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

import { deleteDocumentObject } from "@/lib/storage/s3"
import { verifyUploadedObject } from "@/lib/storage/verifyUploadedObject"

import { database } from "@/database"
import { attachments, uploads } from "@/database/schema"

import { isAttachmentParentLive, listAttachmentSizes } from "./queries"
import { addAttachmentSchema, ATTACHMENT_MAX_BYTES, attachmentIdSchema } from "./schemas"
import { checkAttachmentLimits } from "./services/attachmentLimits"
import { toAttachmentParentColumns } from "./services/attachmentParent"

export type AddAttachmentResult = { data: { id: string } } | { error: string }

export type RemoveAttachmentResult = { data: { id: string } } | { error: string }

type AttachmentWriteContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

type AttachmentWriteGate = { context: AttachmentWriteContext } | { error: string }

export async function addAttachment(input: unknown): Promise<AddAttachmentResult> {
  const gate = await requireAttachmentWrite()

  if ("error" in gate) return gate

  const parsed = addAttachmentSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate
  const { parentType, parentId, objectKey, filename, mimeType, title } = parsed.data
  const parent = { parentType, parentId }

  // Nothing the client sent is trusted past this point. The schema already refused a key outside
  // `ATTACHMENT_KEY_PREFIX`, a mime type outside the allowlist, and a claimed size over the per-file
  // ceiling. These three reads are the parts no request can answer for itself: whether the record is
  // one this instance still has, whether the object was really uploaded and how large it actually
  // is, and what the record already holds.
  if (!(await isAttachmentParentLive(parent))) {
    return { error: t("attachments.errors.parentNotFound") }
  }

  const verified = await verifyUploadedObject({
    objectKey,
    bucket: "documents",
    maxBytes: ATTACHMENT_MAX_BYTES
  })

  if (!verified) return { error: t("attachments.errors.notUploaded") }

  const limits = checkAttachmentLimits(await listAttachmentSizes(parent), {
    sizeBytes: verified.sizeBytes
  })

  if (!limits.allowed) {
    return {
      error:
        limits.reason === "count"
          ? t("attachments.errors.limitReached")
          : t("attachments.errors.totalTooLarge")
    }
  }

  try {
    const id = await database.transaction(async (transaction) => {
      const [upload] = await transaction
        .insert(uploads)
        .values({
          filename,
          path: objectKey,
          bucket: "documents",
          mimeType,
          sizeBytes: verified.sizeBytes,
          checksumSha256: verified.checksumSha256
        })
        .returning({ id: uploads.id })

      if (!upload) throw new Error("Attachment upload insert returned no row")

      const [attachment] = await transaction
        .insert(attachments)
        .values({
          ...toAttachmentParentColumns(parent),
          uploadId: upload.id,
          title: title && title.length > 0 ? title : null,
          uploadedByUserId: context.userId
        })
        .returning({ id: attachments.id })

      if (!attachment) throw new Error("Attachment insert returned no row")

      return attachment.id
    })

    await writeAudit("attachment.added", {
      actorUserId: context.userId,
      actorRole: context.role,
      targetEntityType: parentType,
      targetEntityId: parentId,
      metadata: { attachmentId: id, filename, mimeType, sizeBytes: verified.sizeBytes },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    })

    revalidateAttachmentPaths()

    return { data: { id } }
  } catch (error) {
    logger.error(
      { action: "addAttachment", parentType, parentId, userId: context.userId, err: error },
      "Attachment insert failed"
    )

    return { error: t("attachments.errors.addFailed") }
  }
}

export async function removeAttachment(input: unknown): Promise<RemoveAttachmentResult> {
  const gate = await requireAttachmentWrite()

  if ("error" in gate) return gate

  const parsed = attachmentIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const [row] = await database
      .select({
        uploadId: attachments.uploadId,
        storageKey: uploads.path,
        filename: uploads.filename
      })
      .from(attachments)
      .innerJoin(uploads, eq(attachments.uploadId, uploads.id))
      .where(eq(attachments.id, parsed.data.id))
      .limit(1)

    if (!row) return { error: t("attachments.errors.notFound") }

    // Deleting the `uploads` row is what removes the attachment: `attachments.upload_id` cascades,
    // so the two rows go together and there is no window where one outlives the other.
    await database.delete(uploads).where(eq(uploads.id, row.uploadId))

    // Best-effort, and deliberately after the rows are gone rather than before. A stored object with
    // no row pointing at it is unreachable and swept by nothing (ADR-0028); a row pointing at a
    // deleted object renders as a download that 404s, which is the worse of the two.
    try {
      await deleteDocumentObject(row.storageKey)
    } catch (error) {
      logger.error(
        { action: "removeAttachment", attachmentId: parsed.data.id, err: error },
        "Attachment object delete failed after row delete"
      )
    }

    await writeAudit("attachment.removed", {
      actorUserId: context.userId,
      actorRole: context.role,
      targetEntityType: "attachment",
      targetEntityId: parsed.data.id,
      metadata: { filename: row.filename },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    })

    revalidateAttachmentPaths()

    return { data: { id: parsed.data.id } }
  } catch (error) {
    logger.error(
      { action: "removeAttachment", attachmentId: parsed.data.id, err: error },
      "Attachment delete failed"
    )

    return { error: t("attachments.errors.removeFailed") }
  }
}

// The same owner/assistant split `features/clients` uses for its writes: an accountant reads the
// business records and does not change them, so they may download an attachment and not add or
// remove one.
async function requireAttachmentWrite(): Promise<AttachmentWriteGate> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) return { error: t("errors.unauthorized") }

  const role = await getCurrentRole({ headers: requestHeaders, userId: session.user.id })

  if (role !== "owner" && role !== "assistant") return { error: t("errors.forbidden") }

  return {
    context: {
      userId: session.user.id,
      role,
      ipAddress: getIpAddress(requestHeaders),
      userAgent: requestHeaders.get("user-agent")
    }
  }
}

// Every surface that renders an attachment panel, revalidated together rather than per parent type:
// the four paths are static prefixes and a panel is a small part of each page, so narrowing this to
// the one parent that changed would trade a real branch for no measurable saving.
function revalidateAttachmentPaths(): void {
  revalidatePath("/clients")
  revalidatePath("/projects")
  revalidatePath("/invoices")
  revalidatePath("/expenses")
}
