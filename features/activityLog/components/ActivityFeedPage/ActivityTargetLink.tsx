"use client"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import { Badge, Button, Icon } from "@/components/ui"

import { type ActivityTarget } from "../../services"

type ActivityTargetLinkProps = {
  target: ActivityTarget
}

const ActivityTargetLink = ({ target }: ActivityTargetLinkProps) => {
  const { t } = useTranslation()

  switch (target.state) {
    case "live":
      return (
        <Button asChild variant="ghost" size="icon-sm">
          <Link href={target.href} aria-label={t("activity.feed.open")}>
            <Icon name="ArrowUpRight" aria-hidden="true" />
          </Link>
        </Button>
      )
    case "trashed":
      return (
        <>
          <Badge variant="secondary">{t("activity.feed.deletedBadge")}</Badge>
          {target.href ? (
            <Button asChild variant="ghost" size="icon-sm">
              <Link href={target.href} aria-label={t("activity.feed.openInTrash")}>
                <Icon name="ArchiveRestore" aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
        </>
      )
    case "gone":
      return <Badge variant="secondary">{t("activity.feed.purgedBadge")}</Badge>
  }
}

export { ActivityTargetLink }
