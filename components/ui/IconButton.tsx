"use client"

import { type ComponentProps, type ReactNode } from "react"

import { Button } from "@/components/ui/Button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip"

type IconButtonSize = Extract<
  ComponentProps<typeof Button>["size"],
  "icon" | "icon-xs" | "icon-sm" | "icon-lg"
>

// `asChild` is excluded rather than forwarded: this component always renders a second child — the
// `sr-only` label — so a slotted `Button` would hand two children to `React.Children.only` and throw
// at render. A link that needs an icon button's look uses `Button asChild` directly.
type IconButtonProps = Omit<ComponentProps<typeof Button>, "asChild" | "children" | "size"> & {
  children: ReactNode
  label: string
  tooltip?: string
  size?: IconButtonSize
}

const IconButton = ({
  children,
  label,
  tooltip,
  size = "icon",
  type = "button",
  variant = "ghost",
  ...props
}: IconButtonProps) => {
  const content = tooltip ?? label

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button {...props} type={type} variant={variant} size={size} aria-label={label}>
          {children}
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{content}</TooltipContent>
    </Tooltip>
  )
}

export { IconButton }
