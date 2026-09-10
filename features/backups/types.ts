import { type BackupBannerState } from "./services"

// Deliberately without the healthy case: `getBackupBanner` returns null when there is nothing to
// say, so no surface has to carry a branch for the state that renders nothing.
export type BackupBanner = {
  state: Exclude<BackupBannerState, "healthy">
  // Already redacted by `redactBackupReason` before it reached the column, which is what makes it
  // safe to render: the provider's own text can carry a presigned URL or a key id.
  lastFailureReason: string | null
}
