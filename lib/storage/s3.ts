import { type Readable } from "node:stream"

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
  type S3ServiceException
} from "@aws-sdk/client-s3"

import { env } from "@/lib/config/env"

const s3 = new S3Client({
  endpoint: env.MINIO_ENDPOINT,
  region: "us-east-1",
  credentials: {
    accessKeyId: env.MINIO_ROOT_USER,
    secretAccessKey: env.MINIO_ROOT_PASSWORD
  },
  forcePathStyle: true
})

// A second client on the browser-reachable URL, not a duplicate to be collapsed into `s3` above:
// a presigned URL's signature covers its host, so one signed against the internal MINIO_ENDPOINT
// is rejected when the browser replays it against the public origin. Server-side calls use `s3`;
// anything handed to a client must be signed with this one.
export const s3UploadPresigner = new S3Client({
  endpoint: env.MINIO_PUBLIC_URL,
  region: "us-east-1",
  credentials: {
    accessKeyId: env.MINIO_ROOT_USER,
    secretAccessKey: env.MINIO_ROOT_PASSWORD
  },
  forcePathStyle: true
})

export const MINIO_BUCKET = env.MINIO_BUCKET

// A second bucket, derived from the first so an operator configures nothing new, and deliberately
// never given the anonymous read policy `ensureBucket` puts on `MINIO_BUCKET`. Data exports are the
// whole instance in one file; keeping them out of the public bucket means an unguessable key is not
// the only thing between an export and the internet, and the credentialed reads below are the only
// way out — through the owner-gated download route.
export const MINIO_EXPORTS_BUCKET = `${env.MINIO_BUCKET}-exports`

export async function deleteStorageObject(objectKey: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: MINIO_BUCKET, Key: objectKey }))
}

export async function getStorageObjectBytes(objectKey: string): Promise<Buffer> {
  const object = await s3.send(new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: objectKey }))

  if (!object.Body) throw new Error(`Storage object has no body: ${objectKey}`)

  return Buffer.from(await object.Body.transformToByteArray())
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

export async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET }))
  } catch (error) {
    const serviceError = error as S3ServiceException

    if (serviceError.$metadata?.httpStatusCode !== 404) throw error

    await s3.send(new CreateBucketCommand({ Bucket: MINIO_BUCKET }))

    // Anonymous `s3:GetObject` on the whole bucket: every stored object is readable by anyone who
    // knows its key, so keys are the only thing standing between an upload and the public. Nothing
    // secret may be stored here under a guessable key, and access control for uploads has to be
    // enforced by key unguessability rather than by this bucket.
    await s3.send(
      new PutBucketPolicyCommand({
        Bucket: MINIO_BUCKET,
        Policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: "*",
              Action: "s3:GetObject",
              Resource: `arn:aws:s3:::${MINIO_BUCKET}/*`
            }
          ]
        })
      })
    )
  }
}
