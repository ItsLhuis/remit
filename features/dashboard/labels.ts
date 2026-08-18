import { type ComponentProps } from "react"

import { type Badge, type Icon } from "@/components/ui"

import {
  type AgingBucketId,
  type AttentionKind,
  type AttentionSeverity,
  type LifecycleStageId,
  type PipelineStageId
} from "./services"

type IconName = ComponentProps<typeof Icon>["name"]
type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>

// Receivable age is a state, not a category, so the three late buckets take the semantic warning and
// error tokens rather than a step of the indigo ramp — "Error: overdue" is the token's stated job in
// DESIGN.md. The two error buckets separate by tint depth, and every segment carries its own label,
// amount and count in the legend beneath the bar, so nothing here is conveyed by colour alone.
export const agingBucketPresentation: Record<AgingBucketId, { swatchClassName: string }> = {
  notDue: { swatchClassName: "bg-chart-2" },
  days1To30: { swatchClassName: "bg-warning" },
  days31To60: { swatchClassName: "bg-error/60" },
  days61Plus: { swatchClassName: "bg-error" }
}

// Two representations of one colour because they are consumed differently: recharts takes a `fill`
// string on a `Cell`, and the legend beside it takes a Tailwind class. They must stay in step, so a
// stage's swatch and its bar can never disagree about which colour it is.
export const lifecycleStagePresentation: Record<
  LifecycleStageId,
  { icon: IconName; colorVariable: string; swatchClassName: string }
> = {
  draft: {
    icon: "FilePen",
    colorVariable: "var(--muted-foreground)",
    swatchClassName: "bg-muted-foreground"
  },
  sent: { icon: "Send", colorVariable: "var(--chart-2)", swatchClassName: "bg-chart-2" },
  viewed: { icon: "Eye", colorVariable: "var(--chart-4)", swatchClassName: "bg-chart-4" },
  overdue: {
    icon: "TriangleAlert",
    colorVariable: "var(--error)",
    swatchClassName: "bg-error"
  },
  paid: { icon: "CircleCheck", colorVariable: "var(--success)", swatchClassName: "bg-success" }
}

// The lead funnel is an ordered set of steps, not a set of states, so it walks the indigo ramp from
// light to deep and takes semantic colour only at the two terminal outcomes.
export const pipelineStagePresentation: Record<PipelineStageId, { swatchClassName: string }> = {
  new: { swatchClassName: "bg-chart-1" },
  contacted: { swatchClassName: "bg-chart-2" },
  qualified: { swatchClassName: "bg-chart-3" },
  proposal_sent: { swatchClassName: "bg-chart-4" },
  won: { swatchClassName: "bg-success" },
  lost: { swatchClassName: "bg-muted-foreground" }
}

export const attentionKindPresentation: Record<AttentionKind, { icon: IconName }> = {
  invoiceOverdue: { icon: "TriangleAlert" },
  invoiceUnviewed: { icon: "EyeOff" },
  proposalExpiring: { icon: "CalendarClock" },
  proposalStale: { icon: "Hourglass" },
  contractUnsigned: { icon: "FileSignature" },
  taskDue: { icon: "ListChecks" }
}

export const attentionSeverityVariant: Record<AttentionSeverity, BadgeVariant> = {
  error: "destructive",
  warning: "warning",
  info: "secondary"
}
