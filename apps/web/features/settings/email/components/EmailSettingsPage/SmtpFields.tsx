"use client"

import { type Control, Controller } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  NumberInput,
  Switch,
  Typography
} from "@/components/ui"

import { type EmailSettingsInputValues, type EmailSettingsValues } from "../../schemas"

import { EmailSecretField } from "./EmailSecretField"

type SmtpFieldsProps = {
  control: Control<EmailSettingsInputValues, unknown, EmailSettingsValues>
  smtpPassConfigured: boolean
  editingSmtpPass: boolean
  disabled: boolean
  onSmtpPassEdit: () => void
  onSmtpPassCancel: () => void
}

const SmtpFields = ({
  control,
  smtpPassConfigured,
  editingSmtpPass,
  disabled,
  onSmtpPassEdit,
  onSmtpPassCancel
}: SmtpFieldsProps) => {
  const { t } = useTranslation()

  return (
    <FieldGroup>
      <Typography variant="h4">{t("settings.email.smtpSection")}</Typography>
      <div className="grid gap-4 md:grid-cols-2">
        <Controller
          name="smtpHost"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("settings.email.smtpHost")}</FieldLabel>
              <Input
                {...field}
                id={field.name}
                placeholder={t("settings.email.smtpHostPlaceholder")}
                aria-invalid={fieldState.invalid}
                disabled={disabled}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="smtpPort"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("settings.email.smtpPort")}</FieldLabel>
              <NumberInput
                id={field.name}
                name={field.name}
                ref={field.ref}
                value={field.value}
                onBlur={field.onBlur}
                onChange={(event) => field.onChange(Number(event.target.value))}
                min={1}
                max={65535}
                step={1}
                inputMode="numeric"
                aria-invalid={fieldState.invalid}
                disabled={disabled}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="smtpUser"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("settings.email.smtpUser")}</FieldLabel>
              <Input
                {...field}
                id={field.name}
                placeholder={t("settings.email.smtpUserPlaceholder")}
                aria-invalid={fieldState.invalid}
                disabled={disabled}
                autoComplete="username"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <EmailSecretField
          control={control}
          name="smtpPass"
          label={t("settings.email.smtpPassword")}
          unconfiguredPlaceholder={t("settings.email.smtpPasswordPlaceholder")}
          configured={smtpPassConfigured}
          editing={editingSmtpPass}
          disabled={disabled}
          onEdit={onSmtpPassEdit}
          onCancel={onSmtpPassCancel}
        />
      </div>
      <Controller
        name="smtpSecure"
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
              <FieldLabel htmlFor={field.name}>{t("settings.email.smtpSecure")}</FieldLabel>
              <FieldDescription>{t("settings.email.smtpSecureHelp")}</FieldDescription>
            </div>
          </Field>
        )}
      />
    </FieldGroup>
  )
}

export { SmtpFields }
