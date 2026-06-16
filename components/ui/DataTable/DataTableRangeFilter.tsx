"use client"

import { Fragment, useEffect, useState } from "react"

import { type Column } from "@tanstack/react-table"

import { useTranslation } from "@/lib/i18n"

import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { NumberInput } from "@/components/ui/NumberInput"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover"
import { Separator } from "@/components/ui/Separator"

type DataTableRangeFilterProps<TData, TValue> = {
  column: Column<TData, TValue>
  title: string
}

const centsToMajor = (cents?: string): string =>
  cents && cents !== "" ? String(Number(cents) / 100) : ""

const majorToCents = (major: string): string =>
  major.trim() === "" ? "" : String(Math.round(Number(major) * 100))

const DataTableRangeFilter = <TData, TValue>({
  column,
  title
}: DataTableRangeFilterProps<TData, TValue>) => {
  const { t } = useTranslation()

  const [min = "", max = ""] = (column.getFilterValue() as string[] | undefined) ?? []
  const hasValue = min !== "" || max !== ""

  const [localMin, setLocalMin] = useState(() => centsToMajor(min))
  const [localMax, setLocalMax] = useState(() => centsToMajor(max))

  const [externalFilter, setExternalFilter] = useState({ min, max })

  if (externalFilter.min !== min || externalFilter.max !== max) {
    setExternalFilter({ min, max })

    if (!min && !max) {
      setLocalMin("")
      setLocalMax("")
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      const minCents = majorToCents(localMin)
      const maxCents = majorToCents(localMax)

      if (minCents === "" && maxCents === "") {
        if (column.getFilterValue() !== undefined) {
          column.setFilterValue(undefined)
        }

        return
      }

      column.setFilterValue([minCents, maxCents])
    }, 400)

    return () => clearTimeout(timer)
  }, [localMin, localMax, column])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="border-dashed">
          <Icon name="Hash" aria-hidden="true" />
          {title}
          {hasValue ? (
            <Fragment>
              <Separator
                orientation="vertical"
                className="mx-0.5 data-[orientation=vertical]:h-4"
              />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                {`${centsToMajor(min) || "…"} – ${centsToMajor(max) || "…"}`}
              </Badge>
            </Fragment>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-64 flex-col gap-3 p-3" align="start">
        <span className="text-sm font-medium">{title}</span>
        <div className="flex items-center gap-2">
          <NumberInput
            min={0}
            value={localMin}
            onChange={(event) => setLocalMin(event.target.value)}
            placeholder={t("common.table.min")}
            aria-label={t("common.table.min")}
          />
          <span className="text-muted-foreground shrink-0">–</span>
          <NumberInput
            min={0}
            value={localMax}
            onChange={(event) => setLocalMax(event.target.value)}
            placeholder={t("common.table.max")}
            aria-label={t("common.table.max")}
          />
        </div>
        {hasValue ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLocalMin("")
              setLocalMax("")
              column.setFilterValue(undefined)
            }}
          >
            {t("common.table.clearFilter")}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

export { DataTableRangeFilter }
