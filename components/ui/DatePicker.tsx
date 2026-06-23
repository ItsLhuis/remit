"use client"

import { type Ref } from "react"

import { useTranslation } from "@/lib/i18n"

import { cn, formatDay } from "@/lib/utils"

import { Button } from "@/components/ui/Button"
import { Calendar } from "@/components/ui/Calendar"
import { Icon } from "@/components/ui/Icon"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover"

type DatePickerProps = {
  ref?: Ref<HTMLButtonElement>
  id?: string
  value?: string
  onChangeAction?: (value: string) => void
  onBlur?: () => void
  disabled?: boolean
  valid?: boolean
  placeholder?: string
}

function toDate(value?: string): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined

  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(year, month - 1, day)

  return Number.isNaN(date.getTime()) ? undefined : date
}

function toIsoDay(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

const DatePicker = ({
  id,
  value,
  onChangeAction,
  onBlur,
  disabled = false,
  valid = true,
  placeholder,
  ref
}: DatePickerProps) => {
  const { t, i18n } = useTranslation()

  const locale = i18n.resolvedLanguage ?? i18n.language

  const selected = toDate(value)
  const resolvedPlaceholder = placeholder ?? t("common.fields.selectDate")

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          onBlur={onBlur}
          data-empty={!selected}
          data-valid={valid}
          aria-invalid={!valid}
          className="data-empty:text-muted-foreground w-full justify-between font-normal"
        >
          <span className={cn(selected && "tabular-nums")}>
            {selected ? formatDay(selected, locale) : resolvedPlaceholder}
          </span>
          <Icon name="CalendarDays" aria-hidden="true" className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => onChangeAction?.(date ? toIsoDay(date) : "")}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
