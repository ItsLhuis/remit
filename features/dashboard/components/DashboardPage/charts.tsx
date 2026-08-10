"use client"

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import { formatCurrency, formatMonthShort } from "@/lib/utils"

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
}

// Two steps of the one indigo ramp rather than two hues (DESIGN.md, Single Voice). The chart is
// `aria-hidden` because CashflowCard renders the same twelve months as a visually hidden table:
// recharts emits no accessible structure worth reading, and a table is a better answer than a
// summary string for twelve paired figures.
const CashflowChart = ({
  data,
  locale,
  currency,
  revenueLabel,
  expenseLabel
}: CashflowChartProps) => {
  const config: ChartConfig = {
    revenueCents: { label: revenueLabel, color: "var(--chart-2)" },
    expenseCents: { label: expenseLabel, color: "var(--chart-5)" }
  }

  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full" aria-hidden="true">
      <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
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
      </BarChart>
    </ChartContainer>
  )
}

export { CashflowChart }
