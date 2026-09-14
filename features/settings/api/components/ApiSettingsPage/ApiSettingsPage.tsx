import { t } from "@/lib/i18n/server"

import { SettingsPageHeader } from "@/components/layout"

import { getApiTokensPageData } from "../../queries"

import { ApiTokensTable } from "./ApiTokensTable"

const ApiSettingsPage = async () => {
  const pageData = await getApiTokensPageData()

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <SettingsPageHeader
        title={t("settings.api.title")}
        description={t("settings.api.description")}
        icon="KeyRound"
      />
      <ApiTokensTable
        initialTokens={pageData.tokens}
        locale={pageData.locale}
        timeZone={pageData.timeZone}
      />
    </div>
  )
}

export { ApiSettingsPage }
