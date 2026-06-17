"use client"

import { useTranslation } from "@/lib/i18n"

import { Separator } from "@/components/ui"

import { SettingsPageHeader } from "@/components/layout"

import { type HealthCategory, type HealthCheckResult, type SystemInfo } from "../../types"

import { HealthStatusSection } from "./HealthStatusSection"
import { HealthSummary } from "./HealthSummary"
import { SystemInfoStrip } from "./SystemInfoStrip"

type HealthSettingsPageProps = {
  checks: HealthCheckResult[]
  systemInfo: SystemInfo
}

type SectionDefinition = {
  category: HealthCategory
  title: string
  description: string
}

const getSections = (t: ReturnType<typeof useTranslation>["t"]): SectionDefinition[] => [
  {
    category: "core",
    title: t("health.sections.core.title"),
    description: t("health.sections.core.description")
  },
  {
    category: "safety",
    title: t("health.sections.safety.title"),
    description: t("health.sections.safety.description")
  },
  {
    category: "integrations",
    title: t("health.sections.integrations.title"),
    description: t("health.sections.integrations.description")
  }
]

const HealthSettingsPage = ({ checks, systemInfo }: HealthSettingsPageProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <SettingsPageHeader
        title={t("health.dashboard.title")}
        description={t("health.dashboard.description")}
        icon="Activity"
      />
      <div className="space-y-8">
        <HealthSummary checks={checks} />
        {getSections(t).map((section) => (
          <div key={section.category} className="space-y-8">
            <Separator />
            <HealthStatusSection
              title={section.title}
              description={section.description}
              checks={checks.filter((check) => check.category === section.category)}
            />
          </div>
        ))}
        <Separator />
        <SystemInfoStrip systemInfo={systemInfo} />
      </div>
    </div>
  )
}

export { HealthSettingsPage }
