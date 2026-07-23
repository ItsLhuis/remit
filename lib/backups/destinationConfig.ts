import { type Readable } from "node:stream"

import { type S3ClientConfig } from "@aws-sdk/client-s3"

export type BackupDestination = "local" | "s3" | "r2" | "b2"

export type BackupCredentials = {
  accessKey: string | null
  bucket: string | null
  endpoint: string | null
  forcePathStyle?: boolean
  localDirectory?: string
  region: string | null
  secretKey: string | null
}

export type BackupDestinationAdapter = {
  put: (key: string, body: Readable, sizeHint: number) => Promise<{ key: string }>
  list: (prefix: string) => Promise<Array<{ key: string; createdAt: Date; size: number }>>
  delete: (key: string) => Promise<void>
  get: (key: string) => Promise<Readable>
}

export type BackupCredentialValidationResult = { ok: true } | { ok: false; reason: string }

export type CompleteBackupCredentials = BackupCredentials & {
  accessKey: string
  bucket: string
  region: string
  secretKey: string
}

export function validateBackupCredentials(
  destination: BackupDestination,
  credentials: BackupCredentials
): BackupCredentialValidationResult {
  if (destination === "local") {
    return { ok: true }
  }

  if (!credentials.bucket?.trim()) {
    return {
      ok: false,
      reason: "Set backup credentials in /settings/backup, including a bucket name."
    }
  }

  if (!credentials.region?.trim()) {
    return {
      ok: false,
      reason: "Set backup credentials in /settings/backup, including a region."
    }
  }

  if (!credentials.accessKey?.trim() || !credentials.secretKey?.trim()) {
    return {
      ok: false,
      reason: "Set backup credentials in /settings/backup, including an access key and secret key."
    }
  }

  if (
    destination === "r2" &&
    !credentials.endpoint?.trim() &&
    !isR2AccountIdentifier(credentials.region)
  ) {
    return {
      ok: false,
      reason: "Set backup credentials in /settings/backup, including the Cloudflare R2 endpoint."
    }
  }

  return { ok: true }
}

export function buildS3ClientConfig(
  destination: Exclude<BackupDestination, "local">,
  credentials: CompleteBackupCredentials
): S3ClientConfig {
  const endpoint = resolveBackupEndpoint(destination, credentials)

  return {
    credentials: {
      accessKeyId: credentials.accessKey,
      secretAccessKey: credentials.secretKey
    },
    endpoint: endpoint ?? undefined,
    forcePathStyle:
      credentials.forcePathStyle ??
      (destination === "r2" || destination === "b2" || Boolean(endpoint)),
    region: resolveBackupRegion(destination, credentials),
    // "WHEN_REQUIRED" rather than the SDK's default: newer AWS SDK releases attach CRC32 checksum
    // headers to every request, which the non-AWS S3-compatible destinations here (R2, B2) reject.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED"
  }
}

export function resolveBackupEndpoint(
  destination: Exclude<BackupDestination, "local">,
  credentials: Pick<CompleteBackupCredentials, "endpoint" | "region">
): string | null {
  const endpoint = credentials.endpoint?.trim()

  if (endpoint) return endpoint

  if (destination === "r2") {
    return `https://${credentials.region}.r2.cloudflarestorage.com`
  }

  if (destination === "b2") {
    return `https://s3.${credentials.region}.backblazeb2.com`
  }

  return null
}

function resolveBackupRegion(
  destination: Exclude<BackupDestination, "local">,
  credentials: Pick<CompleteBackupCredentials, "endpoint" | "region">
): string {
  // R2 has no regions and requires the literal region "auto". When no endpoint was given the
  // `region` field is carrying the Cloudflare account identifier instead (see
  // `resolveBackupEndpoint`), so it must not be passed through as a region as well.
  if (destination === "r2" && !credentials.endpoint?.trim()) {
    return "auto"
  }

  return credentials.region
}

function isR2AccountIdentifier(value: string): boolean {
  return /^[a-z0-9]{16,64}$/i.test(value)
}
