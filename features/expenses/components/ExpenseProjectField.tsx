"use client"

import { type Control, Controller } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Field,
  FieldError,
  FieldLabel,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui"

import { type ExpenseFormInputValues } from "../schemas"
import { type ExpenseProjectOption } from "../types"

import { fromSelectValue, toSelectValue, NO_SELECTION } from "./selectSentinel"

type ExpenseProjectFieldProps = {
  control: Control<ExpenseFormInputValues>
  options: ExpenseProjectOption[]
  disabled?: boolean
  onSelect: (projectId: string) => void
}

const ExpenseProjectField = ({
  control,
  options,
  disabled,
  onSelect
}: ExpenseProjectFieldProps) => {
  const { t } = useTranslation()

  return (
    <Controller
      name="projectId"
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={field.name}>{t("expenses.fields.project")}</FieldLabel>
          <Select
            value={toSelectValue(field.value)}
            onValueChange={(value) => {
              const projectId = fromSelectValue(value)

              field.onChange(projectId)
              onSelect(projectId)
            }}
            disabled={disabled || options.length === 0}
          >
            <SelectTrigger id={field.name} aria-invalid={fieldState.invalid} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={NO_SELECTION}>{t("expenses.fields.noProject")}</SelectItem>
                {options.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {t("expenses.fields.projectOption", {
                      client: project.clientName,
                      project: project.name
                    })}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}

export { ExpenseProjectField }
