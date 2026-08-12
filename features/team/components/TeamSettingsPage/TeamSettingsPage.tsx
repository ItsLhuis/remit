import { t } from "@/lib/i18n/server"

import { SettingsPageHeader } from "@/components/layout"

import { getTeamPageData } from "../../queries"

import { TeamSettingsForm } from "./TeamSettingsForm"

const TeamSettingsPage = async () => {
  const pageData = await getTeamPageData()

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <SettingsPageHeader
        title={t("settings.team.title")}
        description={t("settings.team.description")}
        icon="Users"
      />
      <TeamSettingsForm
        initialMembers={pageData.members}
        initialInvitations={pageData.invitations}
        emailConfigured={pageData.emailConfigured}
        locale={pageData.locale}
        timeZone={pageData.timeZone}
      />
    </div>
  )
}

export { TeamSettingsPage }
