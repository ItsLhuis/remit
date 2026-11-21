"use client"

import { useState } from "react"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { authClient } from "@/lib/auth/client"

import {
  Button,
  DialogFooter,
  Field,
  FieldError,
  FieldLabel,
  PasswordInput,
  Spinner,
  toast,
  Typography
} from "@/components/ui"

import { changePasswordSchema, type ChangePasswordValues } from "../schemas"

import { PasswordRequirements } from "./PasswordRequirements"

type ChangePasswordFormProps = {
  variant?: "auth" | "settings"
  onSuccess?: () => void | Promise<void>
}

const DEFAULT_VALUES: ChangePasswordValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: ""
}

const ChangePasswordForm = ({ onSuccess, variant = "auth" }: ChangePasswordFormProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    mode: variant === "settings" ? "onChange" : "onSubmit",
    defaultValues: DEFAULT_VALUES
  })

  const { isSubmitting, isDirty, isValid } = form.formState

  const newPassword =
    useWatch({
      control: form.control,
      name: "newPassword"
    }) ?? ""

  const onSubmit = async (values: ChangePasswordValues) => {
    if (!isDirty || (variant === "settings" && !isValid)) return

    setSubmitError(null)

    const { error } = await authClient.changePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
      revokeOtherSessions: true
    })

    if (error) {
      setSubmitError(error.message ?? t("errors.somethingWentWrong"))

      return
    }

    if (variant === "settings") {
      form.reset(DEFAULT_VALUES)

      if (onSuccess) {
        await onSuccess()
      } else {
        toast.success(t("settings.security.changePassword.changed"), {
          description: t("settings.security.changePassword.changedDescription")
        })
      }

      return
    }

    router.push("/")
  }

  const isSubmitDisabled =
    variant === "settings" ? isSubmitting || !(isDirty && isValid) : isSubmitting || !isDirty

  return (
    <div className={variant === "auth" ? "w-full max-w-sm" : "w-full max-w-md"}>
      {variant === "auth" && (
        <div className="mb-8 flex flex-col items-center text-center">
          <Typography variant="h2" className="mb-2">
            {t("auth.changePassword.title")}
          </Typography>
          <Typography variant="p" affects={["muted", "removePMargin"]}>
            {t("auth.changePassword.description")}
          </Typography>
        </div>
      )}
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Controller
          name="currentPassword"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                {variant === "settings"
                  ? t("settings.security.changePassword.currentPassword")
                  : t("auth.changePassword.currentPassword")}
              </FieldLabel>
              <PasswordInput
                {...field}
                id={field.name}
                placeholder={
                  variant === "settings"
                    ? t("settings.security.changePassword.currentPasswordPlaceholder")
                    : t("auth.changePassword.currentPasswordPlaceholder")
                }
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
                disabled={isSubmitting}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="newPassword"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                {variant === "settings"
                  ? t("settings.security.changePassword.newPassword")
                  : t("auth.changePassword.newPassword")}
              </FieldLabel>
              <PasswordInput
                {...field}
                id={field.name}
                placeholder={
                  variant === "settings"
                    ? t("settings.security.changePassword.newPasswordPlaceholder")
                    : t("auth.changePassword.newPasswordPlaceholder")
                }
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
                disabled={isSubmitting}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              <PasswordRequirements password={newPassword} />
            </Field>
          )}
        />
        <Controller
          name="confirmPassword"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                {variant === "settings"
                  ? t("settings.security.changePassword.confirmPassword")
                  : t("auth.changePassword.confirmPassword")}
              </FieldLabel>
              <PasswordInput
                {...field}
                id={field.name}
                placeholder={
                  variant === "settings"
                    ? t("settings.security.changePassword.confirmPasswordPlaceholder")
                    : t("auth.changePassword.confirmPasswordPlaceholder")
                }
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
                disabled={isSubmitting}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        {submitError && (
          <FieldError className={variant === "auth" ? "text-center" : undefined}>
            {submitError}
          </FieldError>
        )}
        {variant === "settings" ? (
          <DialogFooter>
            <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitDisabled}>
              {isSubmitting && <Spinner />}
              {t("settings.security.changePassword.submit")}
            </Button>
          </DialogFooter>
        ) : (
          <Button type="submit" size="lg" className="mt-2 w-full" disabled={isSubmitDisabled}>
            {isSubmitting && <Spinner />}
            {t("auth.changePassword.submit")}
          </Button>
        )}
      </form>
    </div>
  )
}

export { ChangePasswordForm }
