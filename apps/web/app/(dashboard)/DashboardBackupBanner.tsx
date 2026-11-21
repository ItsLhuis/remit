import { BackupStatusBanner } from "@/features/backups"
import { getBackupBanner } from "@/features/backups/server"

// Its own boundary rather than a field on `DashboardPageData`: a warning that the instance has no
// recent archive must not wait behind a dozen money aggregates, and it reads one indexed settings
// row. Renders nothing at all when the backup posture is healthy, when the viewer is not the owner,
// or on a hosted instance — the query decides all three.
const DashboardBackupBanner = async () => {
  const banner = await getBackupBanner()

  if (!banner) return null

  return <BackupStatusBanner banner={banner} />
}

export { DashboardBackupBanner }
