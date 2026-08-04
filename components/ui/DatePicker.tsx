"use client"

import { type Ref } from "react"

import { useTranslation } from "@/lib/i18n"

import { cn, formatDay, formatIsoDay } from "@/lib/utils"

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

// Built from the parts in local time rather than parsed with `new Date(value)`, which reads a bare
// `YYYY-MM-DD` as UTC midnight. `formatIsoDay` in `lib/utils/format.ts` writes the value back from
// local getters, so a UTC parse here would print the previous day everywhere west of Greenwich and
// walk a stored date backwards each time the picker was opened and saved.
function toDate(value?: string): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined

  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(year, month - 1, day)

  return Number.isNaN(date.getTime()) ? undefined : date
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
          onSelect={(date) => onChangeAction?.(date ? formatIsoDay(date) : "")}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
