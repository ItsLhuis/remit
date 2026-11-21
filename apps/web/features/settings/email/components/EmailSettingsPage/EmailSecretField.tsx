"use client"

import { type Control, useController } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { SecretField } from "@/components/ui"

import { type EmailSettingsInputValues, type EmailSettingsValues } from "../../schemas"

type EmailSecretFieldProps = {
  control: Control<EmailSettingsInputValues, unknown, EmailSettingsValues>
  name: "smtpPass" | "resendApiKey"
  label: string
  unconfiguredPlaceholder: string
  configured: boolean
  editing: boolean
  disabled: boolean
  onEdit: () => void
  onCancel: () => void
}

const EmailSecretField = ({
  control,
  name,
  label,
  unconfiguredPlaceholder,
  configured,
  editing,
  disabled,
  onEdit,
  onCancel
}: EmailSecretFieldProps) => {
  const { t } = useTranslation()

  const { field, fieldState } = useController({ control, name })

  return (
    <SecretField
      id={field.name}
      name={field.name}
      label={label}
      value={field.value}
      onChange={field.onChange}
      onBlur={field.onBlur}
      inputRef={field.ref}
      description={configured ? t("settings.email.secretPreserved") : ""}
      configuredPlaceholder={t("settings.email.configuredPlaceholder")}
      unconfiguredPlaceholder={unconfiguredPlaceholder}
      changeLabel={t("settings.email.changeSecret")}
      cancelLabel={t("common.actions.cancel")}
      configured={configured}
      editing={editing}
      disabled={disabled}
      invalid={fieldState.invalid}
      error={fieldState.error}
      autoComplete="new-password"
      onEdit={onEdit}
      onCancel={onCancel}
    />
  )
}

export { EmailSecretField }
