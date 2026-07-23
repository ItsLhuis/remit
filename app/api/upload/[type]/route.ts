import { headers } from "next/headers"

import { type NextRequest, NextResponse } from "next/server"

import { randomUUID } from "node:crypto"

import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import { z } from "zod"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"

import { MINIO_BUCKET, s3UploadPresigner } from "@/lib/storage/s3"

const ALLOWED_MIME_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"]
])

function buildImageUploadSchema(messages: {
  filenameRequired: string
  contentTypeRequired: string
  sizeInvalid: string
  tooLarge: string
}) {
  return z.object({
    filename: z.string().trim().min(1, messages.filenameRequired),
    contentType: z.string().trim().min(1, messages.contentTypeRequired),
    sizeBytes: z
      .number()
      .int(messages.sizeInvalid)
      .positive(messages.sizeInvalid)
      .max(5 * 1024 * 1024, messages.tooLarge)
  })
}

type UploadConfig = {
  schema: ReturnType<typeof buildImageUploadSchema>
  invalidTypeError: string
  uploadFailedError: string
  objectKey: (input: { ext: string; userId?: string }) => string
}

function getUploadConfig(type: string): UploadConfig | null {
  switch (type) {
    case "avatar":
      return {
        schema: buildImageUploadSchema({
          filenameRequired: t("settings.profile.validation.avatarFilenameRequired"),
          contentTypeRequired: t("settings.profile.validation.avatarContentTypeRequired"),
          sizeInvalid: t("settings.profile.validation.avatarSizeInvalid"),
          tooLarge: t("settings.profile.validation.avatarTooLarge")
        }),
        invalidTypeError: t("settings.profile.invalidAvatarFileType"),
        uploadFailedError: t("settings.profile.uploadUrlFailed"),
        objectKey: ({ ext, userId }) => {
          if (!userId) throw new Error("Avatar uploads require a user id")

          return `avatars/${userId}/${randomUUID()}.${ext}`
        }
      }
    case "business-logo":
      return {
        schema: buildImageUploadSchema({
          filenameRequired: t("settings.business.validation.logoFilenameRequired"),
          contentTypeRequired: t("settings.business.validation.logoContentTypeRequired"),
          sizeInvalid: t("settings.business.validation.logoSizeInvalid"),
          tooLarge: t("settings.business.validation.logoTooLarge")
        }),
        invalidTypeError: t("settings.business.invalidLogoFileType"),
        uploadFailedError: t("settings.business.uploadUrlFailed"),
        objectKey: ({ ext }) => `logos/${randomUUID()}.${ext}`
      }
    case "template-image":
      return {
        schema: buildImageUploadSchema({
          filenameRequired: t("templates.validation.imageFilenameRequired"),
          contentTypeRequired: t("templates.validation.imageContentTypeRequired"),
          sizeInvalid: t("templates.validation.imageSizeInvalid"),
          tooLarge: t("templates.validation.imageTooLarge")
        }),
        invalidTypeError: t("templates.validation.imageInvalidFileType"),
        uploadFailedError: t("templates.validation.imageUploadUrlFailed"),
        objectKey: ({ ext }) => `templates/${randomUUID()}.${ext}`
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

  const extension = ALLOWED_MIME_TYPES.get(parsed.data.contentType)

  if (!extension) {
    return NextResponse.json({ error: config.invalidTypeError }, { status: 400 })
  }

  // The key is built entirely server-side from a random UUID and an extension looked up in
  // `ALLOWED_MIME_TYPES`; the client's own filename is validated but never used to name the object.
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
