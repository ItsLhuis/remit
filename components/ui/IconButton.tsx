"use client"

import { type ComponentProps, type ReactNode } from "react"

import { Button } from "@/components/ui/Button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip"

type IconButtonSize = Extract<
  ComponentProps<typeof Button>["size"],
  "icon" | "icon-xs" | "icon-sm" | "icon-lg"
>

type IconButtonProps = Omit<ComponentProps<typeof Button>, "children" | "size"> & {
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
        </Button>
      </TooltipTrigger>
      <TooltipContent>{content}</TooltipContent>
    </Tooltip>
  )
}

export { IconButton }
