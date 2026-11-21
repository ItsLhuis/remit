import {
  validateBackupCredentials,
  type BackupCredentials,
  type BackupDestination
} from "@/lib/backups/destinationConfig"

type EmailHealthInput = {
  hasSettingsRow: boolean
  isConfigured: boolean
  hasSuccessfulTest: boolean
}

type StripeHealthInput = {
  hasSettingsRow: boolean
  isConfigured: boolean
  hasSuccessfulTest: boolean
}

type RemoteStorageConfigurationInput = BackupCredentials & { destination: BackupDestination }

type CompleteRemoteStorageConfiguration = {
  accessKey: string
  bucket: string
  destination: Exclude<BackupDestination, "local">
  endpoint: string | null
  region: string
  secretKey: string
}

type BackupFreshnessInput = {
  lastSuccessAt: Date | null
  now: Date
  warningAgeMs: number
}

type DiskUsageInput = {
  availableBytes: number
  attentionPercent?: number
  availableInodes?: number
  totalBytes: number
  totalInodes?: number
}

type DiskUsageResult = {
  attentionReason: "space" | "inodes" | null
  availableBytes: number
  availableInodes: number
  inodesUsedPercent: number
  needsAttention: boolean
  totalBytes: number
  totalInodes: number
  usedPercent: number
}

type MigrationDriftInput = {
  appliedCount: number
  expectedCount: number
}

export function evaluateEmailHealth(input: EmailHealthInput): "attention" | "healthy" | "notSetup" {
  if (!input.hasSettingsRow || !input.isConfigured) {
    return "notSetup"
  }

  if (input.hasSuccessfulTest) {
    return "healthy"
  }

  return "attention"
}

// Identical in shape to `evaluateEmailHealth` but returns "optional" where that one returns
// "notSetup": an instance with no email provider cannot send an invoice or a password reset, while
// one with no Stripe keys is simply not taking card payments. The two must not be merged.
export function evaluateStripeHealth(
  input: StripeHealthInput
): "attention" | "healthy" | "optional" {
  if (!input.hasSettingsRow || !input.isConfigured) {
    return "optional"
  }

  if (input.hasSuccessfulTest) {
    return "healthy"
  }

  return "attention"
}

export function evaluateRemoteStorageConfiguration(
  input: RemoteStorageConfigurationInput
): input is CompleteRemoteStorageConfiguration {
  return validateBackupCredentials(input.destination, input).ok
}

export function evaluateBackupFreshness(
  input: BackupFreshnessInput
): "healthy" | "missing" | "stale" {
  if (!input.lastSuccessAt) {
    return "missing"
  }

  const ageMs = input.now.getTime() - input.lastSuccessAt.getTime()

  if (ageMs > input.warningAgeMs) {
    return "stale"
  }

  return "healthy"
}

export function evaluateDiskUsage(input: DiskUsageInput): DiskUsageResult {
  const attentionPercent = input.attentionPercent ?? 90

  const usedBytes = input.totalBytes - input.availableBytes
  const usedPercent = input.totalBytes > 0 ? (usedBytes / input.totalBytes) * 100 : 0

  const totalInodes = input.totalInodes ?? 0
  const availableInodes = input.availableInodes ?? 0
  const usedInodes = totalInodes - availableInodes
  const inodesUsedPercent = totalInodes > 0 ? (usedInodes / totalInodes) * 100 : 0

  const attentionReason: DiskUsageResult["attentionReason"] =
    usedPercent >= attentionPercent
      ? "space"
      : inodesUsedPercent >= attentionPercent
        ? "inodes"
        : null

  return {
    attentionReason,
    availableBytes: input.availableBytes,
    availableInodes,
    inodesUsedPercent,
    needsAttention: attentionReason !== null,
    totalBytes: input.totalBytes,
    totalInodes,
    usedPercent
  }
}

// "ahead" means the database carries migrations this build does not know about, which is what a
// rollback to an older image looks like — the schema has moved on without the code. It is reported
// separately from "pending" because the remedy is the opposite one: redeploy, not migrate.
export function evaluateMigrationDrift(
  input: MigrationDriftInput
): "healthy" | "pending" | "ahead" {
  if (input.appliedCount < input.expectedCount) {
    return "pending"
  }

  if (input.appliedCount > input.expectedCount) {
    return "ahead"
  }

  return "healthy"
}

export function evaluatePublicUrl(configuredUrl: string): boolean {
  try {
    new URL(configuredUrl)

    return true
  } catch {
    return false
  }
}

export type PublicUrlProbeFailure = "untrustedCertificate" | "unreachable"

// The verification codes Node's TLS layer reports when a handshake reached the server and the
// certificate it presented could not be trusted. Each means the address answered, so the probe
// failing on one is a statement about this container's trust store, not about whether clients can
// open the link: a private authority, a self-signed origin certificate behind a proxy, or a chain
// the container lacks all look like this while every browser that trusts them works.
const UNTRUSTED_CERTIFICATE_CODES = new Set([
  "CERT_HAS_EXPIRED",
  "CERT_NOT_YET_VALID",
  "CERT_REVOKED",
  "CERT_UNTRUSTED",
  "CERT_REJECTED",
  "CERT_CHAIN_TOO_LONG",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "HOSTNAME_MISMATCH",
  "INVALID_CA",
  "INVALID_PURPOSE",
  "PATH_LENGTH_EXCEEDED",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
])

export function classifyPublicUrlProbeFailure(errorCode: string | null): PublicUrlProbeFailure {
  return errorCode !== null && UNTRUSTED_CERTIFICATE_CODES.has(errorCode)
    ? "untrustedCertificate"
    : "unreachable"
}
