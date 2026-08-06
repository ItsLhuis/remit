"use client"

import { useId } from "react"

import { type Control, Controller } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { Field, FieldError, FieldLabel, Input } from "@/components/ui"

import { EXPENSE_CATEGORY_SUGGESTIONS } from "../labels"
import { type ExpenseFormInputValues } from "../schemas"

type ExpenseCategoryFieldProps = {
  control: Control<ExpenseFormInputValues>
  usedCategories: string[]
  disabled?: boolean
}

const ExpenseCategoryField = ({ control, usedCategories, disabled }: ExpenseCategoryFieldProps) => {
  const { t } = useTranslation()

  const listId = useId()

  const suggestions = [
    ...new Set([
      ...EXPENSE_CATEGORY_SUGGESTIONS.map((suggestion) => t(`expenses.categories.${suggestion}`)),
      ...usedCategories
    ])
  ]

  return (
    <Controller
      name="category"
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={field.name}>{t("expenses.fields.category")}</FieldLabel>
          <Input
            {...field}
            id={field.name}
            list={listId}
            autoComplete="off"
            placeholder={t("expenses.placeholders.category")}
            aria-invalid={fieldState.invalid}
            disabled={disabled}
          />
          {/* The category column is free-form text, so the control stays an Input and the proposals
              ride along in a datalist: a Select would turn a suggestion into the only allowed answer.
              There is no design-system primitive for this because a datalist renders nothing of its
              own — the browser draws the suggestion popup. */}
          <datalist id={listId}>
            {suggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}

export { ExpenseCategoryField }
