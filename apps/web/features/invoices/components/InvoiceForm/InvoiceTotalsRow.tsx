"use client"

import { Typography } from "@/components/ui"

type InvoiceTotalsRowProps = {
  label: string
  value: string
  emphasis?: boolean
}

const InvoiceTotalsRow = ({ label, value, emphasis }: InvoiceTotalsRowProps) => (
  <div className="flex items-baseline justify-between gap-4">
    <Typography affects={emphasis ? ["small", "medium"] : ["muted", "small"]}>{label}</Typography>
    <span
      className={
        emphasis
          ? "font-mono text-base font-semibold tabular-nums"
          : "text-muted-foreground font-mono text-sm tabular-nums"
      }
    >
      {value}
    </span>
  </div>
)

export { InvoiceTotalsRow }
