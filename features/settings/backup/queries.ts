import { env } from "@/lib/config/env"

import { database } from "@/database"

import { type BackupSettingsValues } from "./schemas"

export type BackupSettingsStatus = {
  backupTestConnectionAt: string | null
  backupLastSuccessAt: string | null
  backupLastFailureAt: string | null
  backupLastFailureReason: string | null
}

export type BackupSettingsPageData = {
  settings: BackupSettingsValues
  status: BackupSettingsStatus
  // ARCHITECTURE.md section 18: on a Hosted instance the destination is operator-managed, so the
  // page shows status and refuses edits rather than asking a customer for S3 credentials the
  // operator already holds. The mutations enforce it too — this only decides what the form renders.
  hostedMode: boolean
}

type BackupSettingsRow = {
  backupDestination: "local" | "s3" | "r2" | "b2"
  backupCadence: "daily" | "weekly"
  backupRetentionDaily: number
  backupRetentionWeekly: number
  backupRetentionMonthly: number
  backupS3Bucket: string | null
  backupS3Region: string | null
  backupS3Endpoint: string | null
  backupS3AccessKey: string | null
  backupS3SecretKey: string | null
  backupTestConnectionAt: Date | null
  backupLastSuccessAt: Date | null
  backupLastFailureAt: Date | null
  backupLastFailureReason: string | null
}

export async function getBackupSettingsPageData(): Promise<BackupSettingsPageData> {
  const row = await database.query.settings.findFirst({
    columns: {
      backupDestination: true,
      backupCadence: true,
      backupRetentionDaily: true,
      backupRetentionWeekly: true,
      backupRetentionMonthly: true,
      backupS3Bucket: true,
      backupS3Region: true,
      backupS3Endpoint: true,
      backupS3AccessKey: true,
      backupS3SecretKey: true,
      backupTestConnectionAt: true,
      backupLastSuccessAt: true,
      backupLastFailureAt: true,
      backupLastFailureReason: true
    }
  })

  return {
    settings: toBackupSettingsFormData(row ?? null),
    status: toBackupSettingsStatus(row ?? null),
    hostedMode: env.REMIT_HOSTED_MODE
  }
}

// The two encrypted credentials are returned as empty strings beside a `*Configured` boolean rather
// than as their stored values, because this read model reaches a client form and `security.md`
// forbids an encrypted field leaving the server. Masking them was rejected: an access key is a
// random string its owner cannot recognise from four characters, so a mask would leak key material
// to buy nothing. The booleans are what tell the form a credential exists, and the write half of
// the contract is in mutations.ts — a blank submission keeps what is stored.
export function toBackupSettingsFormData(row: BackupSettingsRow | null): BackupSettingsValues {
  return {
    backupDestination: row?.backupDestination ?? "local",
    backupCadence: row?.backupCadence ?? "daily",
    backupRetentionDaily: row?.backupRetentionDaily ?? 7,
    backupRetentionWeekly: row?.backupRetentionWeekly ?? 4,
    backupRetentionMonthly: row?.backupRetentionMonthly ?? 12,
    backupS3Bucket: row?.backupS3Bucket ?? "",
    backupS3Region: row?.backupS3Region ?? "",
    backupS3Endpoint: row?.backupS3Endpoint ?? "",
    backupS3AccessKey: "",
    backupS3AccessKeyConfigured: Boolean(row?.backupS3AccessKey),
    backupS3SecretKey: "",
    backupS3SecretKeyConfigured: Boolean(row?.backupS3SecretKey)
  }
}

export function toBackupSettingsStatus(row: BackupSettingsRow | null): BackupSettingsStatus {
  return {
    backupTestConnectionAt: row?.backupTestConnectionAt?.toISOString() ?? null,
    backupLastSuccessAt: row?.backupLastSuccessAt?.toISOString() ?? null,
    backupLastFailureAt: row?.backupLastFailureAt?.toISOString() ?? null,
    backupLastFailureReason: row?.backupLastFailureReason ?? null
  }
}
