"use client"

import { useTranslation } from "@/lib/i18n"

import { formatDate } from "@/lib/utils"

import { Icon, Typography } from "@/components/ui"

import { type PurgeSchedule } from "../../services"

type PurgeScheduleCellProps = {
  schedule: PurgeSchedule
  locale: string
  timeZone: string
}

const PurgeScheduleCell = ({ schedule, locale, timeZone }: PurgeScheduleCellProps) => {
  const { t } = useTranslation()

  switch (schedule.status) {
    case "scheduled":
      return (
        <div className="flex flex-col gap-0.5">
          <Typography affects={["muted", "small"]}>
            {formatDate(schedule.dueAt, { locale, timeZone })}
          </Typography>
          {schedule.heldByDocuments ? (
            <Typography affects={["muted", "tiny"]}>{t("trash.purge.heldByDocuments")}</Typography>
          ) : null}
        </div>
      )
    case "windowUnset":
      return <Typography affects={["muted", "small"]}>{t("trash.purgeNever")}</Typography>
    case "heldByLiveDocuments":
      return (
        <div className="flex items-start gap-1.5">
          <Icon name="Clock" className="text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
          <Typography affects={["muted", "small"]}>
            {t("trash.purge.heldByLiveDocuments", { count: schedule.documentCount })}
          </Typography>
        </div>
      )
    case "never":
      return (
        <div className="flex items-start gap-1.5">
          <Icon name="Lock" className="text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <Typography affects={["small", "medium"]}>{t("trash.purge.never")}</Typography>
            <Typography affects={["muted", "tiny"]}>
              {schedule.reason === "countersigned"
                ? t("trash.purge.countersigned")
                : t("trash.purge.countersignedContractNamesClient")}
            </Typography>
          </div>
        </div>
      )
  }
}

export { PurgeScheduleCell }
