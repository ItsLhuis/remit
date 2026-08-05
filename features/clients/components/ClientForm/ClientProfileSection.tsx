"use client"

import { type Control, Controller } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  CurrencySelect,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FormTextField,
  PhoneInput
} from "@/components/ui"

import { type ClientFormInputValues, type ClientFormValues } from "../../schemas"

import { FormSection } from "./FormSection"

type ClientProfileSectionProps = {
  control: Control<ClientFormInputValues, unknown, ClientFormValues>
  disabled: boolean
}

const ClientProfileSection = ({ control, disabled }: ClientProfileSectionProps) => {
  const { t } = useTranslation()

  return (
    <FormSection
      title={t("clients.form.profileSection")}
      description={t("clients.form.profileDescription")}
    >
      <FieldGroup className="grid gap-4">
        <FormTextField
          control={control}
          name="name"
          label={t("clients.fields.name")}
          placeholder={t("clients.placeholders.name")}
          autoComplete="organization"
          disabled={disabled}
        />
        <FormTextField
          control={control}
          name="email"
          label={t("clients.fields.email")}
          placeholder={t("clients.placeholders.email")}
          type="email"
          autoComplete="email"
          disabled={disabled}
        />
        <Controller
          name="phone"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("clients.fields.phone")}</FieldLabel>
              <PhoneInput
                id={field.name}
                name={field.name}
                ref={field.ref}
                value={field.value}
                onBlur={field.onBlur}
                onValueChangeAction={field.onChange}
                valid={!fieldState.invalid}
                disabled={disabled}
                placeholder={t("clients.placeholders.phone")}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="currency"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("clients.fields.currency")}</FieldLabel>
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
        <FormTextField
          control={control}
          name="taxId"
          label={t("clients.fields.taxId")}
          placeholder={t("clients.placeholders.taxId")}
          disabled={disabled}
        />
        <FormTextField
          control={control}
          name="website"
          label={t("clients.fields.website")}
          placeholder={t("clients.placeholders.website")}
          type="url"
          autoComplete="url"
          disabled={disabled}
        />
        <FormTextField
          control={control}
          name="defaultHourlyRate"
          label={t("clients.fields.defaultHourlyRate")}
          placeholder={t("clients.placeholders.defaultHourlyRate")}
          inputMode="decimal"
          disabled={disabled}
        />
      </FieldGroup>
    </FormSection>
  )
}

export { ClientProfileSection }
