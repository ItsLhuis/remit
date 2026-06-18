import { type BackupCredentials } from "./index"

type SettingsRowLike =
  | (Partial<{
      backupS3AccessKey: string | null
      backupS3Bucket: string | null
      backupS3Endpoint: string | null
      backupS3Region: string | null
      backupS3SecretKey: string | null
    }> & { id?: string })
  | undefined
  | null

export function readBackupCredentialsFromSettings(settingsRow: SettingsRowLike): BackupCredentials {
  return {
    accessKey: settingsRow?.backupS3AccessKey ?? null,
    bucket: settingsRow?.backupS3Bucket ?? null,
    endpoint: settingsRow?.backupS3Endpoint ?? null,
    region: settingsRow?.backupS3Region ?? null,
    secretKey: settingsRow?.backupS3SecretKey ?? null
  }
}
