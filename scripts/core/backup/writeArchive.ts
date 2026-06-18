import { randomBytes, randomUUID } from "node:crypto"
import { createReadStream, createWriteStream } from "node:fs"
import { mkdir, rename, rm, stat } from "node:fs/promises"
import path from "node:path"
import { finished } from "node:stream/promises"
import { createGzip } from "node:zlib"

import { createLocalStorageReadStream } from "@/lib/storage/local"

import {
  ARCHIVE_HEADER_LENGTH,
  IV_LENGTH,
  computeKeyFingerprint,
  encryptStream,
  writeArchiveHeader
} from "../archive/header"
import { TarWriter } from "../archive/tar"
import { type BackupDestinationAdapter } from "../destination"

import { type DatabaseDumpDescriptor } from "./databaseDump"
import { REMOTE_BACKUP_PREFIX } from "./filename"
import { type BackupPlan } from "./plan"
import { computeRetentionDeletions } from "./retention"
import { type UploadDescriptor } from "./uploads"

export class BackupWriteError extends Error {}

export type WriteEncryptedTarInput = {
  checksums: Buffer
  databaseDump: DatabaseDumpDescriptor
  encryptionKey: Buffer
  manifest: Buffer
  outputPath: string
  uploads: readonly UploadDescriptor[]
}

export async function writeEncryptedTar(input: WriteEncryptedTarInput): Promise<void> {
  await mkdir(path.dirname(input.outputPath), { recursive: true })

  const tempOutputPath = `${input.outputPath}.${randomUUID()}.tmp`
  const iv = randomBytes(IV_LENGTH)
  const header = Buffer.alloc(ARCHIVE_HEADER_LENGTH)
  writeArchiveHeader(header, {
    iv,
    keyFingerprint: computeKeyFingerprint(input.encryptionKey)
  })

  const output = createWriteStream(tempOutputPath, { flags: "wx" })
  output.write(header)

  const gzip = createGzip()
  const encryption = encryptStream(input.encryptionKey, iv)
  gzip.pipe(encryption.stream).pipe(output, { end: false })

  const tar = new TarWriter(gzip)

  try {
    await tar.writeBufferEntry("manifest.json", input.manifest)
    await tar.writeBufferEntry("checksums.sha256", input.checksums)
    await tar.writeFileEntry(
      "database/remit.dump",
      input.databaseDump.size,
      createReadStream(input.databaseDump.path)
    )

    for (const upload of input.uploads) {
      await tar.writeFileEntry(
        upload.archivePath,
        upload.size,
        createLocalStorageReadStream(upload)
      )
    }

    await tar.finalize()
    await finished(encryption.stream)

    output.end(encryption.getAuthTag())

    await finished(output)
    await rm(input.outputPath, { force: true })
    await rename(tempOutputPath, input.outputPath)
  } catch (error) {
    gzip.destroy()
    encryption.stream.destroy()
    output.destroy()

    await rm(tempOutputPath, { force: true })
    throw error
  }
}

export async function enforceRemoteRetention(
  destinationAdapter: BackupDestinationAdapter,
  plan: BackupPlan
): Promise<void> {
  try {
    const existing = await destinationAdapter.list(REMOTE_BACKUP_PREFIX)
    const deletions = computeRetentionDeletions(existing, plan.retentionPolicy, new Date())

    for (const key of deletions) {
      // Never delete archive this run just uploaded, even when retention policy
      // would keep nothing (e.g. every tier set to 0). Discarding freshly written
      // backup while reporting success would be silent data loss.
      if (key === plan.objectKey) continue

      await destinationAdapter.delete(key)
    }
  } catch {
    console.warn("Backup retention cleanup failed; the uploaded archive remains available.")
  }
}

export async function uploadArchive(
  adapter: BackupDestinationAdapter,
  archivePath: string,
  objectKey: string
): Promise<void> {
  // Single PutObject caps the archive at the S3 5 GiB per-request limit; multipart
  // upload for larger instances is deferred.
  const archiveStats = await stat(archivePath)

  try {
    await adapter.put(objectKey, createReadStream(archivePath), archiveStats.size)
  } finally {
    await rm(archivePath, { force: true })
  }
}
