import { type BackupDestination } from "@/lib/backups/destinationConfig"

export type BackupCredentialField = "bucket" | "region" | "endpoint" | "accessKey" | "secretKey"

export type BackupCredentialInput = {
  bucket: string
  region: string
  endpoint: string
  accessKeyConfigured: boolean
  secretKeyConfigured: boolean
}

// The union itself belongs to the storage adapter in lib/backups/destinationConfig.ts and is
// imported above; only the runtime list is restated here, because a type guard needs values and
// that module exports none. The annotation is what keeps the two in step.
const BACKUP_DESTINATIONS: readonly BackupDestination[] = ["local", "s3", "r2", "b2"]

export function isBackupDestination(value: string): value is BackupDestination {
  return (BACKUP_DESTINATIONS as readonly string[]).includes(value)
}

export function requiresBackupCredentials(destination: BackupDestination): boolean {
  return destination !== "local"
}

// The field-level twin of `validateBackupCredentials` in lib/backups/destinationConfig.ts, which is
// what the backup command itself runs: that function reports one reason for the whole destination,
// and a form needs to know which box to put the message on. The two must agree, and
// __tests__/destinationRequirements.test.ts is what holds them together — a destination that this
// says is complete and the command then refuses is a configuration the operator saved believing it
// worked.
export function getMissingBackupCredentialFields(
  destination: BackupDestination,
  credentials: BackupCredentialInput
): BackupCredentialField[] {
  if (!requiresBackupCredentials(destination)) return []

  const missing: BackupCredentialField[] = []

  if (!credentials.bucket.trim()) missing.push("bucket")
  if (!credentials.region.trim()) missing.push("region")
  if (!credentials.accessKeyConfigured) missing.push("accessKey")
  if (!credentials.secretKeyConfigured) missing.push("secretKey")

  // R2 is the one destination whose endpoint is not derivable from a region name: the adapter builds
  // `https://<region>.r2.cloudflarestorage.com` only when `region` is carrying a Cloudflare account
  // identifier instead of a region, and has nowhere to send the request otherwise. S3 defaults to
  // AWS and B2 derives its endpoint from the region, so for those the field stays optional and
  // carries a custom endpoint such as MinIO.
  if (
    destination === "r2" &&
    !credentials.endpoint.trim() &&
    !isR2AccountIdentifier(credentials.region)
  ) {
    missing.push("endpoint")
  }

  return missing
}

function isR2AccountIdentifier(value: string): boolean {
  return /^[a-z0-9]{16,64}$/i.test(value.trim())
}
