"use client"

import { useTranslation } from "@/lib/i18n"

import { Separator, SidebarTrigger, Typography } from "@/components/ui"

import { DensitySection } from "./DensitySection"
import { FontFamilySection } from "./FontFamilySection"
import { FontSizeSection } from "./FontSizeSection"
import { ThemeSection } from "./ThemeSection"

const AppearanceSettingsPage = () => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <header className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <Typography variant="h2">{t("settings.appearance.title")}</Typography>
      </header>
      <div className="space-y-8">
        <ThemeSection />
        <Separator />
        <FontSizeSection />
        <Separator />
        <DensitySection />
        <Separator />
        <FontFamilySection />
      </div>
    </div>
  )
}

export { AppearanceSettingsPage }
