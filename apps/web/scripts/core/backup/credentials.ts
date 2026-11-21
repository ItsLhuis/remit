import {
  buildDestinationAdapter,
  validateBackupCredentials,
  type BackupCredentials,
  type BackupDestination,
  type BackupDestinationAdapter
} from "../destination"
import { readBackupCredentialsFromSettings } from "../destination/credentials"

type SettingsRowLike = Parameters<typeof readBackupCredentialsFromSettings>[0]

export class BackupCredentialsError extends Error {}

export function buildConfiguredDestinationAdapter(
  destination: Exclude<BackupDestination, "local">,
  settingsRow: SettingsRowLike
): BackupDestinationAdapter {
  const credentials = readBackupCredentialsFromSettings(settingsRow)
  const validation = validateBackupCredentials(destination, credentials)

  if (!validation.ok) throw new BackupCredentialsError(validation.reason)

  return buildDestinationAdapter(destination, credentials)
}

export { readBackupCredentialsFromSettings as readBackupCredentials, type BackupCredentials }
