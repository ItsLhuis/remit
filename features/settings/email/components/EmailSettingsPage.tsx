import { t } from "@/lib/i18n/server"

import { getEmailSettings } from "../queries"

import { SettingsPageHeader } from "@/components/layout"

import { EmailSettingsForm } from "./EmailSettingsForm"

type EmailSettingsPageProps = {
  defaultTestRecipient: string
}

const EmailSettingsPage = async ({ defaultTestRecipient }: EmailSettingsPageProps) => {
  const settings = await getEmailSettings()

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <SettingsPageHeader
        title={t("settings.email.title")}
        description={t("settings.email.description")}
        icon="Mail"
      />
      <EmailSettingsForm
        initialValues={settings}
        defaultTestRecipient={defaultTestRecipient}
        initialEmailTestSendAt={settings.emailTestSendAt}
      />
    </div>
  )
}

export { EmailSettingsPage }
