import { t } from "@/lib/i18n/server"

import { SettingsPageHeader } from "@/components/layout"

import { getBackupSettingsPageData } from "../../queries"

import { BackupSettingsForm } from "./BackupSettingsForm"

const BackupSettingsPage = async () => {
  const { settings, status, hostedMode } = await getBackupSettingsPageData()

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <SettingsPageHeader
        title={t("settings.backup.title")}
        description={t("settings.backup.description")}
        icon="HardDriveDownload"
      />
      <BackupSettingsForm initialValues={settings} status={status} hostedMode={hostedMode} />
    </div>
  )
}

export { BackupSettingsPage }
