import { type S3ClientConfig } from "@aws-sdk/client-s3"

export type StorageConnection = {
  endpoint: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle: boolean
}

// Every client Remit builds for object storage is configured here, so none can drift into the SDK's
// defaults.
export function buildStorageClientConfig(connection: StorageConnection): S3ClientConfig {
  return {
    endpoint: connection.endpoint,
    region: connection.region,
    // Explicit, always: left out, the SDK would fall back to its default credential chain and read
    // `AWS_*` variables or an instance profile from the environment on its own (ADR-0045).
    credentials: {
      accessKeyId: connection.accessKeyId,
      secretAccessKey: connection.secretAccessKey
    },
    forcePathStyle: connection.forcePathStyle,
    // `WHEN_REQUIRED` rather than the SDK's default, which sends CRC32 checksums in `aws-chunked`
    // trailers that Cloudflare R2 has handled inconsistently and Backblaze B2 accepted only from
    // mid-2025; this is the one setting the bundled store and every supported provider accept.
    // Integrity does not rest on it: an upload is read back and hashed before a row may name it
    // (`verifyUploadedObject.ts`), and backup and restore verify every object by SHA-256.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED"
  }
}
