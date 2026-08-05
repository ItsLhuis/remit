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

import { type TimeTrackingTaskOption } from "../types"

import { fromSelectValue, toSelectValue, NO_SELECTION } from "./selectSentinel"

// `options` arrives already narrowed to the selected project. The caller owns that narrowing because
// it is the one watching `projectId`, and a task from another project would be rejected by
// `resolveEntryRate` server-side rather than silently accepted.
type TimeEntryTaskFieldProps<
  TFieldValues extends FieldValues,
  TContext = unknown,
  TTransformedValues = TFieldValues
> = {
  control: Control<TFieldValues, TContext, TTransformedValues>
  name: FieldPathByValue<TFieldValues, string>
  options: TimeTrackingTaskOption[]
  disabled?: boolean
}

const TimeEntryTaskField = <
  TFieldValues extends FieldValues,
  TContext = unknown,
  TTransformedValues = TFieldValues
>({
  control,
  name,
  options,
  disabled
}: TimeEntryTaskFieldProps<TFieldValues, TContext, TTransformedValues>) => {
  const { t } = useTranslation()

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={field.name}>{t("timeTracking.fields.task")}</FieldLabel>
          <Select
            value={toSelectValue(field.value)}
            onValueChange={(value) => field.onChange(fromSelectValue(value))}
            disabled={disabled || options.length === 0}
          >
            <SelectTrigger id={field.name} aria-invalid={fieldState.invalid} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={NO_SELECTION}>{t("timeTracking.fields.noTask")}</SelectItem>
                {options.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.title}
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

export { TimeEntryTaskField }
