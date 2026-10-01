import { type Readable } from "node:stream"

import { S3Client } from "@aws-sdk/client-s3"

import { env } from "@/lib/config/env"

import { resolveBucketNames, type StorageBucketName } from "./bucketNames"
import { buildStorageClientConfig } from "./clientConfig"
import { isMissingObjectError } from "./objectErrors"
import { createObjectStore } from "./objectStore"

// The only runtime client, on the internal endpoint. Object storage is never reached by a browser:
// uploads arrive through `app/api/upload/[type]/route.ts` and public reads leave through
// `app/api/storage/[...key]/route.ts`, so the store needs no public address and publishes no port
// (ADR-0040).
export const storage = createObjectStore({
  client: new S3Client(
    buildStorageClientConfig({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: env.S3_FORCE_PATH_STYLE
    })
  ),
  bucketNames: resolveBucketNames(env.S3_BUCKET)
})

export async function deleteStorageObject(objectKey: string): Promise<void> {
  await storage.deleteObject("public", objectKey)
}

// Defaults to the public bucket so every existing caller keeps its meaning: every `uploads` row that
// predates generated PDFs is an avatar or a template image, which is exactly what the column's own
// default encodes. A caller reading a document PDF has to say so.
export async function getStorageObjectBytes(
  objectKey: string,
  bucket: StorageBucketName = "public"
): Promise<Buffer> {
  const object = await storage.getObject(bucket, objectKey)

  return Buffer.from(await object.body.transformToByteArray())
}

export type PutUploadedObjectInput = {
  bucket: StorageBucketName
  objectKey: string
  body: Readable
  contentLength: number
  contentType: string
}

export async function putUploadedObject(input: PutUploadedObjectInput): Promise<void> {
  // Created lazily rather than in `instrumentation.ts`, like the exports bucket: the worker is a
  // separate process that never runs the Next.js instrumentation hook, and the upload route streams
  // attachments straight into this bucket, so it may be the first writer an instance ever has.
  if (input.bucket === "documents") await storage.ensureBucket("documents")

  await storage.putObject({
    role: input.bucket,
    key: input.objectKey,
    body: input.body,
    contentLength: input.contentLength,
    contentType: input.contentType
  })
}

export type PublicObjectStream = {
  body: ReadableStream<Uint8Array>
  contentLength: number | null
  contentType: string | null
}

// Public bucket only, and there is no parameter to choose another: this is what the anonymous
// storage route reads through, so the documents and exports buckets are unreachable from it by
// construction rather than by a check someone has to remember.
export async function getPublicObjectStream(objectKey: string): Promise<PublicObjectStream | null> {
  try {
    const object = await storage.getObject("public", objectKey)

    return {
      body: object.body.transformToWebStream(),
      contentLength: object.contentLength,
      contentType: object.contentType
    }
  } catch (error) {
    if (isMissingObjectError(error)) return null

    throw error
  }
}

export type PutDocumentObjectInput = {
  objectKey: string
  body: Buffer
  contentType: string
}

export async function putDocumentObject(input: PutDocumentObjectInput): Promise<void> {
  await storage.ensureBucket("documents")

  await storage.putObject({
    role: "documents",
    key: input.objectKey,
    body: input.body,
    contentLength: input.body.length,
    contentType: input.contentType
  })
}

// The counterpart to `putDocumentObject` for objects a user removes rather than a job writes. Only
// attachments use it: a rendered invoice or contract PDF is the snapshot of what a client already
// holds and is never deleted (`database/schema/invoices.ts`), whereas an attachment is a file the
// owner put there and can take back.
export async function deleteDocumentObject(objectKey: string): Promise<void> {
  await storage.deleteObject("documents", objectKey)
}

export type ExportObjectStream = {
  body: ReadableStream<Uint8Array>
  contentLength: number | null
}

export async function getDocumentObjectStream(objectKey: string): Promise<ExportObjectStream> {
  const object = await storage.getObject("documents", objectKey)

  return { body: object.body.transformToWebStream(), contentLength: object.contentLength }
}

export async function getExportObjectStream(objectKey: string): Promise<ExportObjectStream> {
  const object = await storage.getObject("exports", objectKey)

  return { body: object.body.transformToWebStream(), contentLength: object.contentLength }
}

export type PutExportObjectInput = {
  objectKey: string
  body: Readable
  contentLength: number
  contentType: string
}

export async function putExportObject(input: PutExportObjectInput): Promise<void> {
  // Ensured by the export job rather than from `instrumentation.ts`: the worker never runs the
  // Next.js instrumentation hook, and it is the only writer of this bucket.
  await storage.ensureBucket("exports")

  await storage.putObject({
    role: "exports",
    key: input.objectKey,
    body: input.body,
    contentLength: input.contentLength,
    contentType: input.contentType
  })
}

export async function deleteExportObject(objectKey: string): Promise<void> {
  await storage.deleteObject("exports", objectKey)
}

export async function ensureBucket(): Promise<void> {
  await storage.ensureBucket("public")
}
