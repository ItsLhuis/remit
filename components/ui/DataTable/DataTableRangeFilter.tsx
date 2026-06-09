"use client"

import { type Column } from "@tanstack/react-table"

import { useTranslation } from "@/lib/i18n"

import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Input } from "@/components/ui/Input"
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

  const update = (index: 0 | 1, value: string) => {
    const next: [string, string] = [min, max]
    next[index] = majorToCents(value)

    if (next[0] === "" && next[1] === "") {
      column.setFilterValue(undefined)

      return
    }

    column.setFilterValue(next)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="border-dashed">
          <Icon name="Hash" aria-hidden="true" />
          {title}
          {hasValue ? (
            <>
              <Separator
                orientation="vertical"
                className="mx-0.5 data-[orientation=vertical]:h-4"
              />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                {`${centsToMajor(min) || "…"} – ${centsToMajor(max) || "…"}`}
              </Badge>
            </>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-60 flex-col gap-3 p-3" align="start">
        <span className="text-sm font-medium">{title}</span>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={centsToMajor(min)}
            onChange={(event) => update(0, event.target.value)}
            placeholder={t("common.table.min")}
            aria-label={t("common.table.min")}
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={centsToMajor(max)}
            onChange={(event) => update(1, event.target.value)}
            placeholder={t("common.table.max")}
            aria-label={t("common.table.max")}
          />
        </div>
        {hasValue ? (
          <Button variant="ghost" size="sm" onClick={() => column.setFilterValue(undefined)}>
            {t("common.table.clearFilter")}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

export { DataTableRangeFilter }
