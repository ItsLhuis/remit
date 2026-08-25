import { createHash } from "node:crypto"

import { type S3ServiceException } from "@aws-sdk/client-s3"

import { getStorageObjectBytes, type StorageBucketName } from "@/lib/storage/s3"

export type VerifiedUploadObject = {
  sizeBytes: number
  checksumSha256: string
}

export type VerifyUploadedObjectInput = {
  objectKey: string
  bucket: StorageBucketName
  maxBytes: number
}

// The gate between "a presigned PUT was issued" and "a row may name this object". Every confirm path
// runs it before inserting into `uploads`, because until it does, nothing in the system has checked
// that the upload actually happened: the presign route signs a URL and returns, and the client is
// then trusted to report its own filename, type and size. A signed URL is not proof of an upload,
// and a client's `sizeBytes` is not proof of a size.
//
// It reads the object once and answers three questions together — does it exist, how many bytes are
// really there, and what do they hash to. A `HEAD` would answer the first two more cheaply, but the
// checksum needs the bytes anyway, so one GET is fewer round trips than HEAD-then-GET. The read is
// bounded by the per-type ceiling the presign route already enforced, so it opens no new exposure.
//
// Returns null when the object is missing or larger than the caller's ceiling: both mean the client
// is describing something other than what is in the store, which is a rejection rather than a
// failure. Any other storage error throws, so an outage reaches the caller's own catch and is logged
// and reported as a server problem instead of being blamed on the file.
export async function verifyUploadedObject(
  input: VerifyUploadedObjectInput
): Promise<VerifiedUploadObject | null> {
  let bytes: Buffer

  try {
    bytes = await getStorageObjectBytes(input.objectKey, input.bucket)
  } catch (error) {
    if (isMissingObjectError(error)) return null

    throw error
  }

  if (bytes.byteLength === 0 || bytes.byteLength > input.maxBytes) return null

  return {
    // The stored size is the one measured here, never the one the client claimed, so the row and the
    // object can never disagree about how large the file is.
    sizeBytes: bytes.byteLength,
    checksumSha256: createHash("sha256").update(bytes).digest("hex")
  }
}

// 403 counts as missing, not as a permissions bug: S3 and MinIO answer a GET for a key that does not
// exist with AccessDenied rather than NoSuchKey whenever the caller lacks `s3:ListBucket` on the
// bucket, which Remit's credentials deliberately do not grant broadly.
function isMissingObjectError(error: unknown): boolean {
  const status = (error as S3ServiceException | undefined)?.$metadata?.httpStatusCode

  return status === 404 || status === 403
}
