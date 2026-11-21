"use client"

import { type Control, useController } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { SecretField } from "@/components/ui"

import { type BackupSettingsInputValues } from "../../schemas"

type BackupSecretFieldProps = {
  control: Control<BackupSettingsInputValues>
  name: "backupS3AccessKey" | "backupS3SecretKey"
  label: string
  unconfiguredPlaceholder: string
  configured: boolean
  editing: boolean
  disabled: boolean
  onEdit: () => void
  onCancel: () => void
  onChangeAfter?: () => void
}

const BackupSecretField = ({
  control,
  name,
  label,
  unconfiguredPlaceholder,
  configured,
  editing,
  disabled,
  onEdit,
  onCancel,
  onChangeAfter
}: BackupSecretFieldProps) => {
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
      description={configured ? t("settings.backup.secretPreserved") : ""}
      configuredPlaceholder={t("settings.backup.configuredPlaceholder")}
      unconfiguredPlaceholder={unconfiguredPlaceholder}
      changeLabel={t("settings.backup.changeSecret")}
      cancelLabel={t("common.actions.cancel")}
      configured={configured}
      editing={editing}
      disabled={disabled}
      invalid={fieldState.invalid}
      error={fieldState.error}
      autoComplete="new-password"
      onChangeAfter={onChangeAfter}
      onEdit={onEdit}
      onCancel={onCancel}
    />
  )
}

export { BackupSecretField }
