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

type ReportsEmptyProps = {
  hasActiveFilters: boolean
  onReset: () => void
}

const ReportsEmpty = ({ hasActiveFilters, onReset }: ReportsEmptyProps) => {
  const { t } = useTranslation()

  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon name="ChartNoAxesColumn" aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>
          {hasActiveFilters ? t("reports.empty.filteredTitle") : t("reports.empty.title")}
        </EmptyTitle>
        <EmptyDescription>
          {hasActiveFilters
            ? t("reports.empty.filteredDescription")
            : t("reports.empty.description")}
        </EmptyDescription>
      </EmptyHeader>
      {hasActiveFilters ? (
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={onReset}>
            <Icon name="X" aria-hidden="true" />
            {t("reports.filters.reset")}
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  )
}

export { ReportsEmpty }
