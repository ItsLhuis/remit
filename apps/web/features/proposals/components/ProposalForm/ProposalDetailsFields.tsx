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

import { PROPOSAL_DISCOUNT_KINDS, type ProposalFormInputValues } from "../../schemas"
import { type ProposalTemplateOption } from "../../types"

import { fromSelectValue, toSelectValue, NO_SELECTION } from "./selectSentinel"

type ProposalDetailsFieldsProps = {
  control: Control<ProposalFormInputValues>
  templates: ProposalTemplateOption[]
  disabled: boolean
}

const ProposalDetailsFields = ({ control, templates, disabled }: ProposalDetailsFieldsProps) => {
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
            <FieldLabel htmlFor={field.name}>{t("proposals.fields.currency")}</FieldLabel>
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
            <FieldLabel htmlFor={field.name}>{t("proposals.fields.template")}</FieldLabel>
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
                  <SelectItem value={NO_SELECTION}>{t("proposals.template.none")}</SelectItem>
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
        name="validUntil"
        label={t("proposals.fields.validUntil")}
        disabled={disabled}
      />
      <Controller
        name="discountKind"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>{t("proposals.fields.discountType")}</FieldLabel>
            <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
              <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {PROPOSAL_DISCOUNT_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {t(`proposals.discount.${kind}`)}
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
                {t("proposals.fields.discountPercentage")}
              </FieldLabel>
              <Input
                {...field}
                id={field.name}
                inputMode="decimal"
                placeholder={t("proposals.placeholders.percentage")}
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
              <FieldLabel htmlFor={field.name}>{t("proposals.fields.discountAmount")}</FieldLabel>
              <Input
                {...field}
                id={field.name}
                inputMode="decimal"
                placeholder={t("proposals.placeholders.amount")}
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

export { ProposalDetailsFields }
