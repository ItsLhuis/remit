import { t } from "@/lib/i18n/server"

import { SettingsPageHeader } from "@/components/layout"

const TemplatesSettingsPage = () => {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <SettingsPageHeader
        title={t("settings.templates.title")}
        description={t("settings.templates.description")}
        icon="LayoutTemplate"
      />
    </div>
  )
}

export { TemplatesSettingsPage }
