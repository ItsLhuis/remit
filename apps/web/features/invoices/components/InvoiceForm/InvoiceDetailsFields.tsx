"use client"

import { Controller, useWatch, type Control } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  CurrencySelect,
  Field,
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
  SelectValue
} from "@/components/ui"

import { INVOICE_DISCOUNT_KINDS, type InvoiceFormInputValues } from "../../schemas"
import { type InvoiceTemplateOption } from "../../types"

import { fromSelectValue, toSelectValue, NO_SELECTION } from "./selectSentinel"

type InvoiceDetailsFieldsProps = {
  control: Control<InvoiceFormInputValues>
  templates: InvoiceTemplateOption[]
  disabled: boolean
}

const InvoiceDetailsFields = ({ control, templates, disabled }: InvoiceDetailsFieldsProps) => {
  const { t } = useTranslation()

  // Watched here rather than passed down, so the only thing a discount-kind change re-renders is
  // this field group.
  const discountKind = useWatch({ control, name: "discountKind" })

  return (
    <FieldGroup className="grid gap-4 sm:grid-cols-2">
      <Controller
        name="currency"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>{t("invoices.fields.currency")}</FieldLabel>
            <CurrencySelect
              id={field.name}
              ref={field.ref}
              value={field.value}
              onValueChangeAction={field.onChange}
              valid={!fieldState.invalid}
              disabled={disabled}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="templateId"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>{t("invoices.fields.template")}</FieldLabel>
            <Select
              value={toSelectValue(field.value)}
              onValueChange={(value) => field.onChange(fromSelectValue(value))}
              disabled={disabled}
            >
              <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={NO_SELECTION}>{t("invoices.template.none")}</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <FormDateField
        control={control}
        name="issueDate"
        label={t("invoices.fields.issueDate")}
        disabled={disabled}
      />
      <FormDateField
        control={control}
        name="dueDate"
        label={t("invoices.fields.dueDate")}
        disabled={disabled}
      />
      <Controller
        name="discountKind"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>{t("invoices.fields.discountType")}</FieldLabel>
            <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
              <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {INVOICE_DISCOUNT_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {t(`invoices.discount.${kind}`)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      {discountKind === "percentage" ? (
        <Controller
          name="discountPercentage"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                {t("invoices.fields.discountPercentage")}
              </FieldLabel>
              <Input
                {...field}
                id={field.name}
                inputMode="decimal"
                placeholder={t("invoices.placeholders.percentage")}
                aria-invalid={fieldState.invalid}
                disabled={disabled}
                className="text-right font-mono tabular-nums"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      ) : null}
      {discountKind === "fixed" ? (
        <Controller
          name="discountAmount"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("invoices.fields.discountAmount")}</FieldLabel>
              <Input
                {...field}
                id={field.name}
                inputMode="decimal"
                placeholder={t("invoices.placeholders.amount")}
                aria-invalid={fieldState.invalid}
                disabled={disabled}
                className="text-right font-mono tabular-nums"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      ) : null}
    </FieldGroup>
  )
}

export { InvoiceDetailsFields }
