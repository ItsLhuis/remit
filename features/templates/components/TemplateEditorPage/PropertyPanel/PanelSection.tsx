"use client"

import { type ReactNode } from "react"

import { Collapsible, CollapsibleContent, CollapsibleTrigger, Icon } from "@/components/ui"

type PanelSectionProps = {
  label: string
  defaultOpen?: boolean
  children: ReactNode
}

const PanelSection = ({ label, defaultOpen = true, children }: PanelSectionProps) => {
  return (
    <Collapsible defaultOpen={defaultOpen} className="group/panel-section border-border border-b">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex w-full cursor-pointer items-center justify-between px-4 py-3 text-[10px] font-semibold tracking-[0.08em] uppercase focus-visible:ring-[3px] focus-visible:outline-none">
        {label}
        <Icon
          name="ChevronDown"
          aria-hidden="true"
          className="size-3.5 transition-transform group-data-[state=closed]/panel-section:-rotate-90"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-2.5 px-4 pb-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export { PanelSection }
