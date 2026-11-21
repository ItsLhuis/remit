"use client"

import { type ComponentProps, type Ref } from "react"

import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/Button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/Field"
import { Input } from "@/components/ui/Input"

type SecretFieldValidationError = {
  message?: string
}

type SecretFieldProps = {
  id: string
  name: string
  label: string
  value: string
  onChange: NonNullable<ComponentProps<"input">["onChange"]>
  onBlur?: ComponentProps<"input">["onBlur"]
  inputRef?: Ref<HTMLInputElement>
  configured: boolean
  editing: boolean
  configuredPlaceholder: string
  unconfiguredPlaceholder: string
  changeLabel: string
  cancelLabel: string
  disabled?: boolean
  type?: ComponentProps<"input">["type"]
  autoComplete?: ComponentProps<"input">["autoComplete"]
  description?: string
  invalid?: boolean
  error?: SecretFieldValidationError
  className?: string
  onEdit: () => void
  onCancel: () => void
  onChangeAfter?: () => void
}

const SecretField = ({
  id,
  name,
  label,
  value,
  onChange,
  onBlur,
  inputRef,
  configured,
  editing,
  configuredPlaceholder,
  unconfiguredPlaceholder,
  changeLabel,
  cancelLabel,
  disabled = false,
  type = "password",
  autoComplete = "off",
  description,
  invalid = false,
  error,
  className,
  onEdit,
  onCancel,
  onChangeAfter
}: SecretFieldProps) => {
  const showConfigured = configured && !editing

  const inputDisabled = disabled || showConfigured

  const descriptionId = description ? `${id}-description` : undefined
  const errorId = invalid ? `${id}-error` : undefined
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined

  const handleChange: NonNullable<ComponentProps<"input">["onChange"]> = (event) => {
    onChange(event)
    queueMicrotask(() => onChangeAfter?.())
  }

  return (
    <Field data-slot="secret-field" data-invalid={invalid} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-start gap-2">
        <Input
          ref={inputRef}
          id={id}
          name={name}
          type={type}
          value={showConfigured ? "" : value}
          onChange={handleChange}
          onBlur={onBlur}
          placeholder={showConfigured ? configuredPlaceholder : unconfiguredPlaceholder}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          disabled={inputDisabled}
          autoComplete={autoComplete}
          className={cn("flex-1")}
        />
        {configured ? (
          showConfigured ? (
            <Button type="button" variant="outline" onClick={onEdit} disabled={disabled}>
              {changeLabel}
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={onCancel} disabled={disabled}>
              {cancelLabel}
            </Button>
          )
        ) : null}
      </div>
      {description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
      {invalid ? <FieldError id={errorId} errors={[error]} /> : null}
    </Field>
  )
}

export { SecretField }
