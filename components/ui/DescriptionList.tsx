import { type ComponentProps } from "react"

import { cn } from "@/lib/utils"

const DescriptionList = ({ className, ...props }: ComponentProps<"dl">) => (
  <dl data-slot="description-list" className={cn("flex flex-col gap-2", className)} {...props} />
)

const DescriptionItem = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="description-item"
    className={cn("flex items-baseline justify-between gap-4", className)}
    {...props}
  />
)

const DescriptionTerm = ({ className, ...props }: ComponentProps<"dt">) => (
  <dt
    data-slot="description-term"
    className={cn("text-muted-foreground text-sm", className)}
    {...props}
  />
)

const DescriptionDetails = ({ className, ...props }: ComponentProps<"dd">) => (
  <dd data-slot="description-details" className={cn("m-0 text-sm", className)} {...props} />
)

export { DescriptionDetails, DescriptionItem, DescriptionList, DescriptionTerm }
