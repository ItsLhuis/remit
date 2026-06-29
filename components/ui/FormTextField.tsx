"use client"

import { type ComponentProps } from "react"

import { type Control, Controller, type FieldPathByValue, type FieldValues } from "react-hook-form"

import { Field, FieldError, FieldLabel } from "@/components/ui/Field"
import { Input } from "@/components/ui/Input"

type FormTextFieldProps<
  TFieldValues extends FieldValues,
  TContext = unknown,
  TTransformedValues = TFieldValues
> = {
  control: Control<TFieldValues, TContext, TTransformedValues>
  name: FieldPathByValue<TFieldValues, string>
  label: string
  placeholder?: string
  type?: ComponentProps<typeof Input>["type"]
  autoComplete?: ComponentProps<typeof Input>["autoComplete"]
  inputMode?: ComponentProps<typeof Input>["inputMode"]
  disabled?: boolean
}

const FormTextField = <
  TFieldValues extends FieldValues,
  TContext = unknown,
  TTransformedValues = TFieldValues
>({
  control,
  name,
  label,
  placeholder,
  type = "text",
  autoComplete,
  inputMode,
  disabled
}: FormTextFieldProps<TFieldValues, TContext, TTransformedValues>) => (
  <Controller
    name={name}
    control={control}
    render={({ field, fieldState }) => (
      <Field data-invalid={fieldState.invalid}>
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        <Input
          {...field}
          id={field.name}
          type={type}
          inputMode={inputMode}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={fieldState.invalid}
          disabled={disabled}
        />
        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
      </Field>
    )}
  />
)

export { FormTextField }
