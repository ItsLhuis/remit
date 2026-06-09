"use client"

import { type Column } from "@tanstack/react-table"

import { useTranslation } from "@/lib/i18n"

import { cn } from "@/lib/utils"

import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from "@/components/ui/Command"
import { Icon } from "@/components/ui/Icon"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover"
import { Separator } from "@/components/ui/Separator"

type DataTableFacetedFilterProps<TData, TValue> = {
  column: Column<TData, TValue>
  title: string
}

const DataTableFacetedFilter = <TData, TValue>({
  column,
  title
}: DataTableFacetedFilterProps<TData, TValue>) => {
  const { t } = useTranslation()

  const options = column.columnDef.meta?.options ?? []
  const selected = new Set((column.getFilterValue() as string[] | undefined) ?? [])

  const toggle = (value: string) => {
    const next = new Set(selected)

    if (next.has(value)) next.delete(value)
    else next.add(value)

    const values = Array.from(next)

    column.setFilterValue(values.length > 0 ? values : undefined)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="border-dashed">
          <Icon name="ListFilter" aria-hidden="true" />
          {title}
          {selected.size > 0 ? (
            <>
              <Separator
                orientation="vertical"
                className="mx-0.5 data-[orientation=vertical]:h-4"
              />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                {selected.size}
              </Badge>
            </>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>{t("common.table.noResults")}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.has(option.value)

                return (
                  <CommandItem key={option.value} onSelect={() => toggle(option.value)}>
                    <div
                      className={cn(
                        "flex size-4 items-center justify-center rounded-[4px] border",
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-input [&_svg]:invisible"
                      )}
                    >
                      <Icon name="Check" className="size-3.5" aria-hidden="true" />
                    </div>
                    <span>{option.label}</span>
                    {option.count !== undefined ? (
                      <span className="text-muted-foreground ml-auto font-mono text-xs">
                        {option.count}
                      </span>
                    ) : null}
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {selected.size > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => column.setFilterValue(undefined)}
                    className="justify-center"
                  >
                    {t("common.table.clearFilter")}
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { DataTableFacetedFilter }
