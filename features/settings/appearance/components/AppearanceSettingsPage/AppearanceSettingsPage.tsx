"use client"

import { useTranslation } from "@/lib/i18n"

import { Separator } from "@/components/ui"

import { SettingsPageHeader } from "@/components/layout"

import { DensitySection } from "./DensitySection"
import { FontFamilySection } from "./FontFamilySection"
import { FontSizeSection } from "./FontSizeSection"
import { ThemeSection } from "./ThemeSection"

const AppearanceSettingsPage = () => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <SettingsPageHeader
        title={t("settings.appearance.title")}
        description={t("settings.appearance.description")}
        icon="Palette"
      />
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
