import { headers } from "next/headers"

import { type NextRequest, NextResponse } from "next/server"

import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import { z } from "zod"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"

import { MINIO_BUCKET, s3 } from "@/lib/storage/s3"

const ALLOWED_LOGO_MIME_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"]
])

const uploadRequestSchema = z.object({
  filename: z.string().trim().min(1, t("settings.business.validation.logoFilenameRequired")),
  contentType: z.string().trim().min(1, t("settings.business.validation.logoContentTypeRequired")),
  sizeBytes: z
    .number()
    .int(t("settings.business.validation.logoSizeInvalid"))
    .positive(t("settings.business.validation.logoSizeInvalid"))
    .max(5 * 1024 * 1024, t("settings.business.validation.logoTooLarge"))
})

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    return NextResponse.json({ error: t("errors.unauthorized") }, { status: 401 })
  }

  const parsed = uploadRequestSchema.safeParse(await request.json())

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const extension = ALLOWED_LOGO_MIME_TYPES.get(parsed.data.contentType)

  if (!extension) {
    return NextResponse.json({ error: t("settings.business.invalidLogoFileType") }, { status: 400 })
  }

  const objectKey = `business-logos/${Date.now()}.${extension}`

  const command = new PutObjectCommand({
    Bucket: MINIO_BUCKET,
    Key: objectKey,
    ContentType: parsed.data.contentType
  })

  try {
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 })

    return NextResponse.json({ uploadUrl, objectKey })
  } catch {
    return NextResponse.json({ error: t("settings.business.uploadUrlFailed") }, { status: 500 })
  }
}
