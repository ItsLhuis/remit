"use client"

import { type Control, Controller } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { Field, FieldDescription, FieldLabel, Switch } from "@/components/ui"

import { type ExpenseFormInputValues } from "../schemas"

type ExpenseRebillableFieldProps = {
  control: Control<ExpenseFormInputValues>
  disabled?: boolean
  onToggle: (rebillable: boolean) => void
}

const ExpenseRebillableField = ({ control, disabled, onToggle }: ExpenseRebillableFieldProps) => {
  const { t } = useTranslation()

  return (
    <Controller
      name="rebillable"
      control={control}
      render={({ field }) => (
        <Field orientation="horizontal">
          <div className="flex flex-col gap-0.5">
            <FieldLabel htmlFor={field.name}>{t("expenses.fields.rebillable")}</FieldLabel>
            <FieldDescription>{t("expenses.fields.rebillableHelp")}</FieldDescription>
          </div>
          <Switch
            id={field.name}
            ref={field.ref}
            checked={field.value}
            onCheckedChange={(checked) => {
              field.onChange(checked)
              onToggle(checked)
            }}
            onBlur={field.onBlur}
            disabled={disabled}
          />
        </Field>
      )}
    />
  )
}

export { ExpenseRebillableField }
