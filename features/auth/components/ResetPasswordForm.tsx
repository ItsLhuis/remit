"use client"

import { useState } from "react"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { authClient } from "@/lib/authClient"

import { resetPasswordSchema, type ResetPasswordValues } from "../schemas"
import { PasswordRequirements } from "./PasswordRequirements"

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Spinner,
  Typography
} from "@/components/ui"

type ResetPasswordFormProps = {
  token: string | null
}

const ResetPasswordForm = ({ token }: ResetPasswordFormProps) => {
  const { t } = useTranslation()

  const [submitError, setSubmitError] = useState<string | null>(null)

  const router = useRouter()

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onTouched",
    defaultValues: { newPassword: "", confirmPassword: "" }
  })

  const { isSubmitting, isDirty, isValid } = form.formState

  const newPassword =
    useWatch({
      control: form.control,
      name: "newPassword"
    }) ?? ""

  const onSubmit = async (values: ResetPasswordValues) => {
    if (!token || !isDirty || !isValid) return

    setSubmitError(null)

    const { error } = await authClient.resetPassword({
      newPassword: values.newPassword,
      token
    })

    if (error) {
      setSubmitError(error.message ?? t("auth.resetPassword.failed"))

      return
    }

    router.push("/login")
  }

  if (!token) {
    return (
      <div className="w-full max-w-sm">
        <Typography variant="h2" className="mb-4 text-center">
          {t("auth.resetPassword.title")}
        </Typography>
        <Alert variant="destructive">
          <AlertTitle>{t("auth.resetPassword.invalidTitle")}</AlertTitle>
          <AlertDescription>{t("auth.resetPassword.invalidDescription")}</AlertDescription>
        </Alert>
        <Button asChild size="lg" className="mt-4 w-full">
          <Link href="/login">{t("auth.resetPassword.backToLogin")}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <Typography variant="h2" className="mb-2">
          {t("auth.resetPassword.title")}
        </Typography>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          {t("auth.resetPassword.description")}
        </Typography>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Controller
          name="newPassword"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("auth.resetPassword.newPassword")}</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="password"
                placeholder={t("auth.resetPassword.newPasswordPlaceholder")}
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
                {t("auth.resetPassword.confirmPassword")}
              </FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="password"
                placeholder={t("auth.resetPassword.confirmPasswordPlaceholder")}
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
          {t("auth.resetPassword.submit")}
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

export { ResetPasswordForm }
