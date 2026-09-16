import { type Readable } from "node:stream"

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  type S3ServiceException
} from "@aws-sdk/client-s3"

import { env } from "@/lib/config/env"

import { isMissingObjectError } from "./objectErrors"

// The only client, on the internal endpoint. Object storage is never reached by a browser: uploads
// arrive through `app/api/upload/[type]/route.ts` and public reads leave through
// `app/api/storage/[...key]/route.ts`, so the store needs no public address and publishes no port
// (ADR-0040).
const s3 = new S3Client({
  endpoint: env.MINIO_ENDPOINT,
  region: "us-east-1",
  credentials: {
    accessKeyId: env.MINIO_ROOT_USER,
    secretAccessKey: env.MINIO_ROOT_PASSWORD
  },
  forcePathStyle: true
})

export const MINIO_BUCKET = env.MINIO_BUCKET

// A second bucket, derived from the first so an operator configures nothing new, and deliberately
// never served by the public storage route. Data exports are the whole instance in one file; keeping
// them out of the public bucket means an unguessable key is not the only thing between an export and
// the internet, and the credentialed reads below are the only way out — through the owner-gated
// download route.
export const MINIO_EXPORTS_BUCKET = `${env.MINIO_BUCKET}-exports`

// A third bucket, derived the same way and kept away from the public storage route for the same
// reason as the exports one. Generated document PDFs land here (ADR-0022): an invoice, a proposal and
// an executed contract are money and legal documents, and the public bucket's guarantee — "any object
// is readable by anyone holding its key" — is not an acceptable default for one. A client reaches
// their copy through the tokenized public route or an emailed attachment; the owner reaches it
// through a credentialed route. Neither hands out a storage URL.
//
// `database/schema/uploads.ts`'s `bucket` column is what tells a reader which of the two a given
// `uploads` row lives in.
export const MINIO_DOCUMENTS_BUCKET = `${env.MINIO_BUCKET}-documents`

const BUCKET_BY_NAME: Record<StorageBucketName, string> = {
  public: MINIO_BUCKET,
  documents: MINIO_DOCUMENTS_BUCKET
}

export type StorageBucketName = "public" | "documents"

export async function deleteStorageObject(objectKey: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: MINIO_BUCKET, Key: objectKey }))
}

// Defaults to the public bucket so every existing caller keeps its meaning: every `uploads` row that
// predates generated PDFs is an avatar or a template image, which is exactly what the column's own
// default encodes. A caller reading a document PDF has to say so.
export async function getStorageObjectBytes(
  objectKey: string,
  bucket: StorageBucketName = "public"
): Promise<Buffer> {
  const object = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET_BY_NAME[bucket], Key: objectKey })
  )

  if (!object.Body) throw new Error(`Storage object has no body: ${objectKey}`)

  return Buffer.from(await object.Body.transformToByteArray())
}

export type PutUploadedObjectInput = {
  bucket: StorageBucketName
  objectKey: string
  body: Readable
  contentLength: number
  contentType: string
}

export async function putUploadedObject(input: PutUploadedObjectInput): Promise<void> {
  if (input.bucket === "documents") await ensureDocumentsBucket()

  // `ContentLength` is what bounds the write: the SDK sends exactly that many bytes and the store
  // refuses a body that ends short, so an object can never be larger than the size the upload route
  // already checked against its ceiling.
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_BY_NAME[input.bucket],
      Key: input.objectKey,
      Body: input.body,
      ContentLength: input.contentLength,
      ContentType: input.contentType
    })
  )
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
    const object = await s3.send(new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: objectKey }))

    if (!object.Body) return null

    return {
      body: object.Body.transformToWebStream(),
      contentLength: object.ContentLength ?? null,
      contentType: object.ContentType ?? null
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
  await ensureDocumentsBucket()

  await s3.send(
    new PutObjectCommand({
      Bucket: MINIO_DOCUMENTS_BUCKET,
      Key: input.objectKey,
      Body: input.body,
      ContentLength: input.body.length,
      ContentType: input.contentType
    })
  )
}

// The counterpart to `putDocumentObject` for objects a user removes rather than a job writes. Only
// attachments use it: a rendered invoice or contract PDF is the snapshot of what a client already
// holds and is never deleted (`database/schema/invoices.ts`), whereas an attachment is a file the
// owner put there and can take back.
export async function deleteDocumentObject(objectKey: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: MINIO_DOCUMENTS_BUCKET, Key: objectKey }))
}

export async function getDocumentObjectStream(objectKey: string): Promise<ExportObjectStream> {
  const object = await s3.send(
    new GetObjectCommand({ Bucket: MINIO_DOCUMENTS_BUCKET, Key: objectKey })
  )

  if (!object.Body) throw new Error(`Document object has no body: ${objectKey}`)

  return {
    body: object.Body.transformToWebStream(),
    contentLength: object.ContentLength ?? null
  }
}

export type ExportObjectStream = {
  body: ReadableStream<Uint8Array>
  contentLength: number | null
}

export async function getExportObjectStream(objectKey: string): Promise<ExportObjectStream> {
  const object = await s3.send(
    new GetObjectCommand({ Bucket: MINIO_EXPORTS_BUCKET, Key: objectKey })
  )

  if (!object.Body) throw new Error(`Export object has no body: ${objectKey}`)

  return {
    body: object.Body.transformToWebStream(),
    contentLength: object.ContentLength ?? null
  }
}

export type PutExportObjectInput = {
  objectKey: string
  body: Readable
  contentLength: number
  contentType: string
}

export async function putExportObject(input: PutExportObjectInput): Promise<void> {
  await ensureExportsBucket()

  // `ContentLength` is mandatory for a stream body: without it the SDK buffers the whole archive in
  // memory to measure it, which is exactly what writing the zip to a temp file first avoids.
  await s3.send(
    new PutObjectCommand({
      Bucket: MINIO_EXPORTS_BUCKET,
      Key: input.objectKey,
      Body: input.body,
      ContentLength: input.contentLength,
      ContentType: input.contentType
    })
  )
}

export async function deleteExportObject(objectKey: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: MINIO_EXPORTS_BUCKET, Key: objectKey }))
}

// No bucket policy, and none may be added: nothing reads the store anonymously, and the public
// bucket's openness is enforced by `app/api/storage/[...key]/route.ts` instead. A policy granting
// anonymous `s3:GetObject` would reopen a second, unaudited path to every object the moment anyone
// published the store's port.
export async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET }))
  } catch (error) {
    const serviceError = error as S3ServiceException

    if (serviceError.$metadata?.httpStatusCode !== 404) throw error

    await s3.send(new CreateBucketCommand({ Bucket: MINIO_BUCKET }))
  }
}

// Created lazily rather than in `instrumentation.ts`, for the same reason `ensureExportsBucket` is:
// the worker is a separate process that never runs the Next.js instrumentation hook. The upload
// route streams attachments straight into this bucket, so it may be the first writer an instance
// ever has.
async function ensureDocumentsBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: MINIO_DOCUMENTS_BUCKET }))
  } catch (error) {
    const serviceError = error as S3ServiceException

    if (serviceError.$metadata?.httpStatusCode !== 404) throw error

    await s3.send(new CreateBucketCommand({ Bucket: MINIO_DOCUMENTS_BUCKET }))
  }
}

// Called by the export job rather than from `instrumentation.ts`: the worker is a separate process
// that never runs the Next.js instrumentation hook, and it is the only writer of this bucket.
async function ensureExportsBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: MINIO_EXPORTS_BUCKET }))
  } catch (error) {
    const serviceError = error as S3ServiceException

    if (serviceError.$metadata?.httpStatusCode !== 404) throw error

    await s3.send(new CreateBucketCommand({ Bucket: MINIO_EXPORTS_BUCKET }))
  }
}
