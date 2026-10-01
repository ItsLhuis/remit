import { z } from "zod"

import { compareSemver } from "../utils/semver"

import { RestoreCliError } from "./errors"

const HEX_64 = /^[a-f0-9]{64}$/
const MANIFEST_FINGERPRINT = /^sha256:[a-f0-9]{32}$/
const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/

// Every version a release has written; restore reads them all
// (docs/architecture/specs/BACKUP-ARCHIVE.md, "Forward compatibility").
export const SUPPORTED_ARCHIVE_VERSIONS = [2] as const
export type SupportedArchiveVersion = (typeof SUPPORTED_ARCHIVE_VERSIONS)[number]

const manifestFields = {
  appVersion: z.string().regex(SEMVER),
  createdAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  createdBy: z.literal("remit:backup"),
  schemaMigrationId: z.string().min(1),
  encryption: z.strictObject({
    algorithm: z.literal("AES-256-GCM"),
    keySource: z.literal("REMIT_ENCRYPTION_KEY"),
    keyFingerprint: z.string().regex(MANIFEST_FINGERPRINT)
  }),
  compression: z.literal("gzip"),
  destination: z.enum(["local", "s3", "r2", "b2"])
}

const databaseComponent = z.strictObject({
  format: z.literal("pg_dump-custom"),
  size: z.number().int().nonnegative(),
  sha256: z.string().regex(HEX_64)
})

const bucketTotals = z.strictObject({
  fileCount: z.number().int().nonnegative(),
  totalSize: z.number().int().nonnegative()
})

// Version 2: the database and every object of the public and documents buckets (ADR-0046).
export const restoreManifestSchema = z.strictObject({
  archiveFormatVersion: z.literal(2),
  ...manifestFields,
  components: z.strictObject({
    database: databaseComponent,
    objects: z.strictObject({
      format: z.literal("tar-stream"),
      sha256Manifest: z.string().regex(HEX_64),
      buckets: z.strictObject({ public: bucketTotals, documents: bucketTotals }),
      contentTypes: z.record(z.string(), z.string().min(1).max(255))
    })
  })
})

export type RestoreManifest = z.infer<typeof restoreManifestSchema>

export function isArchiveAppVersionNewer(archiveVersion: string, currentVersion: string): boolean {
  return compareSemver(archiveVersion, currentVersion) > 0
}

export function assertArchiveAppVersionAllowed(
  manifest: RestoreManifest,
  currentAppVersion: string
): void {
  if (isArchiveAppVersionNewer(manifest.appVersion, currentAppVersion)) {
    throw new RestoreCliError(
      `Refusing restore: archive was created by app version ${manifest.appVersion}; upgrade the running build to >= ${manifest.appVersion} before restoring.`,
      "archive-app-version-newer"
    )
  }
}
