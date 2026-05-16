"use client"

import { useTranslation } from "@/lib/i18n"

import { Typography } from "@/components/ui"

import { HealthCheckRow } from "./HealthCheckRow"

import { type HealthCheckResult } from "../../types"

type HealthStatusSectionProps = {
  title: string
  description: string
  checks: HealthCheckResult[]
}

const HealthStatusSection = ({ title, description, checks }: HealthStatusSectionProps) => {
  const { t } = useTranslation()

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <Typography variant="h4">{title}</Typography>
        <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
          {description}
        </Typography>
      </div>
      <div className="divide-border divide-y rounded-lg border">
        {checks.length > 0 ? (
          checks.map((check) => <HealthCheckRow key={check.id} check={check} />)
        ) : (
          <div className="p-4">
            <Typography affects={["muted", "small"]}>{t("health.sections.empty")}</Typography>
          </div>
        )}
      </div>
    </section>
  )
}

export { HealthStatusSection }
