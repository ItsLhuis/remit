"use client"

import { Area, AreaChart, Bar, BarChart, XAxis, YAxis } from "recharts"

import { formatCurrency, formatMonthShort } from "@/lib/utils"

import {
  ChartContainer,
  ChartEmpty,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from "@/components/ui"

import { type ClientBillingPoint } from "../../services"

type TrendChartProps = {
  data: ClientBillingPoint[]
  locale: string
  label: string
  emptyLabel: string
}

type CountBarChartProps = TrendChartProps & {
  dataKey: "invoiceCount" | "projectCount" | "recurringCount"
}

const BilledAreaChart = ({
  data,
  locale,
  currency,
  label,
  emptyLabel
}: TrendChartProps & { currency: string }) => {
  if (!data.some((point) => point.billedCents > 0)) return <ChartEmpty label={emptyLabel} />

  const config: ChartConfig = { billedCents: { label, color: "var(--chart-4)" } }

  return (
    <ChartContainer config={config} className="mt-auto aspect-auto h-14 w-full" aria-hidden="true">
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey="month" hide />
        <YAxis hide domain={[0, "dataMax"]} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(value) => formatMonthShort(String(value), locale)}
              formatter={(value) => formatCurrency(Number(value), currency, locale)}
            />
          }
        />
        <Area
          dataKey="billedCents"
          type="monotone"
          stroke="var(--color-billedCents)"
          fill="var(--color-billedCents)"
          fillOpacity={0.12}
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}

const CountBarChart = ({ data, locale, label, emptyLabel, dataKey }: CountBarChartProps) => {
  if (!data.some((point) => point[dataKey] > 0)) return <ChartEmpty label={emptyLabel} />

  const config: ChartConfig = { [dataKey]: { label, color: "var(--chart-4)" } }

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
        <Bar dataKey={dataKey} fill={`var(--color-${dataKey})`} radius={3} />
      </BarChart>
    </ChartContainer>
  )
}

const InvoiceBarChart = (props: TrendChartProps) => (
  <CountBarChart {...props} dataKey="invoiceCount" />
)

const ProjectBarChart = (props: TrendChartProps) => (
  <CountBarChart {...props} dataKey="projectCount" />
)

const RecurringBarChart = (props: TrendChartProps) => (
  <CountBarChart {...props} dataKey="recurringCount" />
)

export { BilledAreaChart, InvoiceBarChart, ProjectBarChart, RecurringBarChart }
