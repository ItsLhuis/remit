"use client"

import { ChartEmpty, Typography } from "@/components/ui"

// The indigo ramp, deepest first, so the largest segment reads as the strongest voice and the rest
// step down from it. Segments never carry semantic colour; none of them is a state.
const BREAKDOWN_RAMP = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"]

export type TemplateBreakdownItem = {
  key: string
  label: string
  value: number
}

type TemplateBreakdownProps = {
  items: TemplateBreakdownItem[]
  emptyLabel: string
}

const TemplateBreakdown = ({ items, emptyLabel }: TemplateBreakdownProps) => {
  const total = items.reduce((sum, item) => sum + item.value, 0)

  if (total === 0) return <ChartEmpty label={emptyLabel} />

  return (
    <div className="mt-auto flex flex-col gap-2">
      <div className="bg-muted flex h-2 overflow-hidden rounded-full" aria-hidden="true">
        {items.map((item, index) =>
          item.value > 0 ? (
            <div
              key={item.key}
              className="h-full"
              style={{
                width: `${(item.value / total) * 100}%`,
                backgroundColor: BREAKDOWN_RAMP[index % BREAKDOWN_RAMP.length]
              }}
            />
          ) : null
        )}
      </div>
      <ul className="flex flex-col gap-1">
        {items.map((item, index) => (
          <li key={item.key} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: BREAKDOWN_RAMP[index % BREAKDOWN_RAMP.length] }}
                aria-hidden="true"
              />
              <Typography affects={["muted", "tiny"]} className="truncate">
                {item.label}
              </Typography>
            </span>
            <Typography affects={["tiny"]} className="font-mono font-medium tabular-nums">
              {item.value}
            </Typography>
          </li>
        ))}
      </ul>
    </div>
  )
}

export { TemplateBreakdown }
