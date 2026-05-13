import { createHash, randomUUID } from "node:crypto"
import { mkdir, statfs, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

import pkg from "@/package.json"

import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3"

import { sql } from "drizzle-orm"

import { env } from "@/lib/config/env"

import i18n from "@/lib/i18n/i18n"

import { t } from "@/lib/i18n/server"

import { logger } from "@/lib/logger"

import { database } from "@/database"
import { type settings } from "@/database/schema"

import { isEmailConfigured } from "@/features/settings"

import { formatBytes, formatDate } from "@/lib/utils"

import {
  evaluateBackupFreshness,
  evaluateDiskUsage,
  evaluateEmailHealth,
  evaluatePublicUrl,
  evaluateRemoteStorageConfiguration,
  evaluateStripeHealth
} from "./services/evaluateHealth"

import { type HealthCheckResult } from "./types"

type SettingsRow = typeof settings.$inferSelect

type DatabaseConnectivityResult = { ok: true } | { ok: false; reason: string; error: unknown }

const BACKUP_WARNING_AGE_MS = 7 * 24 * 60 * 60 * 1000
const DATA_DIR = path.resolve(env.REMIT_DATA_DIR)

const getHealthLocale = (): string => i18n.resolvedLanguage ?? i18n.language ?? "en"

export async function checkDatabaseConnectivity(): Promise<DatabaseConnectivityResult> {
  try {
    await database.execute(sql`SELECT 1`)

    return { ok: true }
  } catch (error) {
    return { ok: false, reason: "Database unavailable", error }
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
    storageCheck,
    diskCheck,
    getBackupHealthCheck(settingsRow),
    getEncryptionFingerprintHealthCheck(),
    getEmailHealthCheck(settingsRow),
    getStripeHealthCheck(settingsRow),
    getAppVersionHealthCheck(),
    getPublicUrlHealthCheck()
  ]
}

async function getDatabaseHealthCheck(): Promise<HealthCheckResult> {
  const result = await checkDatabaseConnectivity()

  if (result.ok) {
    return {
      id: "database",
      category: "core",
      title: t("health.checks.database.title"),
      status: "healthy",
      summary: t("health.checks.database.reachable"),
      detail: t("health.checks.database.reachableDetail"),
      countsAsIssue: false
    }
  }

  logger.error(
    { action: "getDatabaseHealthCheck", check: "database", err: result.error },
    "Database health check failed"
  )

  return {
    id: "database",
    category: "core",
    title: t("health.checks.database.title"),
    status: "error",
    summary: t("health.checks.database.unavailable"),
    detail: t("health.checks.database.unavailableDetail"),
    countsAsIssue: true
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
  const health = evaluateEmailHealth({
    hasSettingsRow: Boolean(settingsRow),
    isConfigured: settingsRow ? isEmailConfigured(settingsRow) : false,
    hasSuccessfulTest: Boolean(settingsRow?.emailTestSendAt)
  })

  if (health === "notSetup") {
    return {
      id: "email",
      category: "integrations",
      title: t("health.checks.email.title"),
      status: "notSetup",
      summary: t("health.checks.email.notConfigured"),
      detail: t("health.checks.email.notConfiguredDetail"),
      countsAsIssue: false,
      actionLabel: t("health.actions.configureEmail"),
      actionHref: "/settings/email"
    }
  }

  const provider = settingsRow?.emailProvider === "smtp" ? "SMTP" : "Resend"

  if (health === "healthy" && settingsRow?.emailTestSendAt) {
    return {
      id: "email",
      category: "integrations",
      title: t("health.checks.email.title"),
      status: "healthy",
      summary: t("health.checks.email.testedOk", {
        date: formatDate(settingsRow.emailTestSendAt, { locale: getHealthLocale() })
      }),
      detail: t("health.checks.email.testedDetail", { provider }),
      countsAsIssue: false
    }
  }

  return {
    id: "email",
    category: "integrations",
    title: t("health.checks.email.title"),
    status: "attention",
    summary: t("health.checks.email.configured"),
    detail: t("health.checks.email.configuredDetail", { provider }),
    countsAsIssue: false,
    actionLabel: t("health.actions.configureEmail"),
    actionHref: "/settings/email"
  }
}

function getStripeHealthCheck(settingsRow: SettingsRow | null): HealthCheckResult {
  const health = evaluateStripeHealth({
    hasSettingsRow: Boolean(settingsRow),
    isConfigured: Boolean(settingsRow?.stripePublishableKey && settingsRow?.stripeSecretKey),
    hasSuccessfulTest: Boolean(settingsRow?.stripeTestConnectionAt)
  })

  if (health === "optional") {
    return {
      id: "stripe",
      category: "integrations",
      title: t("health.checks.stripe.title"),
      status: "optional",
      summary: t("health.checks.stripe.notConfigured"),
      detail: t("health.checks.stripe.notConfiguredDetail"),
      countsAsIssue: false,
      actionLabel: t("health.actions.configurePayments"),
      actionHref: "/settings/payment"
    }
  }

  if (health === "healthy" && settingsRow?.stripeTestConnectionAt) {
    return {
      id: "stripe",
      category: "integrations",
      title: t("health.checks.stripe.title"),
      status: "healthy",
      summary: t("health.checks.stripe.testedOk", {
        date: formatDate(settingsRow.stripeTestConnectionAt, { locale: getHealthLocale() })
      }),
      detail: t("health.checks.stripe.testedDetail"),
      countsAsIssue: false
    }
  }

  return {
    id: "stripe",
    category: "integrations",
    title: t("health.checks.stripe.title"),
    status: "attention",
    summary: t("health.checks.stripe.configured"),
    detail: t("health.checks.stripe.configuredDetail"),
    countsAsIssue: false,
    actionLabel: t("health.actions.configurePayments"),
    actionHref: "/settings/payment"
  }
}

async function getStorageHealthCheck(settingsRow: SettingsRow | null): Promise<HealthCheckResult> {
  const destination = settingsRow?.backupDestination ?? "local"

  if (destination === "local") {
    return await getLocalStorageHealthCheck()
  }

  return await getRemoteStorageHealthCheck(settingsRow)
}

async function getLocalStorageHealthCheck(): Promise<HealthCheckResult> {
  const filePath = path.join(DATA_DIR, `.remit-health-${randomUUID()}`)

  try {
    await mkdir(DATA_DIR, { recursive: true })
    await writeFile(filePath, "ok", { flag: "wx" })
    await unlink(filePath)

    return {
      id: "storage",
      category: "core",
      title: t("health.checks.storage.title"),
      status: "healthy",
      summary: t("health.checks.storage.localWritable"),
      detail: t("health.checks.storage.localWritableDetail"),
      countsAsIssue: false
    }
  } catch (error) {
    logger.error(
      { action: "getLocalStorageHealthCheck", check: "storage", err: error },
      "Local storage health check failed"
    )

    return {
      id: "storage",
      category: "core",
      title: t("health.checks.storage.title"),
      status: "error",
      summary: t("health.checks.storage.localUnavailable"),
      detail: t("health.checks.storage.localUnavailableDetail"),
      countsAsIssue: true
    }
  }
}

async function getRemoteStorageHealthCheck(
  settingsRow: SettingsRow | null
): Promise<HealthCheckResult> {
  const remoteStorageConfiguration = {
    destination: settingsRow?.backupDestination ?? "s3",
    accessKeyId: settingsRow?.backupS3AccessKey ?? null,
    bucket: settingsRow?.backupS3Bucket ?? null,
    endpoint: settingsRow?.backupS3Endpoint ?? null,
    region: settingsRow?.backupS3Region ?? null,
    secretAccessKey: settingsRow?.backupS3SecretKey ?? null
  }

  if (!evaluateRemoteStorageConfiguration(remoteStorageConfiguration)) {
    return {
      id: "storage",
      category: "core",
      title: t("health.checks.storage.title"),
      status: "attention",
      summary: t("health.checks.storage.notConfigured"),
      detail: t("health.checks.storage.backupStorageMissing", {
        destination: remoteStorageConfiguration.destination.toUpperCase()
      }),
      countsAsIssue: true
    }
  }

  const client = new S3Client({
    region: remoteStorageConfiguration.region,
    endpoint: remoteStorageConfiguration.endpoint ?? undefined,
    credentials: {
      accessKeyId: remoteStorageConfiguration.accessKeyId,
      secretAccessKey: remoteStorageConfiguration.secretAccessKey
    },
    forcePathStyle: Boolean(remoteStorageConfiguration.endpoint)
  })

  try {
    await client.send(new HeadBucketCommand({ Bucket: remoteStorageConfiguration.bucket }))

    return {
      id: "storage",
      category: "core",
      title: t("health.checks.storage.title"),
      status: "healthy",
      summary: t("health.checks.storage.bucketReachable", {
        destination: remoteStorageConfiguration.destination.toUpperCase()
      }),
      detail: t("health.checks.storage.bucketReachableDetail"),
      countsAsIssue: false
    }
  } catch (error) {
    logger.error(
      {
        action: "getRemoteStorageHealthCheck",
        check: "storage",
        destination: remoteStorageConfiguration.destination,
        err: error
      },
      "Remote storage health check failed"
    )

    return {
      id: "storage",
      category: "core",
      title: t("health.checks.storage.title"),
      status: "error",
      summary: t("health.checks.storage.bucketUnavailable", {
        destination: remoteStorageConfiguration.destination.toUpperCase()
      }),
      detail: t("health.checks.storage.bucketUnavailableDetail"),
      countsAsIssue: true
    }
  }
}

function getBackupHealthCheck(settingsRow: SettingsRow | null): HealthCheckResult {
  const lastSuccessAt = settingsRow?.backupLastSuccessAt ?? null

  if (!lastSuccessAt) {
    return {
      id: "backup",
      category: "safety",
      title: t("health.checks.backup.title"),
      status: "attention",
      summary: t("health.checks.backup.missing"),
      detail: t("health.checks.backup.frequencyDetail"),
      countsAsIssue: true
    }
  }

  const freshness = evaluateBackupFreshness({
    lastSuccessAt,
    now: new Date(),
    warningAgeMs: BACKUP_WARNING_AGE_MS
  })

  if (freshness === "stale") {
    return {
      id: "backup",
      category: "safety",
      title: t("health.checks.backup.title"),
      status: "attention",
      summary: t("health.checks.backup.lastSuccess", {
        date: formatDate(lastSuccessAt, { locale: getHealthLocale() })
      }),
      detail: t("health.checks.backup.staleDetail"),
      countsAsIssue: true
    }
  }

  return {
    id: "backup",
    category: "safety",
    title: t("health.checks.backup.title"),
    status: "healthy",
    summary: t("health.checks.backup.lastSuccess", {
      date: formatDate(lastSuccessAt, { locale: getHealthLocale() })
    }),
    detail: t("health.checks.backup.freshDetail"),
    countsAsIssue: false
  }
}

async function getDiskUsageHealthCheck(): Promise<HealthCheckResult> {
  try {
    await mkdir(DATA_DIR, { recursive: true })

    const stats = await statfs(DATA_DIR)
    const diskUsage = evaluateDiskUsage({
      availableBytes: stats.bavail * stats.bsize,
      totalBytes: stats.blocks * stats.bsize
    })

    return {
      id: "disk",
      category: "core",
      title: t("health.checks.disk.title"),
      status: diskUsage.needsAttention ? "attention" : "healthy",
      summary: t("health.checks.disk.used", { percent: diskUsage.usedPercent.toFixed(1) }),
      detail: diskUsage.needsAttention
        ? t("health.checks.disk.highUsageDetail", {
            available: formatBytes(diskUsage.availableBytes, getHealthLocale()),
            total: formatBytes(diskUsage.totalBytes, getHealthLocale())
          })
        : t("health.checks.disk.usageDetail", {
            available: formatBytes(diskUsage.availableBytes, getHealthLocale()),
            total: formatBytes(diskUsage.totalBytes, getHealthLocale())
          }),
      countsAsIssue: diskUsage.needsAttention
    }
  } catch (error) {
    logger.error(
      { action: "getDiskUsageHealthCheck", check: "disk", err: error },
      "Disk usage health check failed"
    )

    return {
      id: "disk",
      category: "core",
      title: t("health.checks.disk.title"),
      status: "attention",
      summary: t("health.checks.disk.unavailable"),
      detail: t("health.checks.disk.unavailableDetail"),
      countsAsIssue: true
    }
  }
}

function getEncryptionFingerprintHealthCheck(): HealthCheckResult {
  return {
    id: "encryption-key",
    category: "safety",
    title: t("health.checks.encryption.title"),
    status: "info",
    summary: createHash("sha256").update(env.REMIT_ENCRYPTION_KEY).digest("hex").slice(0, 8),
    detail: t("health.checks.encryption.detail"),
    countsAsIssue: false
  }
}

function getAppVersionHealthCheck(): HealthCheckResult {
  return {
    id: "app-version",
    category: "instance",
    title: t("health.checks.version.title"),
    status: "info",
    summary: pkg.version,
    detail: t("health.checks.version.detail"),
    countsAsIssue: false
  }
}

function getPublicUrlHealthCheck(): HealthCheckResult {
  const configuredUrl = env.BETTER_AUTH_URL

  if (!evaluatePublicUrl(configuredUrl)) {
    return {
      id: "public-url",
      category: "instance",
      title: t("health.checks.publicUrl.title"),
      status: "attention",
      summary: t("health.checks.publicUrl.invalid"),
      detail: t("health.checks.publicUrl.invalidDetail"),
      countsAsIssue: true
    }
  }

  return {
    id: "public-url",
    category: "instance",
    title: t("health.checks.publicUrl.title"),
    status: "healthy",
    summary: new URL(configuredUrl).origin,
    detail: t("health.checks.publicUrl.detail"),
    countsAsIssue: false
  }
}
