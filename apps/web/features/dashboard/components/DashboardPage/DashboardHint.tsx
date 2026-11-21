"use client"

import { Icon, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui"

type DashboardHintProps = {
  label: string
}

// The one place an ambiguous figure explains itself. Every derived, estimated or fixed-window number
// on this page carries one, per the hidden-UI rule that a finished dashboard tooltips every
// ambiguous label. It is a real `button` so the explanation is reachable by keyboard and not only by
// hover; `type="button"` because several of these sit inside card headers that could be forms later.
const DashboardHint = ({ label }: DashboardHintProps) => (
  <Tooltip>
    <TooltipTrigger
      type="button"
      aria-label={label}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded-sm transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
    >
      <Icon name="Info" className="size-3.5" aria-hidden="true" />
    </TooltipTrigger>
    <TooltipContent className="max-w-64">{label}</TooltipContent>
  </Tooltip>
)

export { DashboardHint }
