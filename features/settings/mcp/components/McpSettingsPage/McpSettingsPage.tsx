import { t } from "@/lib/i18n/server"

import { SettingsPageHeader } from "@/components/layout"

import { getMcpSettingsPageData } from "../../queries"

import { McpAccessCard } from "./McpAccessCard"
import { McpConnectionCard } from "./McpConnectionCard"
import { McpToolCallsCard } from "./McpToolCallsCard"

const McpSettingsPage = async () => {
  const pageData = await getMcpSettingsPageData()

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <SettingsPageHeader
        title={t("settings.mcp.title")}
        description={t("settings.mcp.description")}
        icon="Bot"
      />
      <McpAccessCard enabled={pageData.enabled} />
      <McpConnectionCard endpointUrl={pageData.endpointUrl} />
      <McpToolCallsCard
        toolCalls={pageData.toolCalls}
        locale={pageData.locale}
        timeZone={pageData.timeZone}
      />
    </div>
  )
}

export { McpSettingsPage }
