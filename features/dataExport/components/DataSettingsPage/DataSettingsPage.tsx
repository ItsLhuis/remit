import { t } from "@/lib/i18n/server"

import { SettingsPageHeader } from "@/components/layout"

import { TrashSection } from "@/features/trash/server"

import { getDataExportPageData } from "../../queries"

import { DataExportContentsCard } from "./DataExportContentsCard"
import { DataExportPanel } from "./DataExportPanel"

type DataSettingsPageProps = {
  searchParams: unknown
}

const DataSettingsPage = async ({ searchParams }: DataSettingsPageProps) => {
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
      <TrashSection searchParams={searchParams} />
    </div>
  )
}

export { DataSettingsPage }
