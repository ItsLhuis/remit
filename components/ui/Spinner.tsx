import { type ComponentProps } from "react"

import { cn } from "@/lib/utils"

import { Icon } from "@/components/ui/Icon"

const Spinner = ({ className, ...props }: ComponentProps<"svg">) => {
  return (
    <Icon
      name="Loader2"
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
