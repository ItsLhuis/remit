"use client"

import { useState } from "react"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { authClient } from "@/lib/authClient"

import { changePasswordSchema, type ChangePasswordValues } from "../schemas"
import { PasswordRequirements } from "./PasswordRequirements"

import { Button, Field, FieldError, FieldLabel, Input, Spinner, Typography } from "@/components/ui"

const ChangePasswordForm = () => {
  const { t } = useTranslation()

  const [submitError, setSubmitError] = useState<string | null>(null)

  const router = useRouter()

  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onTouched",
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" }
  })

  const { isSubmitting, isDirty, isValid } = form.formState

  const newPassword =
    useWatch({
      control: form.control,
      name: "newPassword"
    }) ?? ""

  const onSubmit = async (values: ChangePasswordValues) => {
    if (!isDirty || !isValid) return

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

    router.push("/")
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <Typography variant="h2" className="mb-2">
          {t("auth.changePassword.title")}
        </Typography>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          {t("auth.changePassword.description")}
        </Typography>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Controller
          name="currentPassword"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                {t("auth.changePassword.currentPassword")}
              </FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="password"
                placeholder={t("auth.changePassword.currentPasswordPlaceholder")}
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
              <FieldLabel htmlFor={field.name}>{t("auth.changePassword.newPassword")}</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="password"
                placeholder={t("auth.changePassword.newPasswordPlaceholder")}
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
                {t("auth.changePassword.confirmPassword")}
              </FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="password"
                placeholder={t("auth.changePassword.confirmPasswordPlaceholder")}
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
                disabled={isSubmitting}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Button
          type="submit"
          size="lg"
          className="mt-2 w-full"
          disabled={isSubmitting || !(isDirty && isValid)}
        >
          {isSubmitting && <Spinner />}
          {t("auth.changePassword.submit")}
        </Button>
        {submitError && (
          <FieldError className="text-center" role="alert">
            {submitError}
          </FieldError>
        )}
      </form>
    </div>
  )
}

export { ChangePasswordForm }
