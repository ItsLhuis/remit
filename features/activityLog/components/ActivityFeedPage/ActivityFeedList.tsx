"use client"

import Link from "next/link"

import { useTranslation } from "@/lib/i18n"

import { ActivityTimeline, Badge, Button, Icon, IconButton } from "@/components/ui"

import { useActivityTimelineItems } from "../../hooks"
import { getActivityEntityHref } from "../../labels"
import { type ActivityEntry } from "../../types"

type ActivityFeedListProps = {
  entries: ActivityEntry[]
  locale: string
  timeZone: string
  hasActiveFilters: boolean
  isBusy: boolean
  onMarkRead: (id: string) => void
  onDelete: (id: string) => void
}

const ActivityFeedList = ({
  entries,
  locale,
  timeZone,
  hasActiveFilters,
  isBusy,
  onMarkRead,
  onDelete
}: ActivityFeedListProps) => {
  const { t } = useTranslation()

  const items = useActivityTimelineItems({
    entries,
    locale,
    timeZone,
    // The unread badge and the mark-read control are both only rendered for an unread row, so the
    // state is legible without relying on the accent ring the timeline draws around the node.
    renderActions: (entry) => (
      <>
        {entry.unread ? <Badge variant="secondary">{t("activity.feed.unreadBadge")}</Badge> : null}
        {entry.unread ? (
          <IconButton
            size="icon-sm"
            label={t("activity.feed.markRead")}
            disabled={isBusy}
            onClick={() => onMarkRead(entry.id)}
          >
            <Icon name="Check" aria-hidden="true" />
          </IconButton>
        ) : null}
        <Button asChild variant="ghost" size="icon-sm">
          <Link
            href={getActivityEntityHref(entry.entityType, entry.entityId)}
            aria-label={t("activity.feed.open")}
          >
            <Icon name="ArrowUpRight" aria-hidden="true" />
          </Link>
        </Button>
        <IconButton
          size="icon-sm"
          label={t("activity.feed.delete")}
          disabled={isBusy}
          onClick={() => onDelete(entry.id)}
        >
          <Icon name="Trash2" aria-hidden="true" />
        </IconButton>
      </>
    )
  })

  return (
    <ActivityTimeline
      items={items}
      emptyTitle={
        hasActiveFilters ? t("activity.feed.noMatchTitle") : t("activity.feed.emptyTitle")
      }
      emptyDescription={
        hasActiveFilters
          ? t("activity.feed.noMatchDescription")
          : t("activity.feed.emptyDescription")
      }
    />
  )
}

export { ActivityFeedList }
