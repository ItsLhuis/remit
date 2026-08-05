"use client"

import { type Control, Controller, type FieldPathByValue, type FieldValues } from "react-hook-form"

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

import { type TimeTrackingProjectOption } from "../types"

type TimeEntryProjectFieldProps<
  TFieldValues extends FieldValues,
  TContext = unknown,
  TTransformedValues = TFieldValues
> = {
  control: Control<TFieldValues, TContext, TTransformedValues>
  name: FieldPathByValue<TFieldValues, string>
  options: TimeTrackingProjectOption[]
  disabled?: boolean
}

const TimeEntryProjectField = <
  TFieldValues extends FieldValues,
  TContext = unknown,
  TTransformedValues = TFieldValues
>({
  control,
  name,
  options,
  disabled
}: TimeEntryProjectFieldProps<TFieldValues, TContext, TTransformedValues>) => {
  const { t } = useTranslation()

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={field.name}>{t("timeTracking.fields.project")}</FieldLabel>
          <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
            <SelectTrigger id={field.name} aria-invalid={fieldState.invalid} className="w-full">
              <SelectValue placeholder={t("timeTracking.placeholders.project")} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {options.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {t("timeTracking.fields.projectOption", {
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

export { TimeEntryProjectField }
