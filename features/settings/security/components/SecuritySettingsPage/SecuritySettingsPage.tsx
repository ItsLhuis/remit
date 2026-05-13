"use client"

import { useTranslation } from "@/lib/i18n"

import { Separator, SidebarTrigger, Typography } from "@/components/ui"

import { ChangePasswordSection } from "./ChangePasswordSection"
import { TwoFactorSection } from "./TwoFactorSection"

const SecuritySettingsPage = () => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <header className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <Typography variant="h2">{t("settings.security.title")}</Typography>
      </header>
      <div className="space-y-8">
        <ChangePasswordSection />
        <Separator />
        <TwoFactorSection />
      </div>
    </div>
  )
}

export { SecuritySettingsPage }
