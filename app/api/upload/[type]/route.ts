import { headers } from "next/headers"

import { type NextRequest, NextResponse } from "next/server"

import { randomUUID } from "node:crypto"

import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import { z } from "zod"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"

import { IMAGE_UPLOAD_MAX_BYTES, type IMAGE_UPLOAD_MIME_TYPES } from "@/lib/storage"
import {
  ensureDocumentsBucket,
  MINIO_BUCKET,
  MINIO_DOCUMENTS_BUCKET,
  s3UploadPresigner,
  type StorageBucketName
} from "@/lib/storage/s3"

// Built from `lib/storage/limits.ts` rather than restated: unlike the expense constants below, that
// module is not a feature — it pulls in nothing but the numbers themselves — so the client's
// pre-check, this signed URL, and the confirm mutation's server-side verification all read one
// source. The extension map is local because only this route names objects.
const IMAGE_EXTENSIONS: Record<(typeof IMAGE_UPLOAD_MIME_TYPES)[number], string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
}

const IMAGE_MIME_TYPES = new Map<string, string>(Object.entries(IMAGE_EXTENSIONS))

// A receipt is whatever the supplier handed over, and that is a PDF at least as often as a photo.
const RECEIPT_MIME_TYPES = new Map([...IMAGE_MIME_TYPES, ["application/pdf", "pdf"]])

// Deliberately restated here rather than imported from `features/expenses`: this module is reachable
// from an anonymous request, and the feature barrel pulls its server actions — and `@/database` with
// them — into the route's graph. `features/expenses/schemas.ts` holds the matching
// `EXPENSE_RECEIPT_KEY_PREFIX`, `EXPENSE_RECEIPT_MIME_TYPES` and `EXPENSE_RECEIPT_MAX_BYTES`, and
// refuses any receipt whose key falls outside the prefix minted below. Change one side and the
// expense's own validation rejects what this route just signed.
const RECEIPT_KEY_PREFIX = "expenses/"

const RECEIPT_MAX_BYTES = 10 * 1024 * 1024

// Restated here for the same reason as the receipt constants directly above, and pairing with
// `features/attachments/schemas.ts`'s `ATTACHMENT_KEY_PREFIX`, `ATTACHMENT_MIME_TYPES` and
// `ATTACHMENT_MAX_BYTES`. `addAttachment` refuses any key outside this prefix, so signing one the
// feature would reject fails at the mutation instead of silently storing an unreferenced object.
const ATTACHMENT_KEY_PREFIX = "attachments/"

const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024

// No archives and no executables: an archive would carry anything past the allowlist, and the
// download route names the type it serves back.
const ATTACHMENT_MIME_TYPES = new Map([
  ...IMAGE_MIME_TYPES,
  ["application/pdf", "pdf"],
  ["text/csv", "csv"],
  ["text/plain", "txt"]
])

function buildUploadSchema(messages: {
  filenameRequired: string
  contentTypeRequired: string
  sizeInvalid: string
  tooLarge: string
  maxBytes: number
}) {
  return z.object({
    filename: z.string().trim().min(1, messages.filenameRequired),
    contentType: z.string().trim().min(1, messages.contentTypeRequired),
    sizeBytes: z
      .number()
      .int(messages.sizeInvalid)
      .positive(messages.sizeInvalid)
      .max(messages.maxBytes, messages.tooLarge)
  })
}

type UploadConfig = {
  schema: ReturnType<typeof buildUploadSchema>
  mimeTypes: Map<string, string>
  invalidTypeError: string
  uploadFailedError: string
  // Which store the signed PUT writes into, and therefore who can read the result. `public` is the
  // anonymously-readable bucket where an unguessable key is the whole access control — correct for
  // an avatar or a template image, which are rendered by `resolveStorageUrl` in the browser. An
  // attachment is a client's NDA or a project brief, so it lands in the private `documents` bucket
  // and is served only through the credentialed `app/api/attachments/[id]` route.
  bucket: StorageBucketName
  objectKey: (input: { ext: string; userId?: string }) => string
}

function getUploadConfig(type: string): UploadConfig | null {
  switch (type) {
    case "avatar":
      return {
        schema: buildUploadSchema({
          filenameRequired: t("settings.profile.validation.avatarFilenameRequired"),
          contentTypeRequired: t("settings.profile.validation.avatarContentTypeRequired"),
          sizeInvalid: t("settings.profile.validation.avatarSizeInvalid"),
          tooLarge: t("settings.profile.validation.avatarTooLarge"),
          maxBytes: IMAGE_UPLOAD_MAX_BYTES
        }),
        mimeTypes: IMAGE_MIME_TYPES,
        invalidTypeError: t("settings.profile.invalidAvatarFileType"),
        uploadFailedError: t("settings.profile.uploadUrlFailed"),
        bucket: "public",
        objectKey: ({ ext, userId }) => {
          if (!userId) throw new Error("Avatar uploads require a user id")

          return `avatars/${userId}/${randomUUID()}.${ext}`
        }
      }
    case "business-logo":
      return {
        schema: buildUploadSchema({
          filenameRequired: t("settings.business.validation.logoFilenameRequired"),
          contentTypeRequired: t("settings.business.validation.logoContentTypeRequired"),
          sizeInvalid: t("settings.business.validation.logoSizeInvalid"),
          tooLarge: t("settings.business.validation.logoTooLarge"),
          maxBytes: IMAGE_UPLOAD_MAX_BYTES
        }),
        mimeTypes: IMAGE_MIME_TYPES,
        invalidTypeError: t("settings.business.invalidLogoFileType"),
        uploadFailedError: t("settings.business.uploadUrlFailed"),
        bucket: "public",
        objectKey: ({ ext }) => `logos/${randomUUID()}.${ext}`
      }
    case "template-image":
      return {
        schema: buildUploadSchema({
          filenameRequired: t("templates.validation.imageFilenameRequired"),
          contentTypeRequired: t("templates.validation.imageContentTypeRequired"),
          sizeInvalid: t("templates.validation.imageSizeInvalid"),
          tooLarge: t("templates.validation.imageTooLarge"),
          maxBytes: IMAGE_UPLOAD_MAX_BYTES
        }),
        mimeTypes: IMAGE_MIME_TYPES,
        invalidTypeError: t("templates.validation.imageInvalidFileType"),
        uploadFailedError: t("templates.validation.imageUploadUrlFailed"),
        bucket: "public",
        objectKey: ({ ext }) => `templates/${randomUUID()}.${ext}`
      }
    case "expense-receipt":
      return {
        schema: buildUploadSchema({
          filenameRequired: t("expenses.validation.receiptFilenameRequired"),
          contentTypeRequired: t("expenses.validation.receiptTypeInvalid"),
          sizeInvalid: t("expenses.validation.receiptSizeInvalid"),
          tooLarge: t("expenses.validation.receiptTooLarge", {
            megabytes: RECEIPT_MAX_BYTES / (1024 * 1024)
          }),
          maxBytes: RECEIPT_MAX_BYTES
        }),
        mimeTypes: RECEIPT_MIME_TYPES,
        invalidTypeError: t("expenses.errors.invalidFileType"),
        uploadFailedError: t("expenses.errors.uploadUrlFailed"),
        bucket: "public",
        objectKey: ({ ext }) => `${RECEIPT_KEY_PREFIX}${randomUUID()}.${ext}`
      }
    case "client-image":
      return {
        schema: buildUploadSchema({
          filenameRequired: t("clients.validation.imageFilenameRequired"),
          contentTypeRequired: t("clients.validation.imageContentTypeRequired"),
          sizeInvalid: t("clients.validation.imageSizeInvalid"),
          tooLarge: t("clients.validation.imageTooLarge"),
          maxBytes: IMAGE_UPLOAD_MAX_BYTES
        }),
        mimeTypes: IMAGE_MIME_TYPES,
        invalidTypeError: t("clients.errors.invalidImageFileType"),
        uploadFailedError: t("clients.errors.imageUploadUrlFailed"),
        bucket: "public",
        objectKey: ({ ext }) => `clients/${randomUUID()}.${ext}`
      }
    case "attachment":
      return {
        schema: buildUploadSchema({
          filenameRequired: t("attachments.errors.invalidKey"),
          contentTypeRequired: t("attachments.errors.invalidType"),
          sizeInvalid: t("attachments.errors.tooLarge"),
          tooLarge: t("attachments.errors.tooLarge"),
          maxBytes: ATTACHMENT_MAX_BYTES
        }),
        mimeTypes: ATTACHMENT_MIME_TYPES,
        invalidTypeError: t("attachments.errors.invalidType"),
        uploadFailedError: t("attachments.errors.addFailed"),
        bucket: "documents",
        objectKey: ({ ext }) => `${ATTACHMENT_KEY_PREFIX}${randomUUID()}.${ext}`
      }
    default:
      return null
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params

  const config = getUploadConfig(type)

  if (!config) {
    return NextResponse.json({ error: t("errors.notFound") }, { status: 404 })
  }

  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    return NextResponse.json({ error: t("errors.unauthorized") }, { status: 401 })
  }

  const parsed = config.schema.safeParse(await request.json())

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const extension = config.mimeTypes.get(parsed.data.contentType)

  if (!extension) {
    return NextResponse.json({ error: config.invalidTypeError }, { status: 400 })
  }

  // The key is built entirely server-side from a random UUID and an extension looked up in
  // the route variant's `mimeTypes`; the client's own filename is validated but never used to name
  // the object.
  // That matters twice over: it keeps a caller from writing outside its prefix or overwriting
  // another object by path, and the bucket grants anonymous reads (see `lib/storage/s3.ts`), so an
  // unguessable key is the only thing keeping one instance's uploads from being enumerable.
  const objectKey = config.objectKey({ userId: session.user.id, ext: extension })

  const command = new PutObjectCommand({
    Bucket: config.bucket === "documents" ? MINIO_DOCUMENTS_BUCKET : MINIO_BUCKET,
    Key: objectKey,
    ContentType: parsed.data.contentType
  })

  try {
    // The documents bucket is created lazily by whoever writes to it first, and until this route
    // existed that was always the worker. A presigned URL for a bucket that does not exist yet fails
    // in the browser with an S3 error the user cannot act on, so it is created here before signing.
    if (config.bucket === "documents") await ensureDocumentsBucket()

    const presignedUrl = await getSignedUrl(s3UploadPresigner, command, { expiresIn: 60 })

    return NextResponse.json({ uploadUrl: presignedUrl, objectKey })
  } catch {
    return NextResponse.json({ error: config.uploadFailedError }, { status: 500 })
  }
}
