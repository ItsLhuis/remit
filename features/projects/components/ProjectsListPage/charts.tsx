"use client"

import { Area, AreaChart, Bar, BarChart, Pie, PieChart, XAxis, YAxis } from "recharts"

import { useTranslation } from "@/lib/i18n"

import { formatMonthShort } from "@/lib/utils"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
  Typography
} from "@/components/ui"

import { type ProjectsSummary } from "../../services"

type TrendChartProps = {
  data: ProjectsSummary["acquisitionTrend"]
  locale: string
  label: string
}

const GrowthAreaChart = ({ data, locale, label }: TrendChartProps) => {
  const config: ChartConfig = { totalProjects: { label, color: "var(--chart-4)" } }

  return (
    <ChartContainer config={config} className="mt-auto aspect-auto h-14 w-full" aria-hidden="true">
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey="month" hide />
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(value) => formatMonthShort(String(value), locale)}
            />
          }
        />
        <Area
          dataKey="totalProjects"
          type="monotone"
          stroke="var(--color-totalProjects)"
          fill="var(--color-totalProjects)"
          fillOpacity={0.12}
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}

const NewProjectsBarChart = ({ data, locale, label }: TrendChartProps) => {
  const config: ChartConfig = { newProjects: { label, color: "var(--chart-4)" } }

  return (
    <ChartContainer config={config} className="mt-auto aspect-auto h-14 w-full" aria-hidden="true">
      <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey="month" hide />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(value) => formatMonthShort(String(value), locale)}
            />
          }
        />
        <Bar dataKey="newProjects" fill="var(--color-newProjects)" radius={3} />
      </BarChart>
    </ChartContainer>
  )
}

type StatusBreakdownDonutProps = {
  summary: ProjectsSummary
}

const StatusBreakdownDonut = ({ summary }: StatusBreakdownDonutProps) => {
  const { t } = useTranslation()

  const total = summary.active + summary.onHold + summary.completed + summary.cancelled

  if (total === 0) return null

  const config: ChartConfig = {
    active: { label: t("projects.status.active"), color: "var(--chart-3)" },
    onHold: { label: t("projects.status.on_hold"), color: "var(--chart-4)" },
    completed: { label: t("projects.status.completed"), color: "var(--chart-1)" },
    cancelled: { label: t("projects.status.cancelled"), color: "var(--chart-5)" }
  }

  const segments = [
    { key: "active", value: summary.active, fill: "var(--chart-3)" },
    { key: "onHold", value: summary.onHold, fill: "var(--chart-4)" },
    { key: "completed", value: summary.completed, fill: "var(--chart-1)" },
    { key: "cancelled", value: summary.cancelled, fill: "var(--chart-5)" }
  ].filter((segment) => segment.value > 0)

  return (
    <div className="mt-auto flex items-center gap-4" aria-hidden="true">
      <div className="relative shrink-0">
        <ChartContainer config={config} className="aspect-square h-20 w-20">
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel nameKey="key" />}
            />
            <Pie
              data={segments}
              dataKey="value"
              nameKey="key"
              innerRadius={22}
              outerRadius={36}
              strokeWidth={2}
              paddingAngle={2}
            />
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-foreground text-sm font-semibold tabular-nums">
            {summary.onHold}
          </span>
        </div>
      </div>
      <ul className="flex flex-1 flex-col gap-1.5">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: segment.fill }}
                aria-hidden="true"
              />
              <Typography affects={["muted", "tiny"]}>{config[segment.key]?.label}</Typography>
            </span>
            <span className="font-mono text-xs font-medium tabular-nums">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

type CompletionRateDonutProps = {
  completed: number
  total: number
}

const CompletionRateDonut = ({ completed, total }: CompletionRateDonutProps) => {
  const { t } = useTranslation()

  if (total === 0) return null

  const remaining = total - completed

  const config: ChartConfig = {
    completed: { label: t("projects.status.completed"), color: "var(--chart-3)" },
    remaining: { label: t("projects.summary.active"), color: "var(--chart-1)" }
  }

  const segments = [
    { key: "completed", value: completed, fill: "var(--chart-3)" },
    { key: "remaining", value: remaining, fill: "var(--chart-1)" }
  ]

  const completePct = Math.round((completed / total) * 100)

  return (
    <div className="mt-auto flex items-center gap-4" aria-hidden="true">
      <div className="relative shrink-0">
        <ChartContainer config={config} className="aspect-square h-20 w-20">
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel nameKey="key" />}
            />
            <Pie
              data={segments}
              dataKey="value"
              nameKey="key"
              innerRadius={22}
              outerRadius={36}
              strokeWidth={2}
              paddingAngle={2}
            />
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-foreground text-sm font-semibold tabular-nums">{completePct}%</span>
        </div>
      </div>
      <ul className="flex flex-1 flex-col gap-1.5">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: segment.fill }}
                aria-hidden="true"
              />
              <Typography affects={["muted", "tiny"]}>{config[segment.key]?.label}</Typography>
            </span>
            <span className="font-mono text-xs font-medium tabular-nums">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export { GrowthAreaChart, NewProjectsBarChart, StatusBreakdownDonut, CompletionRateDonut }
