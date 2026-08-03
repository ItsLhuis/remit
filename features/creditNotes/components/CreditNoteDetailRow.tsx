"use client"

import { Typography } from "@/components/ui"

type CreditNoteDetailRowProps = {
  label: string
  value: string
  mono?: boolean
  emphasis?: boolean
}

const CreditNoteDetailRow = ({ label, value, mono, emphasis }: CreditNoteDetailRowProps) => (
  <div className="flex items-baseline justify-between gap-4">
    <Typography affects={emphasis ? ["small", "medium"] : ["muted", "small"]}>{label}</Typography>
    <span
      className={
        emphasis
          ? "font-mono text-base font-semibold tabular-nums"
          : mono
            ? "font-mono text-sm tabular-nums"
            : "text-sm"
      }
    >
      {value}
    </span>
  </div>
)

export { CreditNoteDetailRow }
