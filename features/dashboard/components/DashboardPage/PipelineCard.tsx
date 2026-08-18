"use client"

import { useTranslation } from "@/lib/i18n"

import { formatNumber } from "@/lib/utils"

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Meter,
  MeterLegend,
  MeterLegendItem,
  Typography
} from "@/components/ui"

import { pipelineStagePresentation } from "../../labels"
import { type LeadPipeline } from "../../services"

import { DashboardCardEmpty } from "./DashboardCardEmpty"
import { DashboardHint } from "./DashboardHint"

type PipelineCardProps = {
  pipeline: LeadPipeline
  locale: string
}

// A bounded categorical breakdown, so it gets a segmented bar and chips rather than a chart: six
// named stages of one whole is a part-to-whole reading the eye takes from one strip, and a bar
// chart would spend a card's worth of height saying the same thing less precisely.
const PipelineCard = ({ pipeline, locale }: PipelineCardProps) => {
  const { t } = useTranslation()

  if (pipeline.totalCount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.pipeline.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DashboardCardEmpty
            icon="Sparkles"
            title={t("dashboard.pipeline.emptyTitle")}
            description={t("dashboard.pipeline.emptyDescription")}
            action={{ label: t("dashboard.pipeline.emptyAction"), href: "/leads" }}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          {t("dashboard.pipeline.title")}
          <DashboardHint label={t("dashboard.periods.fixedWindow")} />
        </CardTitle>
        <CardDescription>{t("dashboard.pipeline.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Typography affects={["small", "medium"]}>
            {t("dashboard.pipeline.openLeads", { count: pipeline.openCount })}
          </Typography>
          {pipeline.winRatePercentage === null ? (
            <Typography affects={["muted", "tiny"]}>
              {t("dashboard.pipeline.winRateNone")}
            </Typography>
          ) : (
            <Badge variant="secondary">
              {t("dashboard.pipeline.winRate", { value: pipeline.winRatePercentage })}
            </Badge>
          )}
          <DashboardHint label={t("dashboard.pipeline.winRateHint")} />
        </div>
        <Meter
          label={t("dashboard.pipeline.meterLabel")}
          segments={pipeline.stages.map((stage) => ({
            id: stage.id,
            value: stage.count,
            className: pipelineStagePresentation[stage.id].swatchClassName
          }))}
        />
        <MeterLegend>
          {pipeline.stages.map((stage) => (
            <MeterLegendItem
              key={stage.id}
              swatchClassName={pipelineStagePresentation[stage.id].swatchClassName}
              label={t(`dashboard.pipeline.stages.${stage.id}`)}
              value={formatNumber(stage.count, locale)}
              detail={t("dashboard.percentage", { value: stage.sharePercentage })}
            />
          ))}
        </MeterLegend>
      </CardContent>
    </Card>
  )
}

export { PipelineCard }
