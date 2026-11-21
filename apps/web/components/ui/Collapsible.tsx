import { type ComponentProps } from "react"

import { Collapsible as CollapsiblePrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

const Collapsible = ({ ...props }: ComponentProps<typeof CollapsiblePrimitive.Root>) => (
  <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
)

const CollapsibleTrigger = ({
  ...props
}: ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) => (
  <CollapsiblePrimitive.CollapsibleTrigger data-slot="collapsible-trigger" {...props} />
)

const CollapsibleContent = ({
  className,
  children,
  ...props
}: ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) => (
  <CollapsiblePrimitive.CollapsibleContent
    data-slot="collapsible-content"
    className={cn(
      "overflow-hidden",
      "data-[state=open]:animate-collapsible-down",
      "data-[state=closed]:animate-collapsible-up",
      className
    )}
    style={{ animationTimingFunction: "cubic-bezier(0.25, 0, 0, 1)" }}
    {...props}
  >
    {children}
  </CollapsiblePrimitive.CollapsibleContent>
)

export { Collapsible, CollapsibleContent, CollapsibleTrigger }
