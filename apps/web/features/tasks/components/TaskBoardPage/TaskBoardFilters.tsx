"use client"

import { Fragment } from "react"

import { useTranslation } from "@/lib/i18n"

import { cn } from "@/lib/utils"

import {
  Badge,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Icon,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator
} from "@/components/ui"

import { TASK_PRIORITY_VALUES, type TaskPriority } from "../../schemas"

type TaskBoardFiltersProps = {
  search: string
  onSearchChange: (value: string) => void
  priorities: TaskPriority[]
  onTogglePriority: (priority: TaskPriority) => void
  onClearPriorities: () => void
  hasActiveFilters: boolean
  onClearAll: () => void
}

const TaskBoardFilters = ({
  search,
  onSearchChange,
  priorities,
  onTogglePriority,
  onClearPriorities,
  hasActiveFilters,
  onClearAll
}: TaskBoardFiltersProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <Icon
          name="Search"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t("tasks.board.searchPlaceholder")}
          aria-label={t("tasks.board.searchLabel")}
          autoComplete="off"
          className="pl-8"
        />
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="border-dashed">
            <Icon name="ListFilter" aria-hidden="true" />
            {t("tasks.board.priorityFilter")}
            {priorities.length > 0 ? (
              <Fragment>
                <Separator
                  orientation="vertical"
                  className="mx-0.5 data-[orientation=vertical]:h-4"
                />
                <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                  {priorities.length}
                </Badge>
              </Fragment>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-0" align="start">
          <Command>
            <CommandInput placeholder={t("tasks.board.priorityFilter")} />
            <CommandList>
              <CommandEmpty>{t("common.table.noResults")}</CommandEmpty>
              <CommandGroup>
                {TASK_PRIORITY_VALUES.map((priority) => {
                  const isSelected = priorities.includes(priority)

                  return (
                    <CommandItem key={priority} onSelect={() => onTogglePriority(priority)}>
                      <div
                        className={cn(
                          "flex size-4 items-center justify-center rounded-lg border",
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-input [&_svg]:invisible"
                        )}
                      >
                        <Icon name="Check" className="size-3.5" aria-hidden="true" />
                      </div>
                      <span>{t(`tasks.priority.${priority}`)}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
              {priorities.length > 0 ? (
                <Fragment>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem onSelect={onClearPriorities} className="justify-center">
                      {t("common.table.clearFilter")}
                    </CommandItem>
                  </CommandGroup>
                </Fragment>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {hasActiveFilters ? (
        <Button variant="ghost" size="sm" onClick={onClearAll}>
          <Icon name="X" aria-hidden="true" />
          {t("tasks.board.clearFilters")}
        </Button>
      ) : null}
    </div>
  )
}

export { TaskBoardFilters }
