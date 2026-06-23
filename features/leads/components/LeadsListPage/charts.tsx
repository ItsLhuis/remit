"use client"

import { Area, AreaChart, Bar, BarChart, Pie, PieChart, XAxis, YAxis } from "recharts"

import { useTranslation } from "@/lib/i18n"

import { formatMonthShort } from "@/lib/utils"

import {
  ChartContainer,
  ChartEmpty,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
  Typography
} from "@/components/ui"

import { type LeadsSummary } from "../../services"

type TrendChartProps = {
  data: LeadsSummary["acquisitionTrend"]
  locale: string
  label: string
  emptyLabel: string
}

const GrowthAreaChart = ({ data, locale, label, emptyLabel }: TrendChartProps) => {
  if (!data.some((point) => point.totalLeads > 0)) return <ChartEmpty label={emptyLabel} />

  const config: ChartConfig = { totalLeads: { label, color: "var(--chart-4)" } }

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
          dataKey="totalLeads"
          type="monotone"
          stroke="var(--color-totalLeads)"
          fill="var(--color-totalLeads)"
          fillOpacity={0.12}
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}

const NewLeadsBarChart = ({ data, locale, label, emptyLabel }: TrendChartProps) => {
  if (!data.some((point) => point.newLeads > 0)) return <ChartEmpty label={emptyLabel} />

  const config: ChartConfig = { newLeads: { label, color: "var(--chart-4)" } }

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
        <Bar dataKey="newLeads" fill="var(--color-newLeads)" radius={3} />
      </BarChart>
    </ChartContainer>
  )
}

type WonRateDonutProps = {
  won: number
  lost: number
}

const WonRateDonut = ({ won, lost }: WonRateDonutProps) => {
  const { t } = useTranslation()

  const total = won + lost

  if (total === 0) return <ChartEmpty label={t("common.chart.noData")} />

  const config: ChartConfig = {
    won: { label: t("leads.status.won"), color: "var(--chart-3)" },
    lost: { label: t("leads.status.lost"), color: "var(--chart-5)" }
  }

  const segments = [
    { key: "won", value: won, fill: "var(--chart-3)" },
    { key: "lost", value: lost, fill: "var(--chart-5)" }
  ]

  const wonPct = Math.round((won / total) * 100)

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
          <Typography className="text-foreground text-sm font-semibold tabular-nums">
            {wonPct}%
          </Typography>
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
            <Typography affects={["tiny"]} className="font-mono font-medium tabular-nums">
              {segment.value}
            </Typography>
          </li>
        ))}
      </ul>
    </div>
  )
}

type ConversionDonutProps = {
  converted: number
  total: number
}

const ConversionDonut = ({ converted, total }: ConversionDonutProps) => {
  const { t } = useTranslation()

  if (total === 0) return <ChartEmpty label={t("common.chart.noData")} />

  const notConverted = total - converted

  const config: ChartConfig = {
    converted: { label: t("leads.summary.converted"), color: "var(--chart-3)" },
    notConverted: { label: t("leads.detail.convertedNo"), color: "var(--chart-1)" }
  }

  const segments = [
    { key: "converted", value: converted, fill: "var(--chart-3)" },
    { key: "notConverted", value: notConverted, fill: "var(--chart-1)" }
  ]

  const convPct = Math.round((converted / total) * 100)

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
          <Typography className="text-foreground text-sm font-semibold tabular-nums">
            {convPct}%
          </Typography>
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
            <Typography affects={["tiny"]} className="font-mono font-medium tabular-nums">
              {segment.value}
            </Typography>
          </li>
        ))}
      </ul>
    </div>
  )
}

export { GrowthAreaChart, NewLeadsBarChart, WonRateDonut, ConversionDonut }
