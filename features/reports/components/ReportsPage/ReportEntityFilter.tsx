"use client"

import { useTranslation } from "@/lib/i18n"

import {
  Field,
  FieldLabel,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui"

import { reportFilterLabelKeys } from "../../labels"
import { type ReportFilterId } from "../../schemas"
import { type ReportFilterOption } from "../../types"

// Radix rejects an empty-string item value, and "" is what an unset filter is in the URL. This is
// the on-screen stand-in for it, converted at the two edges below so the query never learns about
// it. It reads "all", not "none": an unset entity filter widens the report rather than selecting
// rows that have no entity.
const ALL_ENTITIES = "__all__"

type ReportEntityFilterProps = {
  filter: ReportFilterId
  value: string
  options: ReportFilterOption[]
  onChange: (filter: ReportFilterId, value: string) => void
}

const ReportEntityFilter = ({ filter, value, options, onChange }: ReportEntityFilterProps) => {
  const { t } = useTranslation()

  const keys = reportFilterLabelKeys[filter]
  const inputId = `report-filter-${filter}`

  return (
    <Field className="w-full sm:w-56">
      <FieldLabel htmlFor={inputId}>{t(keys.label)}</FieldLabel>
      <Select
        value={value === "" ? ALL_ENTITIES : value}
        onValueChange={(next) => onChange(filter, next === ALL_ENTITIES ? "" : next)}
      >
        <SelectTrigger id={inputId} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value={ALL_ENTITIES}>{t(keys.all)}</SelectItem>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

export { ReportEntityFilter }
