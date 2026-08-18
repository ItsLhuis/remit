import { type ComponentProps, type ReactNode } from "react"

import { cn } from "@/lib/utils"

import { Typography } from "@/components/ui/Typography"

type MeterSegment = {
  id: string
  value: number
  // The colour token class for this segment. Callers own it because the meaning of a segment is
  // theirs: an aging bucket is a semantic state, a pipeline stage is a step on the indigo ramp.
  className: string
}

type MeterProps = ComponentProps<"div"> & {
  segments: readonly MeterSegment[]
  label: string
}

// One horizontal bar whose segments are sized by share. It is `role="img"` with a single label
// rather than a set of hoverable regions: the same numbers are rendered as focusable rows in
// `MeterLegend` beneath it, so the keyboard and screen-reader path is a list rather than a strip of
// tab stops that announce nothing but a colour.
//
// A zero-valued segment renders nothing at all rather than a hairline sliver, so an empty bucket
// reads as absent instead of as a rounding error.
const Meter = ({ segments, label, className, ...props }: MeterProps) => {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)

  return (
    <div
      data-slot="meter"
      role="img"
      aria-label={label}
      className={cn(
        "bg-muted flex h-2 w-full min-w-0 gap-0.5 overflow-hidden rounded-full",
        className
      )}
      {...props}
    >
      {total === 0
        ? null
        : segments.map((segment) =>
            segment.value === 0 ? null : (
              <span
                key={segment.id}
                data-slot="meter-segment"
                className={cn("h-full first:rounded-l-full last:rounded-r-full", segment.className)}
                style={{ width: `${(segment.value / total) * 100}%` }}
              />
            )
          )}
    </div>
  )
}

// Two columns once the legend's own box is wide enough, not once the window is. A legend inside a
// two-fifths column on a wide desktop is narrower than the same legend on a phone, so a viewport
// breakpoint would give the desktop the cramped layout and the phone the roomy one.
const MeterLegend = ({ className, ...props }: ComponentProps<"ul">) => (
  <div className="@container/meter-legend min-w-0">
    <ul
      data-slot="meter-legend"
      className={cn("grid gap-x-4 gap-y-2 @md/meter-legend:grid-cols-2", className)}
      {...props}
    />
  </div>
)

type MeterLegendItemProps = {
  swatchClassName: string
  label: string
  value: string
  detail: string
  children?: ReactNode
}

// The label truncates and the figures never do. A clipped category name is recoverable from the bar
// beside it; a clipped amount is a wrong number.
const MeterLegendItem = ({
  swatchClassName,
  label,
  value,
  detail,
  children
}: MeterLegendItemProps) => (
  <li data-slot="meter-legend-item" className="flex min-w-0 items-center gap-2">
    <span className={cn("size-2 shrink-0 rounded-full", swatchClassName)} aria-hidden="true" />
    <Typography affects={["small", "medium"]} className="min-w-0 flex-1 truncate">
      {label}
    </Typography>
    <span className="shrink-0 font-mono text-sm tabular-nums">{value}</span>
    <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">{detail}</span>
    {children}
  </li>
)

export { Meter, MeterLegend, MeterLegendItem }
