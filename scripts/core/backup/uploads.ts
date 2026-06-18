import { type LocalStorageObject } from "@/lib/storage/local"

import { mapWithConcurrency } from "../utils/concurrency"
import { hashFile } from "../utils/hash"

// Bound concurrency so instances with thousands of uploads do not open every file
// at once and exhaust file descriptors (EMFILE) while hashing.
const UPLOAD_HASH_CONCURRENCY = 8

export type UploadDescriptor = LocalStorageObject & {
  archivePath: string
  sha256: string
}

export async function describeUploads(
  uploads: readonly LocalStorageObject[]
): Promise<UploadDescriptor[]> {
  return await mapWithConcurrency(uploads, UPLOAD_HASH_CONCURRENCY, async (upload) => ({
    ...upload,
    archivePath: `uploads/${upload.key}`,
    sha256: await hashFile(upload.absolutePath)
  }))
}

export function buildChecksumsFile(
  databaseDump: { sha256: string },
  uploads: readonly UploadDescriptor[]
): string {
  return [
    `${databaseDump.sha256}  database/remit.dump`,
    ...uploads.map((upload) => `${upload.sha256}  ${upload.archivePath}`)
  ]
    .join("\n")
    .concat("\n")
}
