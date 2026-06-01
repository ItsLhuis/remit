export type HealthCategory = "core" | "safety" | "integrations"

export type HealthStatus = "healthy" | "attention" | "error" | "notSetup" | "optional" | "info"

export type HealthCheckId =
  | "backup"
  | "database"
  | "disk"
  | "email"
  | "migrations"
  | "public-url"
  | "storage"
  | "stripe"

export type HealthCheckResult = {
  id: HealthCheckId
  category: HealthCategory
  title: string
  status: HealthStatus
  summary: string
  backupDestination?: string
  backupLastFailureAt?: string
  backupLastFailureReason?: string
  backupLastSuccessAt?: string
  detail: string
  countsAsIssue: boolean
  actionLabel?: string
  actionHref?: string
}

export type SystemInfo = {
  version: string
  encryptionFingerprint: string
}
