"use client"

import { type Control, useController } from "react-hook-form"

import { SecretField } from "@/components/ui"

import { type PaymentSettingsInputValues, type PaymentSettingsValues } from "../../schemas"

type PaymentSecretFieldProps = {
  control: Control<PaymentSettingsInputValues, unknown, PaymentSettingsValues>
  name: "paymentIban" | "stripeSecretKey" | "stripeWebhookSecret"
  label: string
  configuredPlaceholder: string
  unconfiguredPlaceholder: string
  configuredDescription: string
  changeLabel: string
  cancelLabel: string
  configured: boolean
  editing: boolean
  disabled: boolean
  autoComplete?: string
  onEdit: () => void
  onCancel: () => void
  onChangeAfter?: () => void
}

const PaymentSecretField = ({
  control,
  name,
  label,
  configuredPlaceholder,
  unconfiguredPlaceholder,
  configuredDescription,
  changeLabel,
  cancelLabel,
  configured,
  editing,
  disabled,
  autoComplete,
  onEdit,
  onCancel,
  onChangeAfter
}: PaymentSecretFieldProps) => {
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
      description={configured ? configuredDescription : ""}
      configuredPlaceholder={configuredPlaceholder}
      unconfiguredPlaceholder={unconfiguredPlaceholder}
      changeLabel={changeLabel}
      cancelLabel={cancelLabel}
      configured={configured}
      editing={editing}
      disabled={disabled}
      invalid={fieldState.invalid}
      error={fieldState.error}
      autoComplete={autoComplete}
      onChangeAfter={onChangeAfter}
      onEdit={onEdit}
      onCancel={onCancel}
    />
  )
}

export { PaymentSecretField }
