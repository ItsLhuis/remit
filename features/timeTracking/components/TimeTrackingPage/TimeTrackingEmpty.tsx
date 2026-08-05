"use client"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon
} from "@/components/ui"

type TimeTrackingEmptyProps = {
  hasNoEntries: boolean
  canLogTime: boolean
  onCreate: () => void
  onReset: () => void
}

const TimeTrackingEmpty = ({
  hasNoEntries,
  canLogTime,
  onCreate,
  onReset
}: TimeTrackingEmptyProps) => {
  const { t } = useTranslation()

  if (!hasNoEntries) {
    return (
      <Empty className="border-0 py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon name="SearchX" />
          </EmptyMedia>
          <EmptyTitle>{t("timeTracking.list.noMatchTitle")}</EmptyTitle>
          <EmptyDescription>{t("timeTracking.list.noMatchDescription")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={onReset}>
            {t("timeTracking.filters.reset")}
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <Empty className="border-0 py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon name="Clock" />
        </EmptyMedia>
        <EmptyTitle>{t("timeTracking.list.emptyTitle")}</EmptyTitle>
        <EmptyDescription>
          {canLogTime
            ? t("timeTracking.list.emptyDescription")
            : t("timeTracking.list.noProjectsDescription")}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onCreate} disabled={!canLogTime}>
          <Icon name="Plus" aria-hidden="true" />
          {t("timeTracking.actions.logManually")}
        </Button>
      </EmptyContent>
    </Empty>
  )
}

export { TimeTrackingEmpty }
