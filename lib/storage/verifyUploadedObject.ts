import { createHash } from "node:crypto"

import { getStorageObjectBytes, type StorageBucketName } from "@/lib/storage/s3"

import { isMissingObjectError } from "./objectErrors"

export type VerifiedUploadObject = {
  sizeBytes: number
  checksumSha256: string
}

export type VerifyUploadedObjectInput = {
  objectKey: string
  bucket: StorageBucketName
  maxBytes: number
}

// The gate between "the client says it uploaded this" and "a row may name this object". Every confirm
// path runs it before inserting into `uploads`, because the object key comes back from the client
// together with the client's own filename, type and size: nothing but this read stops a caller from
// naming a key it never uploaded, and a client's `sizeBytes` is not proof of a size.
//
// It reads the object once and answers three questions together — does it exist, how many bytes are
// really there, and what do they hash to. A `HEAD` would answer the first two more cheaply, but the
// checksum needs the bytes anyway, so one GET is fewer round trips than HEAD-then-GET. The read is
// bounded by the per-type ceiling the upload route already enforced, so it opens no new exposure.
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
