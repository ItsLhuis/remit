"use client"

import { useTranslation } from "@/lib/i18n"

import { type HealthCheckResult } from "../../types"

import { Card, CardContent, Typography } from "@/components/ui"

import { HealthCheckRow } from "./HealthCheckRow"

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
      {checks.length > 0 ? (
        <div className="space-y-3">
          {checks.map((check) => (
            <HealthCheckRow key={check.id} check={check} />
          ))}
        </div>
      ) : (
        <Card size="sm">
          <CardContent>
            <Typography affects={["muted", "small"]}>{t("health.sections.empty")}</Typography>
          </CardContent>
        </Card>
      )}
    </section>
  )
}

export { HealthStatusSection }
