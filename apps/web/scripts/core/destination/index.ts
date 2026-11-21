export {
  buildDestinationAdapter,
  buildS3ClientConfig,
  resolveBackupEndpoint,
  validateBackupCredentials
} from "@/lib/backups/destination"

export type {
  BackupCredentialValidationResult,
  BackupCredentials,
  BackupDestination,
  BackupDestinationAdapter,
  CompleteBackupCredentials
} from "@/lib/backups/destination"
