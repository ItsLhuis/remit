"use client"

import { useMemo } from "react"

import { type Control, Controller } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { FORMATTING_LOCALES } from "@/lib/utils"

import {
  CurrencySelect,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FormTextField,
  PhoneInput,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui"

import { type ClientFormInputValues, type ClientFormValues } from "../../schemas"

import { FormSection } from "./FormSection"

// A Radix select item cannot carry an empty value, and empty is what the form holds for "no
// override", so the default option travels under this sentinel and is mapped back at the control.
const INSTANCE_DEFAULT_LOCALE = "instance-default"

function getLocaleOptions(displayLanguage: string): { code: string; label: string }[] {
  const names = new Intl.DisplayNames([displayLanguage], { type: "language" })

  return FORMATTING_LOCALES.map((code) => ({ code, label: `${names.of(code) ?? code} (${code})` }))
}

type ClientProfileSectionProps = {
  control: Control<ClientFormInputValues, unknown, ClientFormValues>
  disabled: boolean
}

const ClientProfileSection = ({ control, disabled }: ClientProfileSectionProps) => {
  const { t, i18n } = useTranslation()

  const localeOptions = useMemo(() => getLocaleOptions(i18n.language ?? "en"), [i18n.language])

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
        <Controller
          name="locale"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("clients.fields.locale")}</FieldLabel>
              <Select
                value={field.value || INSTANCE_DEFAULT_LOCALE}
                onValueChange={(value) =>
                  field.onChange(value === INSTANCE_DEFAULT_LOCALE ? "" : value)
                }
                disabled={disabled}
              >
                <SelectTrigger
                  ref={field.ref}
                  id={field.name}
                  className="w-full"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={`${field.name}-description`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={INSTANCE_DEFAULT_LOCALE}>
                      {t("clients.form.localeDefault")}
                    </SelectItem>
                    {localeOptions.map(({ code, label }) => (
                      <SelectItem key={code} value={code}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription id={`${field.name}-description`}>
                {t("clients.form.localeDescription")}
              </FieldDescription>
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
