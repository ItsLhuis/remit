"use client"

import { Fragment } from "react"

import { type Column } from "@tanstack/react-table"

import { useTranslation } from "@/lib/i18n"

import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Calendar } from "@/components/ui/Calendar"
import { Icon } from "@/components/ui/Icon"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover"
import { Separator } from "@/components/ui/Separator"

type DataTableDateFilterProps<TData, TValue> = {
  column: Column<TData, TValue>
  title: string
}

const dateFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" })

const parseDateRange = (value: unknown): { from?: Date; to?: Date } => {
  if (!Array.isArray(value)) return {}

  const [from, to] = value as string[]
  const fromMs = Number(from)
  const toMs = Number(to)

  return {
    from: from && Number.isFinite(fromMs) ? new Date(fromMs) : undefined,
    to: to && Number.isFinite(toMs) ? new Date(toMs) : undefined
  }
}

const DataTableDateFilter = <TData, TValue>({
  column,
  title
}: DataTableDateFilterProps<TData, TValue>) => {
  const { t } = useTranslation()

  const range = parseDateRange(column.getFilterValue())
  const hasValue = Boolean(range.from ?? range.to)

  const label = [range.from, range.to]
    .map((date) => (date ? dateFormatter.format(date) : "…"))
    .join(" – ")

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="border-dashed">
          <Icon name="CalendarDays" aria-hidden="true" />
          {title}
          {hasValue ? (
            <Fragment>
              <Separator
                orientation="vertical"
                className="mx-0.5 data-[orientation=vertical]:h-4"
              />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                {label}
              </Badge>
            </Fragment>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={{ from: range.from, to: range.to }}
          onSelect={(next) => {
            if (!next?.from && !next?.to) {
              column.setFilterValue(undefined)

              return
            }

            column.setFilterValue([
              next?.from ? String(next.from.getTime()) : "",
              next?.to ? String(next.to.getTime()) : ""
            ])
          }}
        />
        {hasValue ? (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => column.setFilterValue(undefined)}
            >
              {t("common.table.clearFilter")}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

export { DataTableDateFilter }
