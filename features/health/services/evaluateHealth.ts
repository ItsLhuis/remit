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

type RemoteStorageConfigurationInput = {
  destination: string
  accessKeyId: string | null
  bucket: string | null
  endpoint: string | null
  region: string | null
  secretAccessKey: string | null
}

type CompleteRemoteStorageConfiguration = {
  destination: string
  accessKeyId: string
  bucket: string
  endpoint: string | null
  region: string
  secretAccessKey: string
}

type BackupFreshnessInput = {
  lastSuccessAt: Date | null
  now: Date
  warningAgeMs: number
}

type DiskUsageInput = {
  availableBytes: number
  attentionPercent?: number
  totalBytes: number
}

type DiskUsageResult = {
  availableBytes: number
  needsAttention: boolean
  totalBytes: number
  usedPercent: number
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
  if (!input.bucket || !input.region || !input.accessKeyId || !input.secretAccessKey) {
    return false
  }

  if (input.destination !== "s3" && !input.endpoint) {
    return false
  }

  return true
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
  const usedBytes = input.totalBytes - input.availableBytes
  const usedPercent = input.totalBytes > 0 ? (usedBytes / input.totalBytes) * 100 : 0
  const attentionPercent = input.attentionPercent ?? 90

  return {
    availableBytes: input.availableBytes,
    needsAttention: usedPercent >= attentionPercent,
    totalBytes: input.totalBytes,
    usedPercent
  }
}

export function evaluatePublicUrl(configuredUrl: string): boolean {
  try {
    new URL(configuredUrl)

    return true
  } catch {
    return false
  }
}
