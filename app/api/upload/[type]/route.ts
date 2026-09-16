import { headers } from "next/headers"

import { type NextRequest, NextResponse } from "next/server"

import { randomUUID } from "node:crypto"
import { Readable } from "node:stream"
import { type ReadableStream as NodeReadableStream } from "node:stream/web"

import { z } from "zod"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"

import { logger } from "@/lib/logger"

import { applySecurityHeaders } from "@/lib/securityHeaders"
import { IMAGE_UPLOAD_MAX_BYTES, type IMAGE_UPLOAD_MIME_TYPES } from "@/lib/storage"
import { putUploadedObject, type StorageBucketName } from "@/lib/storage/s3"

// Built from `lib/storage/limits.ts` rather than restated: unlike the expense constants below, that
// module is not a feature — it pulls in nothing but the numbers themselves — so the client's
// pre-check, this route, and the confirm mutation's server-side verification all read one source.
// The extension map is local because only this route names objects.
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
// expense's own validation rejects what this route just stored.
const RECEIPT_KEY_PREFIX = "expenses/"

const RECEIPT_MAX_BYTES = 10 * 1024 * 1024

// Restated here for the same reason as the receipt constants directly above, and pairing with
// `features/attachments/schemas.ts`'s `ATTACHMENT_KEY_PREFIX`, `ATTACHMENT_MIME_TYPES` and
// `ATTACHMENT_MAX_BYTES`. `addAttachment` refuses any key outside this prefix, so storing one the
// feature would reject fails at the mutation instead of silently leaving an unreferenced object.
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
  contentTypeRequired: string
  sizeInvalid: string
  tooLarge: string
  maxBytes: number
}) {
  return z.object({
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
  // Which store the file lands in, and therefore who can read the result. `public` is the bucket
  // `app/api/storage/[...key]/route.ts` serves anonymously, where an unguessable key is the whole
  // access control — correct for an avatar or a template image, which `resolveStorageUrl` renders
  // in the browser. An attachment is a client's NDA or a project brief, so it lands in the private
  // `documents` bucket and is served only through the credentialed `app/api/attachments/[id]` route.
  bucket: StorageBucketName
  objectKey: (input: { ext: string; userId?: string }) => string
}

function getUploadConfig(type: string): UploadConfig | null {
  switch (type) {
    case "avatar":
      return {
        schema: buildUploadSchema({
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

// The file is the request body, described by its own `Content-Type` and `Content-Length`, and is
// streamed into the store without being buffered. `proxy.ts`'s matcher leaves this route out for
// exactly that reason: a request the proxy handles has its body cloned into memory and cut off at
// ten megabytes, which an attachment exceeds.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
): Promise<Response> {
  const { type } = await params

  const config = getUploadConfig(type)

  if (!config) return respond({ error: t("errors.notFound") }, 404)

  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) return respond({ error: t("errors.unauthorized") }, 401)

  // The declared length is trusted only as far as it can be: the ceiling is checked against it here,
  // and `putUploadedObject` writes exactly that many bytes, so a body that runs longer is never stored
  // and one that ends short fails the write.
  const parsed = config.schema.safeParse({
    contentType: (request.headers.get("content-type") ?? "").split(";")[0],
    sizeBytes: Number(request.headers.get("content-length") ?? "")
  })

  if (!parsed.success) return respond({ error: parsed.error.issues[0].message }, 400)

  const extension = config.mimeTypes.get(parsed.data.contentType)

  if (!extension) return respond({ error: config.invalidTypeError }, 400)

  if (!request.body) return respond({ error: config.uploadFailedError }, 400)

  // The key is built entirely server-side from a random UUID and an extension looked up in the route
  // variant's `mimeTypes`. That matters twice over: it keeps a caller from writing outside its prefix
  // or overwriting another object by path, and the public bucket is served anonymously by
  // `app/api/storage/[...key]/route.ts`, so an unguessable key is the only thing keeping one
  // instance's uploads from being enumerable.
  const objectKey = config.objectKey({ userId: session.user.id, ext: extension })

  try {
    await putUploadedObject({
      bucket: config.bucket,
      objectKey,
      body: Readable.fromWeb(request.body as NodeReadableStream<Uint8Array>),
      contentLength: parsed.data.sizeBytes,
      contentType: parsed.data.contentType
    })
  } catch (error) {
    logger.error(
      { action: "api.upload.POST", type, userId: session.user.id, objectKey, err: error },
      "Upload could not be stored"
    )

    return respond({ error: config.uploadFailedError }, 500)
  }

  return respond({ objectKey }, 200)
}

function respond(body: Record<string, string>, status: number): NextResponse {
  return applySecurityHeaders(NextResponse.json(body, { status }), false)
}
