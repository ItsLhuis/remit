"use client"

import { useTranslation } from "@/lib/i18n"

import { Badge, Icon } from "@/components/ui"

import { timeEntrySourcePresentation } from "../labels"
import { type TimeEntrySource } from "../schemas"

type TimeEntrySourceBadgeProps = {
  source: TimeEntrySource
}

const TimeEntrySourceBadge = ({ source }: TimeEntrySourceBadgeProps) => {
  const { t } = useTranslation()

  const presentation = timeEntrySourcePresentation[source]

  return (
    <Badge variant={presentation.variant}>
      <Icon name={presentation.icon} aria-hidden="true" />
      {t(`timeTracking.source.${source}`)}
    </Badge>
  )
}

export { TimeEntrySourceBadge }
