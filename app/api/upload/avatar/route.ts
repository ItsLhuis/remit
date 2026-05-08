import { headers } from "next/headers"

import { type NextRequest, NextResponse } from "next/server"

import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"

import { MINIO_BUCKET, s3 } from "@/lib/s3"

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    return NextResponse.json({ error: t("settings.profile.errors.unauthorized") }, { status: 401 })
  }

  const body: unknown = await request.json()

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).filename !== "string" ||
    typeof (body as Record<string, unknown>).contentType !== "string"
  ) {
    return NextResponse.json({ error: t("errors.invalidRequestBody") }, { status: 400 })
  }

  const { filename, contentType } = body as { filename: string; contentType: string }

  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    return NextResponse.json(
      { error: t("settings.profile.invalidAvatarFileType") },
      { status: 400 }
    )
  }

  const extension = filename.split(".").pop() ?? "jpg"
  const objectKey = `avatars/${session.user.id}/${Date.now()}.${extension}`

  const command = new PutObjectCommand({
    Bucket: MINIO_BUCKET,
    Key: objectKey,
    ContentType: contentType
  })

  try {
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 })

    return NextResponse.json({ uploadUrl, objectKey })
  } catch {
    return NextResponse.json({ error: t("settings.profile.uploadUrlFailed") }, { status: 500 })
  }
}
