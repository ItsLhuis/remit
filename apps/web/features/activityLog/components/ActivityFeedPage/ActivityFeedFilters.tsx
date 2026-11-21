"use client"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Icon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui"

import { activityEntityTypeLabelKeys } from "../../labels"
import {
  ACTIVITY_ENTITY_TYPES,
  type ActivityEntityType,
  type ActivityReadFilter
} from "../../schemas"

// The Radix select has no value for "no filter" — an empty string closes it with nothing selected —
// so the "all types" row carries this sentinel and the handler maps it back to null.
const ALL_ENTITY_TYPES = "all"

type ActivityFeedFiltersProps = {
  entityType: ActivityEntityType | null
  read: ActivityReadFilter
  hasActiveFilters: boolean
  onEntityTypeChange: (next: ActivityEntityType | null) => void
  onReadChange: (next: ActivityReadFilter) => void
  onReset: () => void
}

const ActivityFeedFilters = ({
  entityType,
  read,
  hasActiveFilters,
  onEntityTypeChange,
  onReadChange,
  onReset
}: ActivityFeedFiltersProps) => {
  const { t } = useTranslation()

  const isUnreadOnly = read === "unread"

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={entityType ?? ALL_ENTITY_TYPES}
        onValueChange={(value) =>
          onEntityTypeChange(value === ALL_ENTITY_TYPES ? null : (value as ActivityEntityType))
        }
      >
        <SelectTrigger className="w-44" aria-label={t("activity.filters.entityType")}>
          <SelectValue placeholder={t("activity.filters.allEntityTypes")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_ENTITY_TYPES}>{t("activity.filters.allEntityTypes")}</SelectItem>
          {ACTIVITY_ENTITY_TYPES.map((value) => (
            <SelectItem key={value} value={value}>
              {t(activityEntityTypeLabelKeys[value])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant={isUnreadOnly ? "default" : "outline"}
        aria-pressed={isUnreadOnly}
        onClick={() => onReadChange(isUnreadOnly ? "all" : "unread")}
      >
        <Icon name="Dot" aria-hidden="true" />
        {t("activity.filters.unreadOnly")}
      </Button>
      {hasActiveFilters ? (
        <Button type="button" variant="ghost" onClick={onReset}>
          <Icon name="X" aria-hidden="true" />
          {t("activity.filters.reset")}
        </Button>
      ) : null}
    </div>
  )
}

export { ActivityFeedFilters }
