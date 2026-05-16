import { t } from "@/lib/i18n/server"

import { SettingsPageHeader } from "@/components/layout"

const EmailSettingsPage = () => {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <SettingsPageHeader
        title={t("settings.email.title")}
        description={t("settings.email.description")}
        icon="Mail"
      />
    </div>
  )
}

export { EmailSettingsPage }
