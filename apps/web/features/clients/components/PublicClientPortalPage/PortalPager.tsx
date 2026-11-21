"use client"

import { usePathname, useSearchParams } from "next/navigation"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import { Button, Icon, Typography } from "@/components/ui"

import { type ClientPortalSection } from "../../schemas"

type PortalPagerProps = {
  section: ClientPortalSection
  page: number
  pageCount: number
  label: string
}

const PortalPager = ({ section, page, pageCount, label }: PortalPagerProps) => {
  const { t } = useTranslation()

  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (pageCount <= 1) return null

  const hrefFor = (target: number) => {
    const params = new URLSearchParams(searchParams.toString())

    params.set(section, String(target))

    return `${pathname}?${params.toString()}`
  }

  return (
    <nav aria-label={label} className="flex items-center justify-between gap-4 pt-3">
      <Typography affects={["muted", "small"]}>
        {t("clients.public.pager.page", { page, pageCount })}
      </Typography>
      <div className="flex gap-2">
        <PagerLink href={page > 1 ? hrefFor(page - 1) : null} icon="ChevronLeft">
          {t("clients.public.pager.previous")}
        </PagerLink>
        <PagerLink href={page < pageCount ? hrefFor(page + 1) : null} icon="ChevronRight">
          {t("clients.public.pager.next")}
        </PagerLink>
      </div>
    </nav>
  )
}

type PagerLinkProps = {
  href: string | null
  icon: "ChevronLeft" | "ChevronRight"
  children: string
}

// A link while there is somewhere to go, a disabled button at either end: a disabled anchor is not
// something a keyboard or a screen reader can be told is unavailable.
const PagerLink = ({ href, icon, children }: PagerLinkProps) => {
  if (!href) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Icon name={icon} aria-hidden="true" />
        {children}
      </Button>
    )
  }

  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href} scroll={false}>
        <Icon name={icon} aria-hidden="true" />
        {children}
      </Link>
    </Button>
  )
}

export { PortalPager }
