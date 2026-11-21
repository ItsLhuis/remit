"use client"

import { useState } from "react"

import { Controller, type Control, type UseFormSetValue } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Switch
} from "@/components/ui"

import { type RecurringInvoiceFormInputValues } from "../../schemas"

const RETAINER_TOGGLE_ID = "recurring-invoice-retainer"

type RecurringInvoiceRetainerSectionProps = {
  control: Control<RecurringInvoiceFormInputValues>
  setValue: UseFormSetValue<RecurringInvoiceFormInputValues>
  defaultEnabled: boolean
  disabled: boolean
}

const RecurringInvoiceRetainerSection = ({
  control,
  setValue,
  defaultEnabled,
  disabled
}: RecurringInvoiceRetainerSectionProps) => {
  const { t } = useTranslation()

  const [isEnabled, setIsEnabled] = useState(defaultEnabled)

  // Included hours and the overage rate are both-or-neither (schemas.ts's
  // refineRecurringInvoiceFields), so switching the retainer off has to clear both. A value left
  // behind by a now-hidden input would hold the form invalid with nothing on screen to correct.
  const handleToggle = (checked: boolean) => {
    setIsEnabled(checked)

    if (checked) return

    setValue("includedHours", "", { shouldDirty: true, shouldValidate: true })
    setValue("overageRate", "", { shouldDirty: true, shouldValidate: true })
  }

  return (
    <FieldGroup className="grid gap-4">
      <Field orientation="horizontal">
        <Switch
          id={RETAINER_TOGGLE_ID}
          checked={isEnabled}
          onCheckedChange={handleToggle}
          disabled={disabled}
        />
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor={RETAINER_TOGGLE_ID}>
            {t("recurringInvoices.form.retainerToggle")}
          </FieldLabel>
          <FieldDescription>{t("recurringInvoices.form.retainerDescription")}</FieldDescription>
        </div>
      </Field>
      {isEnabled ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            name="includedHours"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  {t("recurringInvoices.fields.includedHours")}
                </FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  inputMode="decimal"
                  aria-invalid={fieldState.invalid}
                  disabled={disabled}
                  className="text-right font-mono tabular-nums"
                />
                <FieldDescription>
                  {t("recurringInvoices.fieldHints.includedHours")}
                </FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="overageRate"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  {t("recurringInvoices.fields.overageRate")}
                </FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  inputMode="decimal"
                  placeholder={t("invoices.placeholders.amount")}
                  aria-invalid={fieldState.invalid}
                  disabled={disabled}
                  className="text-right font-mono tabular-nums"
                />
                <FieldDescription>{t("recurringInvoices.fieldHints.overageRate")}</FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </div>
      ) : null}
    </FieldGroup>
  )
}

export { RecurringInvoiceRetainerSection }
