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
} & Pick<ComponentProps<typeof Button>, "size"> &
  ComponentProps<"a">

const PaginationLink = ({ className, isActive, size = "icon", ...props }: PaginationLinkProps) => (
  <Button asChild variant={isActive ? "outline" : "ghost"} size={size} className={cn(className)}>
    <a
      aria-current={isActive ? "page" : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      {...props}
    />
  </Button>
)

const PaginationPrevious = ({
  className,
  text,
  ...props
}: ComponentProps<typeof PaginationLink> & { text?: string }) => {
  const { t } = useTranslation()

  return (
    <PaginationLink
      aria-label={t("common.navigation.goToPreviousPage")}
      size="default"
      className={cn("pl-1.5!", className)}
      {...props}
    >
      <Icon name="ChevronLeft" data-icon="inline-start" />
      <span className="hidden sm:block">{text ?? t("common.actions.previous")}</span>
    </PaginationLink>
  )
}

const PaginationNext = ({
  className,
  text,
  ...props
}: ComponentProps<typeof PaginationLink> & { text?: string }) => {
  const { t } = useTranslation()

  return (
    <PaginationLink
      aria-label={t("common.navigation.goToNextPage")}
      size="default"
      className={cn("pr-1.5!", className)}
      {...props}
    >
      <span className="hidden sm:block">{text ?? t("common.actions.next")}</span>
      <Icon name="ChevronRight" data-icon="inline-end" />
    </PaginationLink>
  )
}

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

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
}
