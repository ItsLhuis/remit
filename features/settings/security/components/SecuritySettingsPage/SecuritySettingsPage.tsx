"use client"

import { useTranslation } from "@/lib/i18n"

import { Separator } from "@/components/ui"

import { SettingsPageHeader } from "@/components/layout"

import { ChangePasswordSection } from "./ChangePasswordSection"
import { TwoFactorSection } from "./TwoFactorSection"

const SecuritySettingsPage = () => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <SettingsPageHeader
        title={t("settings.security.title")}
        description={t("settings.security.description")}
        icon="ShieldCheck"
      />
      <div className="space-y-8">
        <ChangePasswordSection />
        <Separator />
        <TwoFactorSection />
      </div>
    </div>
  )
}

export { SecuritySettingsPage }
