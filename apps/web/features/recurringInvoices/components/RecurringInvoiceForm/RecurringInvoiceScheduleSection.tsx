"use client"

import { Controller, useWatch, type Control } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FormDateField,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch
} from "@/components/ui"

import {
  RECURRING_INVOICE_CADENCE_VALUES,
  RECURRING_INVOICE_END_CONDITIONS,
  type RecurringInvoiceFormInputValues
} from "../../schemas"

type RecurringInvoiceScheduleSectionProps = {
  control: Control<RecurringInvoiceFormInputValues>
  disabled: boolean
}

const RecurringInvoiceScheduleSection = ({
  control,
  disabled
}: RecurringInvoiceScheduleSectionProps) => {
  const { t } = useTranslation()

  // Named fields, never the whole form: the billing-day hint follows the cadence and the end fields
  // follow the discriminator, so nothing typed elsewhere in the form re-renders this section.
  const [cadence, endCondition] = useWatch({ control, name: ["cadence", "endCondition"] })

  return (
    <FieldGroup className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          name="cadence"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("recurringInvoices.fields.cadence")}</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {RECURRING_INVOICE_CADENCE_VALUES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`recurringInvoices.cadence.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="cadenceDay"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                {t("recurringInvoices.fields.cadenceDay")}
              </FieldLabel>
              <Input
                {...field}
                id={field.name}
                inputMode="numeric"
                aria-invalid={fieldState.invalid}
                disabled={disabled}
                className="text-right font-mono tabular-nums"
              />
              <FieldDescription>
                {cadence === "weekly"
                  ? t("recurringInvoices.fieldHints.cadenceDayWeekly")
                  : t("recurringInvoices.fieldHints.cadenceDayMonthly")}
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <FormDateField
          control={control}
          name="nextRunAt"
          label={t("recurringInvoices.fields.nextRunAt")}
          disabled={disabled}
        />
        <Controller
          name="endCondition"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                {t("recurringInvoices.fields.endCondition")}
              </FieldLabel>
              <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {RECURRING_INVOICE_END_CONDITIONS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`recurringInvoices.endCondition.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        {endCondition === "after_count" ? (
          <Controller
            name="endAfterCount"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  {t("recurringInvoices.fields.endAfterCount")}
                </FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  inputMode="numeric"
                  aria-invalid={fieldState.invalid}
                  disabled={disabled}
                  className="text-right font-mono tabular-nums"
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        ) : null}
        {endCondition === "by_date" ? (
          <FormDateField
            control={control}
            name="endByDate"
            label={t("recurringInvoices.fields.endByDate")}
            disabled={disabled}
          />
        ) : null}
      </div>
      <Controller
        name="autoSend"
        control={control}
        render={({ field, fieldState }) => (
          <Field orientation="horizontal" data-invalid={fieldState.invalid}>
            <Switch
              id={field.name}
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={disabled}
              aria-invalid={fieldState.invalid}
            />
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor={field.name}>{t("recurringInvoices.fields.autoSend")}</FieldLabel>
              <FieldDescription>{t("recurringInvoices.fieldHints.autoSend")}</FieldDescription>
            </div>
          </Field>
        )}
      />
    </FieldGroup>
  )
}

export { RecurringInvoiceScheduleSection }
