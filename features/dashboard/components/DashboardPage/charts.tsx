"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis
} from "recharts"

import { formatCompactCurrency, formatCurrency, formatMonthShort } from "@/lib/utils"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from "@/components/ui"

import { type CashflowPoint } from "../../services"

type CashflowChartProps = {
  data: CashflowPoint[]
  locale: string
  currency: string
  revenueLabel: string
  expenseLabel: string
  netLabel: string
}

// Change over time, encoded as the FT Visual Vocabulary's "line + column": the two columns are the
// counted amounts that moved in and out of the account, and the line is the rate they netted to.
// Reading net as a third bar would invite it to be compared by area against the two it is derived
// from; a line sits in a different visual register and cannot be misread that way.
//
// Two steps of the one indigo ramp for the bars rather than two hues (DESIGN.md, Single Voice), with
// the net line on the deepest step. The chart is `aria-hidden` because CashflowCard renders the same
// twelve months as a visually hidden table: recharts emits no accessible structure worth reading,
// and a table is a better answer than a summary string for twelve paired figures.
const CashflowChart = ({
  data,
  locale,
  currency,
  revenueLabel,
  expenseLabel,
  netLabel
}: CashflowChartProps) => {
  const config: ChartConfig = {
    revenueCents: { label: revenueLabel, color: "var(--chart-2)" },
    expenseCents: { label: expenseLabel, color: "var(--chart-5)" },
    netCents: { label: netLabel, color: "var(--chart-4)" }
  }

  const points = data.map((point) => ({
    ...point,
    netCents: point.revenueCents - point.expenseCents
  }))

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full min-w-0" aria-hidden="true">
      <ComposedChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => formatMonthShort(String(value), locale)}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(value) => formatMonthShort(String(value), locale)}
              formatter={(value) => formatCurrency(Number(value), currency, locale)}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="revenueCents" fill="var(--color-revenueCents)" radius={3} />
        <Bar dataKey="expenseCents" fill="var(--color-expenseCents)" radius={3} />
        <Line
          dataKey="netCents"
          type="monotone"
          stroke="var(--color-netCents)"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ChartContainer>
  )
}

type MetricSparklineProps = {
  series: number[]
  label: string
}

// Change over time at its smallest useful size: no axes, no ticks, no tooltip. It exists to give the
// figure beside it a shape, and the exact monthly values are already carried by the cashflow card's
// hidden table, so adding a second reading of them here would be noise.
const MetricSparkline = ({ series, label }: MetricSparklineProps) => {
  const config: ChartConfig = { value: { label, color: "var(--chart-3)" } }

  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-8 w-full"
      initialDimension={{ width: 96, height: 32 }}
      aria-hidden="true"
    >
      <AreaChart
        data={series.map((value, index) => ({ index, value }))}
        margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
      >
        <Area
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={1.5}
          fill="var(--color-value)"
          fillOpacity={0.12}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}

type LifecycleChartPoint = {
  id: string
  label: string
  count: number
  cents: number
  color: string
}

type LifecycleChartProps = {
  data: LifecycleChartPoint[]
  locale: string
  currency: string
  countLabel: string
}

// Magnitude, so the FT vocabulary prescribes a bar starting at zero. Horizontal because the five
// stage names are words rather than dates and read straight across, and because the five cuts are
// not a sequence in time. Each bar takes its own stage colour from a `fill` key on its datum rather
// than one series colour, since the colours here are the semantic states in labels.ts, not a ramp.
const LifecycleChart = ({ data, locale, currency, countLabel }: LifecycleChartProps) => {
  const config: ChartConfig = { count: { label: countLabel } }

  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full min-w-0" aria-hidden="true">
      <BarChart
        data={data.map((point) => ({ ...point, fill: point.color }))}
        layout="vertical"
        margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={72}
          tickMargin={4}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value, _name, item) => {
                const point = item.payload as LifecycleChartPoint

                return `${value} · ${formatCurrency(point.cents, currency, locale)}`
              }}
            />
          }
        />
        <Bar dataKey="count" radius={3} barSize={18} />
      </BarChart>
    </ChartContainer>
  )
}

type ClientRankPoint = {
  clientId: string
  name: string
  revenueCents: number
}

type TopClientsChartProps = {
  data: ClientRankPoint[]
  locale: string
  currency: string
  revenueLabel: string
}

// Ranking: position in the ordered list is the reading, so the FT vocabulary's ordered bar applies
// and the rows arrive pre-sorted from `summarizeTopClients`. One ramp step for every bar, because
// the ranking is already carried by the order and a per-bar colour would imply a category that does
// not exist.
const TopClientsChart = ({ data, locale, currency, revenueLabel }: TopClientsChartProps) => {
  const config: ChartConfig = { revenueCents: { label: revenueLabel, color: "var(--chart-3)" } }

  return (
    <ChartContainer config={config} className="aspect-auto h-48 w-full min-w-0" aria-hidden="true">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
        <XAxis
          type="number"
          hide
          tickFormatter={(value) => formatCompactCurrency(Number(value), currency, locale)}
        />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={96}
          tickMargin={4}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value) => formatCurrency(Number(value), currency, locale)}
            />
          }
        />
        <Bar dataKey="revenueCents" fill="var(--color-revenueCents)" radius={3} barSize={14} />
      </BarChart>
    </ChartContainer>
  )
}

export { CashflowChart, LifecycleChart, MetricSparkline, TopClientsChart }
