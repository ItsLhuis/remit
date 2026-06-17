import {
  ARCHIVE_FORMAT_VERSION,
  ENCRYPTION_ALGORITHM_NAME,
  computeKeyFingerprint
} from "../archive/header"
import type { BackupDestination } from "../destination"
import { sha256Hex } from "../utils/hash"

export { sha256Hex }

export type BackupComponentDescriptor = {
  database: { size: number; sha256: string }
  uploads: { fileCount: number; totalSize: number }
}

export type BackupManifestInput = {
  appVersion: string
  checksumsSha256: string
  components: BackupComponentDescriptor
  createdAt: string
  destination: BackupDestination
  encryptionKey: Buffer
  schemaMigrationId: string
}

export type BackupManifest = {
  archiveFormatVersion: 1
  appVersion: string
  createdAt: string
  createdBy: "remit:backup"
  schemaMigrationId: string
  encryption: {
    algorithm: typeof ENCRYPTION_ALGORITHM_NAME
    keySource: "REMIT_ENCRYPTION_KEY"
    keyFingerprint: string
  }
  compression: "gzip"
  components: {
    database: { format: "pg_dump-custom"; size: number; sha256: string }
    uploads: { format: "tar-stream"; fileCount: number; totalSize: number; sha256Manifest: string }
  }
  destination: BackupDestination
}

export function buildBackupManifest(input: BackupManifestInput): BackupManifest {
  return {
    archiveFormatVersion: ARCHIVE_FORMAT_VERSION,
    appVersion: input.appVersion,
    createdAt: input.createdAt,
    createdBy: "remit:backup",
    schemaMigrationId: input.schemaMigrationId,
    encryption: {
      algorithm: ENCRYPTION_ALGORITHM_NAME,
      keySource: "REMIT_ENCRYPTION_KEY",
      keyFingerprint: `sha256:${computeKeyFingerprint(input.encryptionKey)}`
    },
    compression: "gzip",
    components: {
      database: {
        format: "pg_dump-custom",
        size: input.components.database.size,
        sha256: input.components.database.sha256
      },
      uploads: {
        format: "tar-stream",
        fileCount: input.components.uploads.fileCount,
        totalSize: input.components.uploads.totalSize,
        sha256Manifest: input.checksumsSha256
      }
    },
    destination: input.destination
  }
}

export function serializeBackupManifest(manifest: BackupManifest): Buffer {
  return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8")
}
