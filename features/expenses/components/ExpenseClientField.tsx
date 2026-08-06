"use client"

import { type Control, Controller } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Field,
  FieldDescription,
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
import { type ExpenseClientOption } from "../types"

import { fromSelectValue, toSelectValue, NO_SELECTION } from "./selectSentinel"

type ExpenseClientFieldProps = {
  control: Control<ExpenseFormInputValues>
  options: ExpenseClientOption[]
  followsProject: boolean
  disabled?: boolean
}

const ExpenseClientField = ({
  control,
  options,
  followsProject,
  disabled
}: ExpenseClientFieldProps) => {
  const { t } = useTranslation()

  return (
    <Controller
      name="clientId"
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={field.name}>{t("expenses.fields.client")}</FieldLabel>
          <Select
            value={toSelectValue(field.value)}
            onValueChange={(value) => field.onChange(fromSelectValue(value))}
            disabled={disabled || followsProject}
          >
            <SelectTrigger id={field.name} aria-invalid={fieldState.invalid} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={NO_SELECTION}>{t("expenses.fields.noClient")}</SelectItem>
                {options.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {followsProject ? (
            <FieldDescription>{t("expenses.fields.clientFollowsProject")}</FieldDescription>
          ) : null}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}

export { ExpenseClientField }
