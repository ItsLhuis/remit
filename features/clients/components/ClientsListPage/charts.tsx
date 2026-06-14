"use client"

import { Area, AreaChart, Bar, BarChart, XAxis, YAxis } from "recharts"

import { formatMonthShort } from "@/lib/utils"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from "@/components/ui"

import { type ClientsSummary } from "../../services"

type TrendChartProps = {
  data: ClientsSummary["acquisitionTrend"]
  locale: string
  label: string
}

const GrowthAreaChart = ({ data, locale, label }: TrendChartProps) => {
  const config: ChartConfig = { totalClients: { label, color: "var(--chart-4)" } }

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
          dataKey="totalClients"
          type="monotone"
          stroke="var(--color-totalClients)"
          fill="var(--color-totalClients)"
          fillOpacity={0.12}
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}

const NewClientsBarChart = ({ data, locale, label }: TrendChartProps) => {
  const config: ChartConfig = { newClients: { label, color: "var(--chart-4)" } }

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
        <Bar dataKey="newClients" fill="var(--color-newClients)" radius={3} />
      </BarChart>
    </ChartContainer>
  )
}

export { GrowthAreaChart, NewClientsBarChart }
