import type postgres from "postgres"

import { decryptValue } from "../encryption/values"

import type { BackupCredentials, BackupDestination } from "../destination"

import { RotationCliError } from "./errors"
import { readNullableUnknownString } from "./verifyOldKey"

type Sql = postgres.Sql

export type SettingsBackupConfig = {
  accessKey: string | null
  bucket: string | null
  destination: BackupDestination
  endpoint: string | null
  region: string | null
  secretKey: string | null
}

export async function readBackupSettings(
  client: Sql,
  key: Buffer
): Promise<(SettingsBackupConfig & BackupCredentials) | null> {
  const [row] = await client<Array<Record<string, unknown>>>`
    SELECT
      backup_destination,
      backup_s3_access_key,
      backup_s3_bucket,
      backup_s3_endpoint,
      backup_s3_region,
      backup_s3_secret_key
    FROM settings
    LIMIT 1
  `
  if (!row) return null

  const destination = readBackupDestination(row.backup_destination)
  const settings: SettingsBackupConfig & BackupCredentials = {
    accessKey: decryptNullableSetting(
      row.backup_s3_access_key,
      key,
      "settings.backup_s3_access_key"
    ),
    bucket: readNullableUnknownString(row.backup_s3_bucket),
    destination,
    endpoint: readNullableUnknownString(row.backup_s3_endpoint),
    region: readNullableUnknownString(row.backup_s3_region),
    secretKey: decryptNullableSetting(
      row.backup_s3_secret_key,
      key,
      "settings.backup_s3_secret_key"
    )
  }

  return settings
}

function readBackupDestination(value: unknown): BackupDestination {
  if (value === "local" || value === "s3" || value === "r2" || value === "b2") {
    return value
  }

  return "local"
}

function decryptNullableSetting(value: unknown, key: Buffer, label: string): string | null {
  const encrypted = readNullableUnknownString(value)
  if (encrypted === null) return null

  try {
    return decryptValue(encrypted, key)
  } catch {
    throw new RotationCliError(
      `decrypt failed for ${label} - verify REMIT_ENCRYPTION_KEY matches the database's current key.`
    )
  }
}
