"use client"

import { Typography } from "@/components/ui"

type ProposalDetailRowProps = {
  label: string
  value: string
  mono?: boolean
}

const ProposalDetailRow = ({ label, value, mono }: ProposalDetailRowProps) => (
  <div className="flex items-baseline justify-between gap-4">
    <Typography affects={["muted", "small"]}>{label}</Typography>
    <span className={mono ? "font-mono text-sm tabular-nums" : "text-sm"}>{value}</span>
  </div>
)

export { ProposalDetailRow }
