import { t } from "@/lib/i18n/server"

import { SettingsPageHeader } from "@/components/layout"

import { getDataExportPageData } from "../../queries"

import { DataExportContentsCard } from "./DataExportContentsCard"
import { DataExportPanel } from "./DataExportPanel"

const DataSettingsPage = async () => {
  const pageData = await getDataExportPageData()

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <SettingsPageHeader
        title={t("settings.data.title")}
        description={t("settings.data.description")}
        icon="DatabaseBackup"
      />
      <DataExportPanel
        clients={pageData.clients}
        exports={pageData.exports}
        hasActiveExport={pageData.hasActiveExport}
        locale={pageData.locale}
        timeZone={pageData.timeZone}
      />
      <DataExportContentsCard />
    </div>
  )
}

export { DataSettingsPage }
