"use client"

import { Controller, type Control } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { Field, FieldDescription, FieldError, FieldLabel, Input } from "@/components/ui"

import { type RetentionPolicyFormInputValues } from "../../schemas"

type RetentionDaysFieldProps = {
  control: Control<RetentionPolicyFormInputValues>
  name: keyof RetentionPolicyFormInputValues
  label: string
  description: string
  disabled: boolean
}

const RetentionDaysField = ({
  control,
  name,
  label,
  description,
  disabled
}: RetentionDaysFieldProps) => {
  const { t } = useTranslation()

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          <Input
            {...field}
            id={field.name}
            inputMode="numeric"
            placeholder={t("trash.retention.neverPlaceholder")}
            aria-invalid={fieldState.invalid}
            disabled={disabled}
          />
          <FieldDescription>{description}</FieldDescription>
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}

export { RetentionDaysField }
