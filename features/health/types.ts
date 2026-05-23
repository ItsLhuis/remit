export type HealthCategory = "core" | "safety" | "integrations" | "instance"

export type HealthStatus = "healthy" | "attention" | "error" | "notSetup" | "optional" | "info"

export type HealthCheckId =
  | "app-version"
  | "backup"
  | "database"
  | "disk"
  | "email"
  | "encryption-key"
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
