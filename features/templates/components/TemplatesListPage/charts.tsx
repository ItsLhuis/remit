"use client"

import { Pie, PieChart } from "recharts"

import { useTranslation } from "@/lib/i18n"

import {
  ChartContainer,
  ChartEmpty,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
  Typography
} from "@/components/ui"

type DefaultCoverageDonutProps = {
  covered: number
  total: number
}

const DefaultCoverageDonut = ({ covered, total }: DefaultCoverageDonutProps) => {
  const { t } = useTranslation()

  if (total === 0) return <ChartEmpty label={t("common.chart.noData")} />

  const missing = total - covered

  const config: ChartConfig = {
    covered: { label: t("templates.summary.defaultsCovered"), color: "var(--chart-3)" },
    missing: { label: t("templates.summary.defaultsMissing"), color: "var(--chart-1)" }
  }

  const segments = [
    { key: "covered", value: covered, fill: "var(--chart-3)" },
    { key: "missing", value: missing, fill: "var(--chart-1)" }
  ]

  const coveredPct = Math.round((covered / total) * 100)

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
            {coveredPct}%
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

export { DefaultCoverageDonut }
