"use client"

import { type Control, Controller, type FieldPathByValue, type FieldValues } from "react-hook-form"

import { DatePicker } from "@/components/ui/DatePicker"
import { Field, FieldError, FieldLabel } from "@/components/ui/Field"

type FormDateFieldProps<
  TFieldValues extends FieldValues,
  TContext = unknown,
  TTransformedValues = TFieldValues
> = {
  control: Control<TFieldValues, TContext, TTransformedValues>
  name: FieldPathByValue<TFieldValues, string>
  label: string
  disabled?: boolean
}

const FormDateField = <
  TFieldValues extends FieldValues,
  TContext = unknown,
  TTransformedValues = TFieldValues
>({
  control,
  name,
  label,
  disabled
}: FormDateFieldProps<TFieldValues, TContext, TTransformedValues>) => (
  <Controller
    name={name}
    control={control}
    render={({ field, fieldState }) => (
      <Field data-invalid={fieldState.invalid}>
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        <DatePicker
          id={field.name}
          ref={field.ref}
          value={field.value}
          onChangeAction={field.onChange}
          onBlur={field.onBlur}
          valid={!fieldState.invalid}
          disabled={disabled}
        />
        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
      </Field>
    )}
  />
)

export { FormDateField }
