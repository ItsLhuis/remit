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
