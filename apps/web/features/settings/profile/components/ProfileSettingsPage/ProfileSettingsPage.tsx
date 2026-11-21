import { t } from "@/lib/i18n/server"

import { requireSession } from "@/lib/auth/session"

import { Separator } from "@/components/ui"

import { SettingsPageHeader } from "@/components/layout"

import { getProfileEmailConfigured, getProfileLocale } from "../../queries"

import { AccountDetailsSection } from "./AccountDetailsSection"
import { AvatarSection } from "./AvatarSection"
import { LogoutSection } from "./LogoutSection"

const ProfileSettingsPage = async () => {
  const [session, emailConfigured, locale] = await Promise.all([
    requireSession(undefined, { disableCookieCache: true }),
    getProfileEmailConfigured(),
    getProfileLocale()
  ])

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <SettingsPageHeader
        title={t("settings.profile.title")}
        description={t("settings.profile.description")}
        icon="UserRound"
      />
      <div className="space-y-8">
        <AvatarSection user={session.user} locale={locale} />
        <Separator />
        <AccountDetailsSection user={session.user} emailConfigured={emailConfigured} />
        <Separator />
        <LogoutSection />
      </div>
    </div>
  )
}

export { ProfileSettingsPage }
