import { createHash, randomUUID } from "node:crypto"
import { mkdir, statfs, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3"

import { sql } from "drizzle-orm"

import { database } from "@/database"
import { type settings } from "@/database/schema"

import { env } from "@/lib/env"

import { logger } from "@/lib/logger"

import { isEmailConfigured } from "@/features/settings"

export type HealthStatus = "ok" | "warning" | "error" | "info"

export type HealthCheckResult = {
  id: string
  title: string
  status: HealthStatus
  summary: string
  detail: string
}

type SettingsRow = typeof settings.$inferSelect

type DatabaseConnectivityResult = { ok: true } | { ok: false; reason: string; error: unknown }

const BACKUP_WARNING_AGE_MS = 7 * 24 * 60 * 60 * 1000
const DATA_DIR = path.resolve(env.REMIT_DATA_DIR)

export async function checkDatabaseConnectivity(): Promise<DatabaseConnectivityResult> {
  try {
    await database.execute(sql`SELECT 1`)

    return { ok: true }
  } catch (error) {
    return { ok: false, reason: "Database unreachable", error }
  }
}

export async function getHealthChecks(): Promise<HealthCheckResult[]> {
  const [databaseCheck, settingsRow] = await Promise.all([
    getDatabaseHealthCheck(),
    getSettingsForHealth()
  ])

  const [storageCheck, diskCheck] = await Promise.all([
    getStorageHealthCheck(settingsRow),
    getDiskUsageHealthCheck()
  ])

  return [
    databaseCheck,
    getEmailHealthCheck(settingsRow),
    getStripeHealthCheck(settingsRow),
    storageCheck,
    getBackupHealthCheck(settingsRow),
    diskCheck,
    getEncryptionFingerprintHealthCheck(),
    getUpdatesHealthCheck()
  ]
}

async function getDatabaseHealthCheck(): Promise<HealthCheckResult> {
  const result = await checkDatabaseConnectivity()

  if (result.ok) {
    return {
      id: "database",
      title: "Database connectivity",
      status: "ok",
      summary: "Reachable",
      detail: "The application can run SELECT 1 against PostgreSQL"
    }
  }

  logger.error(
    { action: "getDatabaseHealthCheck", check: "database", err: result.error },
    "Database health check failed"
  )

  return {
    id: "database",
    title: "Database connectivity",
    status: "error",
    summary: "Unavailable",
    detail: result.reason
  }
}

async function getSettingsForHealth(): Promise<SettingsRow | null> {
  try {
    return (await database.query.settings.findFirst()) ?? null
  } catch (error) {
    logger.error(
      { action: "getSettingsForHealth", entityType: "settings", err: error },
      "Health settings lookup failed"
    )

    return null
  }
}

function getEmailHealthCheck(settingsRow: SettingsRow | null): HealthCheckResult {
  if (!settingsRow || !isEmailConfigured(settingsRow)) {
    return {
      id: "email",
      title: "SMTP/Resend reachability",
      status: "warning",
      summary: "Not configured",
      detail: "No complete SMTP or Resend provider configuration was found"
    }
  }

  const provider = settingsRow.emailProvider === "smtp" ? "SMTP" : "Resend"

  if (settingsRow.emailTestSendAt) {
    return {
      id: "email",
      title: "SMTP/Resend reachability",
      status: "ok",
      summary: `Tested OK on ${formatDate(settingsRow.emailTestSendAt)}`,
      detail: `${provider} is configured and has a successful test send timestamp`
    }
  }

  return {
    id: "email",
    title: "SMTP/Resend reachability",
    status: "info",
    summary: "Configured",
    detail: `${provider} is configured, but no successful test send has been recorded yet`
  }
}

function getStripeHealthCheck(settingsRow: SettingsRow | null): HealthCheckResult {
  const stripeConfigured = Boolean(settingsRow?.stripePublishableKey && settingsRow.stripeSecretKey)

  if (!settingsRow || !stripeConfigured) {
    return {
      id: "stripe",
      title: "Stripe reachability",
      status: "warning",
      summary: "Not configured",
      detail: "No complete Stripe key configuration was found"
    }
  }

  if (settingsRow.stripeTestConnectionAt) {
    return {
      id: "stripe",
      title: "Stripe reachability",
      status: "ok",
      summary: `Tested OK on ${formatDate(settingsRow.stripeTestConnectionAt)}`,
      detail: "Stripe is configured and has a successful connection test timestamp"
    }
  }

  return {
    id: "stripe",
    title: "Stripe reachability",
    status: "info",
    summary: "Configured",
    detail: "Stripe is configured, but no successful connection test has been recorded yet"
  }
}

async function getStorageHealthCheck(settingsRow: SettingsRow | null): Promise<HealthCheckResult> {
  const destination = settingsRow?.backupDestination ?? "local"

  if (destination === "local") {
    return await getLocalStorageHealthCheck()
  }

  return await getS3StorageHealthCheck(settingsRow)
}

async function getLocalStorageHealthCheck(): Promise<HealthCheckResult> {
  const filePath = path.join(DATA_DIR, `.remit-health-${randomUUID()}`)

  try {
    await mkdir(DATA_DIR, { recursive: true })
    await writeFile(filePath, "ok", { flag: "wx" })
    await unlink(filePath)

    return {
      id: "storage",
      title: "Storage backend",
      status: "ok",
      summary: "Local filesystem writable",
      detail: `Touched a temporary file in ${DATA_DIR}`
    }
  } catch (error) {
    logger.error(
      { action: "getLocalStorageHealthCheck", check: "storage", err: error },
      "Local storage health check failed"
    )

    return {
      id: "storage",
      title: "Storage backend",
      status: "error",
      summary: "Local filesystem unavailable",
      detail: `Could not write a temporary file in ${DATA_DIR}`
    }
  }
}

async function getS3StorageHealthCheck(
  settingsRow: SettingsRow | null
): Promise<HealthCheckResult> {
  const destination = settingsRow?.backupDestination ?? "s3"
  const bucket = settingsRow?.backupS3Bucket
  const region = settingsRow?.backupS3Region
  const endpoint = settingsRow?.backupS3Endpoint
  const accessKeyId = settingsRow?.backupS3AccessKey
  const secretAccessKey = settingsRow?.backupS3SecretKey

  if (
    !bucket ||
    !region ||
    !accessKeyId ||
    !secretAccessKey ||
    (destination !== "s3" && !endpoint)
  ) {
    return {
      id: "storage",
      title: "Storage backend",
      status: "warning",
      summary: "Not configured",
      detail: `${destination.toUpperCase()} backup storage is selected but missing required connection settings`
    }
  }

  const client = new S3Client({
    region,
    endpoint: endpoint ?? undefined,
    credentials: {
      accessKeyId,
      secretAccessKey
    },
    forcePathStyle: Boolean(endpoint)
  })

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }))

    return {
      id: "storage",
      title: "Storage backend",
      status: "ok",
      summary: `${destination.toUpperCase()} bucket reachable`,
      detail: "The configured backup bucket responded to a head request"
    }
  } catch (error) {
    logger.error(
      { action: "getS3StorageHealthCheck", check: "storage", destination, err: error },
      "S3-compatible storage health check failed"
    )

    return {
      id: "storage",
      title: "Storage backend",
      status: "error",
      summary: `${destination.toUpperCase()} bucket unavailable`,
      detail: "The configured backup bucket did not respond to a head request"
    }
  }
}

function getBackupHealthCheck(settingsRow: SettingsRow | null): HealthCheckResult {
  const lastSuccessAt = settingsRow?.backupLastSuccessAt

  if (!lastSuccessAt) {
    return {
      id: "backup",
      title: "Last successful backup",
      status: "warning",
      summary: "No successful backup recorded",
      detail: "Backups should run successfully at least once every 7 days"
    }
  }

  const ageMs = Date.now() - lastSuccessAt.getTime()

  if (ageMs > BACKUP_WARNING_AGE_MS) {
    return {
      id: "backup",
      title: "Last successful backup",
      status: "warning",
      summary: `Last success on ${formatDate(lastSuccessAt)}`,
      detail: "The last successful backup is older than 7 days"
    }
  }

  return {
    id: "backup",
    title: "Last successful backup",
    status: "ok",
    summary: `Last success on ${formatDate(lastSuccessAt)}`,
    detail: "Backups have completed successfully within the last 7 days"
  }
}

async function getDiskUsageHealthCheck(): Promise<HealthCheckResult> {
  try {
    await mkdir(DATA_DIR, { recursive: true })

    const stats = await statfs(DATA_DIR)
    const totalBytes = stats.blocks * stats.bsize
    const availableBytes = stats.bavail * stats.bsize
    const usedBytes = totalBytes - availableBytes
    const usedPercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0
    const status: HealthStatus = usedPercent >= 90 ? "warning" : "ok"

    return {
      id: "disk",
      title: "Disk usage of data volume",
      status,
      summary: `${usedPercent.toFixed(1)}% used`,
      detail: `${formatBytes(availableBytes)} available of ${formatBytes(totalBytes)} at ${DATA_DIR}`
    }
  } catch (error) {
    logger.error(
      { action: "getDiskUsageHealthCheck", check: "disk", err: error },
      "Disk usage health check failed"
    )

    return {
      id: "disk",
      title: "Disk usage of data volume",
      status: "warning",
      summary: "Unavailable",
      detail: `Could not read filesystem statistics for ${DATA_DIR}`
    }
  }
}

function getEncryptionFingerprintHealthCheck(): HealthCheckResult {
  return {
    id: "encryption-key",
    title: "Encryption key fingerprint",
    status: "info",
    summary: createHash("sha256").update(env.REMIT_ENCRYPTION_KEY).digest("hex").slice(0, 8),
    detail: "This fingerprint should not change between deploys"
  }
}

function getUpdatesHealthCheck(): HealthCheckResult {
  return {
    id: "updates",
    title: "Available updates",
    status: "info",
    summary: "Update checks not configured",
    detail: "The real update check will be added with the update flow"
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date)
}

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"]
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}
