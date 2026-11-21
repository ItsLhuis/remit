"use client"

import { type Control, Controller, type FieldPathByValue, type FieldValues } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { Field, FieldDescription, FieldLabel, Switch } from "@/components/ui"

type TimeEntryBillableFieldProps<
  TFieldValues extends FieldValues,
  TContext = unknown,
  TTransformedValues = TFieldValues
> = {
  control: Control<TFieldValues, TContext, TTransformedValues>
  name: FieldPathByValue<TFieldValues, boolean>
  disabled?: boolean
}

const TimeEntryBillableField = <
  TFieldValues extends FieldValues,
  TContext = unknown,
  TTransformedValues = TFieldValues
>({
  control,
  name,
  disabled
}: TimeEntryBillableFieldProps<TFieldValues, TContext, TTransformedValues>) => {
  const { t } = useTranslation()

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Field orientation="horizontal">
          <div className="flex flex-col gap-0.5">
            <FieldLabel htmlFor={field.name}>{t("timeTracking.fields.billable")}</FieldLabel>
            <FieldDescription>{t("timeTracking.fields.billableHelp")}</FieldDescription>
          </div>
          <Switch
            id={field.name}
            ref={field.ref}
            checked={field.value}
            onCheckedChange={field.onChange}
            onBlur={field.onBlur}
            disabled={disabled}
          />
        </Field>
      )}
    />
  )
}

export { TimeEntryBillableField }
