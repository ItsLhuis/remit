"use client"

import { type ComponentProps } from "react"

import { useTranslation } from "@/lib/i18n"

import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"

const Pagination = ({ className, ...props }: ComponentProps<"nav">) => {
  const { t } = useTranslation()

  return (
    <nav
      aria-label={t("common.navigation.pagination")}
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  )
}

const PaginationContent = ({ className, ...props }: ComponentProps<"ul">) => (
  <ul
    data-slot="pagination-content"
    className={cn("flex items-center gap-0.5", className)}
    {...props}
  />
)

const PaginationItem = ({ ...props }: ComponentProps<"li">) => (
  <li data-slot="pagination-item" {...props} />
)

type PaginationLinkProps = {
  isActive?: boolean
} & ComponentProps<typeof Button>

const PaginationLink = ({ className, isActive, size = "icon", ...props }: PaginationLinkProps) => (
  <Button
    type="button"
    variant={isActive ? "outline" : "ghost"}
    size={size}
    aria-current={isActive ? "page" : undefined}
    data-slot="pagination-link"
    data-active={isActive}
    className={cn(className)}
    {...props}
  />
)

const PaginationEllipsis = ({ className, ...props }: ComponentProps<"span">) => {
  const { t } = useTranslation()

  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn(
        "flex size-8 items-center justify-center [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <Icon name="MoreHorizontal" />
      <span className="sr-only">{t("common.navigation.morePages")}</span>
    </span>
  )
}

export { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink }
