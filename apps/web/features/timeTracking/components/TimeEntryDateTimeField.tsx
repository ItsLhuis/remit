"use client"

import { type Control, Controller, type FieldPathByValue, type FieldValues } from "react-hook-form"

import { Field, FieldError, FieldLabel, Input } from "@/components/ui"

// A `datetime-local` control rather than the `DatePicker` primitive, which is date-only: a time
// entry needs the minute, and the two fields are only meaningful as a pair. The value it holds is
// browser-local wall-clock text; `TimeEntryForm` converts it to an instant before submitting.
type TimeEntryDateTimeFieldProps<
  TFieldValues extends FieldValues,
  TContext = unknown,
  TTransformedValues = TFieldValues
> = {
  control: Control<TFieldValues, TContext, TTransformedValues>
  name: FieldPathByValue<TFieldValues, string>
  label: string
  disabled?: boolean
}

const TimeEntryDateTimeField = <
  TFieldValues extends FieldValues,
  TContext = unknown,
  TTransformedValues = TFieldValues
>({
  control,
  name,
  label,
  disabled
}: TimeEntryDateTimeFieldProps<TFieldValues, TContext, TTransformedValues>) => (
  <Controller
    name={name}
    control={control}
    render={({ field, fieldState }) => (
      <Field data-invalid={fieldState.invalid}>
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        <Input
          {...field}
          id={field.name}
          type="datetime-local"
          aria-invalid={fieldState.invalid}
          disabled={disabled}
        />
        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
      </Field>
    )}
  />
)

export { TimeEntryDateTimeField }
