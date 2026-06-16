"use client"

import { Pie, PieChart } from "recharts"

import { useTranslation } from "@/lib/i18n"

import { formatCompactNumber } from "@/lib/utils"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
  Typography
} from "@/components/ui"

import { type ClientsSummary } from "../../services"

type HealthDonutProps = {
  distribution: ClientsSummary["healthDistribution"]
  total: number
  locale: string
}

const HealthDonut = ({ distribution, total, locale }: HealthDonutProps) => {
  const { t } = useTranslation()

  const config: ChartConfig = {
    owing: { label: t("clients.health.owing"), color: "var(--chart-5)" },
    settled: { label: t("clients.health.settled"), color: "var(--chart-3)" },
    dormant: { label: t("clients.health.dormant"), color: "var(--chart-1)" }
  }

  const segments = [
    {
      key: "owing",
      label: t("clients.health.owing"),
      value: distribution.owing,
      fill: "var(--chart-5)"
    },
    {
      key: "settled",
      label: t("clients.health.settled"),
      value: distribution.settled,
      fill: "var(--chart-3)"
    },
    {
      key: "dormant",
      label: t("clients.health.dormant"),
      value: distribution.dormant,
      fill: "var(--chart-1)"
    }
  ]

  if (total === 0) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-foreground text-2xl font-semibold tracking-tight">0</span>
        <Typography affects={["muted", "tiny"]}>{t("clients.summary.healthHint")}</Typography>
      </div>
    )
  }

  return (
    <div className="mt-auto flex items-center gap-4">
      <div className="relative shrink-0" aria-hidden="true">
        <ChartContainer config={config} className="aspect-square h-24 w-24">
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel nameKey="key" />}
            />
            <Pie
              data={segments}
              dataKey="value"
              nameKey="key"
              innerRadius={28}
              outerRadius={42}
              strokeWidth={2}
              paddingAngle={2}
            />
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-foreground text-lg font-semibold tabular-nums">
            {formatCompactNumber(total, locale)}
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
              <Typography affects={["muted", "tiny"]}>{segment.label}</Typography>
            </span>
            <span className="font-mono text-xs font-medium tabular-nums">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export { HealthDonut }
