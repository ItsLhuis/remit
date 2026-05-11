import { t } from "@/lib/i18n/server"

import { Separator, SidebarTrigger, Typography } from "@/components/ui"

import { HealthStatusSection } from "./HealthStatusSection"
import { HealthSummary } from "./HealthSummary"

import { type HealthCategory, type HealthCheckResult } from "../../types"

type HealthDashboardProps = {
  checks: HealthCheckResult[]
}

type SectionDefinition = {
  category: HealthCategory
  title: string
  description: string
}

const getSections = (): SectionDefinition[] => [
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
  },
  {
    category: "instance",
    title: t("health.sections.instance.title"),
    description: t("health.sections.instance.description")
  }
]

const HealthDashboard = ({ checks }: HealthDashboardProps) => (
  <div className="flex flex-col gap-8 p-4 md:p-8">
    <header className="flex items-start gap-2">
      <SidebarTrigger className="mt-1 md:hidden" />
      <div className="space-y-1">
        <Typography variant="h2">{t("health.dashboard.title")}</Typography>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          {t("health.dashboard.description")}
        </Typography>
      </div>
    </header>
    <div className="space-y-8">
      <HealthSummary checks={checks} />
      {getSections().map((section) => (
        <div key={section.category} className="space-y-8">
          <Separator />
          <HealthStatusSection
            title={section.title}
            description={section.description}
            checks={checks.filter((check) => check.category === section.category)}
          />
        </div>
      ))}
    </div>
  </div>
)

export { HealthDashboard }
