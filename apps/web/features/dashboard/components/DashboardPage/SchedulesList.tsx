"use client"

import { useTranslation } from "@/lib/i18n"

import { formatDay } from "@/lib/utils"

import {
  Badge,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui"

import { type UpcomingSchedule } from "../../services"

import { DashboardCardEmpty } from "./DashboardCardEmpty"

type SchedulesListProps = {
  schedules: UpcomingSchedule[]
  locale: string
}

function toCadenceKey(cadence: string): "weekly" | "monthly" | "quarterly" | "yearly" {
  if (cadence === "weekly" || cadence === "quarterly" || cadence === "yearly") return cadence

  return "monthly"
}

const SchedulesList = ({ schedules, locale }: SchedulesListProps) => {
  const { t } = useTranslation()

  if (schedules.length === 0) {
    return (
      <DashboardCardEmpty
        icon="Repeat"
        title={t("dashboard.schedules.emptyTitle")}
        description={t("dashboard.schedules.emptyDescription")}
        action={{ label: t("dashboard.schedules.emptyAction"), href: "/recurring-invoices" }}
      />
    )
  }

  return (
    <Table>
      <TableCaption className="sr-only">{t("dashboard.schedules.description")}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{t("dashboard.schedules.nameColumn")}</TableHead>
          <TableHead>{t("dashboard.schedules.clientColumn")}</TableHead>
          <TableHead>{t("dashboard.schedules.cadenceColumn")}</TableHead>
          <TableHead className="text-right">{t("dashboard.schedules.nextRunColumn")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {schedules.map((schedule) => (
          <TableRow key={schedule.id}>
            <TableCell className="max-w-40 truncate font-medium">{schedule.name}</TableCell>
            <TableCell className="text-muted-foreground max-w-32 truncate">
              {schedule.clientName}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {t(`dashboard.schedules.cadence.${toCadenceKey(schedule.cadence)}`)}
            </TableCell>
            <TableCell className="text-right">
              <Tooltip>
                <TooltipTrigger type="button" className="focus-visible:outline-none">
                  <Badge variant={schedule.daysUntilRun < 0 ? "warning" : "secondary"}>
                    {schedule.daysUntilRun < 0
                      ? t("dashboard.schedules.runsPending")
                      : schedule.daysUntilRun === 0
                        ? t("dashboard.schedules.runsToday")
                        : t("dashboard.schedules.runsIn", { days: schedule.daysUntilRun })}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>{formatDay(schedule.nextRunAt, locale)}</TooltipContent>
              </Tooltip>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export { SchedulesList }
