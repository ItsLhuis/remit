"use client"

import { useTranslation } from "@/lib/i18n"

import { ActivityTimeline } from "@/components/ui"

import { useActivityTimelineItems } from "../hooks"
import { type EntityActivityPanelData } from "../types"

type EntityActivityTimelineProps = {
  data: EntityActivityPanelData
}

const EntityActivityTimeline = ({ data }: EntityActivityTimelineProps) => {
  const { t } = useTranslation()

  const items = useActivityTimelineItems({
    entries: data.entries,
    locale: data.locale,
    timeZone: data.timeZone
  })

  return (
    <ActivityTimeline
      items={items}
      emptyTitle={t("activity.timeline.emptyTitle")}
      emptyDescription={t("activity.timeline.emptyDescription")}
    />
  )
}

export { EntityActivityTimeline }
