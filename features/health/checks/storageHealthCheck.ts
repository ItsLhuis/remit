import { randomUUID } from "node:crypto"
import { mkdir, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3"

import { t } from "@/lib/i18n/server"

import { logger } from "@/lib/logger"

import {
  buildS3ClientConfig,
  type BackupDestination,
  type CompleteBackupCredentials
} from "@/lib/backups/destinationConfig"
import { env } from "@/lib/config/env"

import { type settings } from "@/database/schema"

import { evaluateRemoteStorageConfiguration } from "../services/evaluateHealth"
import { type HealthCheckResult } from "../types"

type SettingsRow = typeof settings.$inferSelect

const REMOTE_HEALTH_PROBE_TIMEOUT_MS = 5_000
const DATA_DIR = path.resolve(env.REMIT_DATA_DIR)

export async function getStorageHealthCheck(
  settingsRow: SettingsRow | null
): Promise<HealthCheckResult> {
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
    destination: normalizeRemoteBackupDestination(settingsRow?.backupDestination ?? "s3"),
    accessKey: settingsRow?.backupS3AccessKey ?? null,
    bucket: settingsRow?.backupS3Bucket ?? null,
    endpoint: settingsRow?.backupS3Endpoint ?? null,
    region: settingsRow?.backupS3Region ?? null,
    secretKey: settingsRow?.backupS3SecretKey ?? null
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

  const client = new S3Client(
    buildS3ClientConfig(
      remoteStorageConfiguration.destination,
      remoteStorageConfiguration as CompleteBackupCredentials
    )
  )

  try {
    await client.send(new HeadBucketCommand({ Bucket: remoteStorageConfiguration.bucket }), {
      abortSignal: AbortSignal.timeout(REMOTE_HEALTH_PROBE_TIMEOUT_MS)
    })

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

function normalizeRemoteBackupDestination(
  destination: BackupDestination
): Exclude<BackupDestination, "local"> {
  return destination === "r2" || destination === "b2" ? destination : "s3"
}
