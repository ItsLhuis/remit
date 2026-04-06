import { type ComponentProps } from "react"

import { cn } from "@/lib/utils"

import { Slot } from "radix-ui"

import { Icon } from "@/components/ui/Icon"

const Breadcrumb = ({ className, ...props }: ComponentProps<"nav">) => (
  <nav aria-label="breadcrumb" data-slot="breadcrumb" className={cn(className)} {...props} />
)

const BreadcrumbList = ({ className, ...props }: ComponentProps<"ol">) => (
  <ol
    data-slot="breadcrumb-list"
    className={cn(
      "flex flex-wrap items-center gap-1.5 text-sm wrap-break-word text-muted-foreground",
      className
    )}
    {...props}
  />
)

const BreadcrumbItem = ({ className, ...props }: ComponentProps<"li">) => (
  <li
    data-slot="breadcrumb-item"
    className={cn("inline-flex items-center gap-1", className)}
    {...props}
  />
)

const BreadcrumbLink = ({
  asChild,
  className,
  ...props
}: ComponentProps<"a"> & {
  asChild?: boolean
}) => {
  const Comp = asChild ? Slot.Root : "a"

  return (
    <Comp
      data-slot="breadcrumb-link"
      className={cn("transition-colors hover:text-foreground", className)}
      {...props}
    />
  )
}

const BreadcrumbPage = ({ className, ...props }: ComponentProps<"span">) => (
  <span
    data-slot="breadcrumb-page"
    role="link"
    aria-disabled="true"
    aria-current="page"
    className={cn("font-normal text-foreground", className)}
    {...props}
  />
)

const BreadcrumbSeparator = ({ children, className, ...props }: ComponentProps<"li">) => (
  <li
    data-slot="breadcrumb-separator"
    role="presentation"
    aria-hidden="true"
    className={cn("[&>svg]:size-3.5", className)}
    {...props}
  >
    {children ?? <Icon name="ChevronRight" />}
  </li>
)

const BreadcrumbEllipsis = ({ className, ...props }: ComponentProps<"span">) => (
  <span
    data-slot="breadcrumb-ellipsis"
    role="presentation"
    aria-hidden="true"
    className={cn("flex size-5 items-center justify-center [&>svg]:size-4", className)}
    {...props}
  >
    <Icon name="MoreHorizontal" />
    <span className="sr-only">More</span>
  </span>
)

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis
}
