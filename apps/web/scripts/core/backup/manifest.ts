import { type StorageBucketName } from "@/lib/storage/bucketNames"

import {
  ARCHIVE_FORMAT_VERSION,
  ENCRYPTION_ALGORITHM_NAME,
  computeKeyFingerprint
} from "../archive/header"
import { type BackupDestination } from "../destination"
import { sha256Hex } from "../utils/hash"

import { type ObjectBucketTotals } from "./objectPlan"

export { sha256Hex }

export type BackupComponentDescriptor = {
  database: { size: number; sha256: string }
  objects: {
    buckets: Record<StorageBucketName, ObjectBucketTotals>
    // Each archived object's content type, keyed by its archive path. The store served it with that
    // type, and a restore has to put it back with it: an image returned as octet-stream under
    // `nosniff` would never render.
    contentTypes: Record<string, string>
  }
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
  archiveFormatVersion: typeof ARCHIVE_FORMAT_VERSION
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
    objects: {
      format: "tar-stream"
      sha256Manifest: string
      buckets: Record<StorageBucketName, ObjectBucketTotals>
      contentTypes: Record<string, string>
    }
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
      objects: {
        format: "tar-stream",
        sha256Manifest: input.checksumsSha256,
        buckets: input.components.objects.buckets,
        contentTypes: input.components.objects.contentTypes
      }
    },
    destination: input.destination
  }
}

export function serializeBackupManifest(manifest: BackupManifest): Buffer {
  return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8")
}
