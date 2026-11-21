"use client"

import { Typography } from "@/components/ui"

type ProposalTotalsRowProps = {
  label: string
  value: string
  emphasis?: boolean
}

const ProposalTotalsRow = ({ label, value, emphasis }: ProposalTotalsRowProps) => (
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

export { ProposalTotalsRow }
