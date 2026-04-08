import { type ComponentType } from "react"

import { cn } from "@/lib/utils"

import * as LucideIcons from "lucide-react"
import { type LucideProps } from "lucide-react"

export type IconProps = LucideProps & {
  name: keyof typeof LucideIcons
  isFilled?: boolean
}

const Icon = ({ name, isFilled = false, className, ...props }: IconProps) => {
  const LucideIcon = (LucideIcons[name] ?? LucideIcons["Info"]) as ComponentType<LucideProps>

  return (
    <LucideIcon
      data-slot="icon"
      className={cn("size-4 transition-all", isFilled && "fill-current", className)}
      {...props}
    />
  )
}

export { Icon }
