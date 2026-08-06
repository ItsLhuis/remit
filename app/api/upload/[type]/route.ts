import { headers } from "next/headers"

import { type NextRequest, NextResponse } from "next/server"

import { randomUUID } from "node:crypto"

import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import { z } from "zod"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"

import { MINIO_BUCKET, s3UploadPresigner } from "@/lib/storage/s3"

const IMAGE_MIME_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"]
])

// A receipt is whatever the supplier handed over, and that is a PDF at least as often as a photo.
const RECEIPT_MIME_TYPES = new Map([...IMAGE_MIME_TYPES, ["application/pdf", "pdf"]])

const IMAGE_MAX_BYTES = 5 * 1024 * 1024

// Deliberately restated here rather than imported from `features/expenses`: this module is reachable
// from an anonymous request, and the feature barrel pulls its server actions — and `@/database` with
// them — into the route's graph. `features/expenses/schemas.ts` holds the matching
// `EXPENSE_RECEIPT_KEY_PREFIX`, `EXPENSE_RECEIPT_MIME_TYPES` and `EXPENSE_RECEIPT_MAX_BYTES`, and
// refuses any receipt whose key falls outside the prefix minted below. Change one side and the
// expense's own validation rejects what this route just signed.
const RECEIPT_KEY_PREFIX = "expenses/"

const RECEIPT_MAX_BYTES = 10 * 1024 * 1024

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
          maxBytes: IMAGE_MAX_BYTES
        }),
        mimeTypes: IMAGE_MIME_TYPES,
        invalidTypeError: t("settings.profile.invalidAvatarFileType"),
        uploadFailedError: t("settings.profile.uploadUrlFailed"),
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
          maxBytes: IMAGE_MAX_BYTES
        }),
        mimeTypes: IMAGE_MIME_TYPES,
        invalidTypeError: t("settings.business.invalidLogoFileType"),
        uploadFailedError: t("settings.business.uploadUrlFailed"),
        objectKey: ({ ext }) => `logos/${randomUUID()}.${ext}`
      }
    case "template-image":
      return {
        schema: buildUploadSchema({
          filenameRequired: t("templates.validation.imageFilenameRequired"),
          contentTypeRequired: t("templates.validation.imageContentTypeRequired"),
          sizeInvalid: t("templates.validation.imageSizeInvalid"),
          tooLarge: t("templates.validation.imageTooLarge"),
          maxBytes: IMAGE_MAX_BYTES
        }),
        mimeTypes: IMAGE_MIME_TYPES,
        invalidTypeError: t("templates.validation.imageInvalidFileType"),
        uploadFailedError: t("templates.validation.imageUploadUrlFailed"),
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
        objectKey: ({ ext }) => `${RECEIPT_KEY_PREFIX}${randomUUID()}.${ext}`
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
    Bucket: MINIO_BUCKET,
    Key: objectKey,
    ContentType: parsed.data.contentType
  })

  try {
    const presignedUrl = await getSignedUrl(s3UploadPresigner, command, { expiresIn: 60 })

    return NextResponse.json({ uploadUrl: presignedUrl, objectKey })
  } catch {
    return NextResponse.json({ error: config.uploadFailedError }, { status: 500 })
  }
}
