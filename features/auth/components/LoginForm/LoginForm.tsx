"use client"

import { useState } from "react"

import { useRouter } from "next/navigation"

import Image from "next/image"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { authClient } from "@/lib/auth/client"

import { Button, Field, FieldError, FieldLabel, Input, Spinner, Typography } from "@/components/ui"

import { loginSchema, type LoginValues } from "../../schemas"

import { TotpForm } from "./TotpForm"

type LoginFormProps = {
  passwordResetAvailable: boolean
}

const LoginForm = ({ passwordResetAvailable }: LoginFormProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [authError, setAuthError] = useState<string | null>(null)
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    defaultValues: { email: "", password: "" }
  })

  const { isSubmitting, isDirty, isValid } = form.formState

  const onSubmit = async (values: LoginValues) => {
    if (!isDirty || !isValid) return

    setAuthError(null)

    const { data, error } = await authClient.signIn.email({
      email: values.email,
      password: values.password
    })

    if (error) {
      setAuthError(error.message ?? t("auth.login.invalidCredentials"))

      return
    }

    if (data && "twoFactorRedirect" in data) {
      setRequiresTwoFactor(true)

      return
    }

    router.push("/setup")
  }

  const requestPasswordReset = async () => {
    await authClient.requestPasswordReset({
      email: form.getValues("email"),
      redirectTo: new URL("/reset-password", window.location.origin).toString()
    })
  }

  if (requiresTwoFactor) {
    return <TotpForm onSuccess={() => router.push("/setup")} />
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <Image src="/logo.png" alt={t("app.logoAlt")} width={64} height={64} className="mb-4" />
        <Typography variant="h2" className="mb-2">
          {t("auth.login.title")}
        </Typography>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          {t("auth.login.description")}
        </Typography>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("common.fields.email")}</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="email"
                placeholder={t("auth.register.emailPlaceholder")}
                autoComplete="email"
                aria-invalid={fieldState.invalid}
                disabled={isSubmitting}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("common.fields.password")}</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="password"
                placeholder={t("auth.register.passwordPlaceholder")}
                autoComplete="current-password"
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
          {t("auth.login.submit")}
        </Button>
        {authError && (
          <FieldError className="text-center" role="alert">
            {authError}
          </FieldError>
        )}
        <div className="flex justify-center text-center">
          {passwordResetAvailable ? (
            <Button type="button" variant="link" size="sm" onClick={requestPasswordReset}>
              {t("auth.login.forgotPassword")}
            </Button>
          ) : (
            <Typography
              variant="p"
              affects={["muted", "small", "removePMargin"]}
              className="text-center leading-relaxed"
            >
              {t("auth.login.noSmtpHelpPrefix")}{" "}
              <code className="bg-muted text-muted-foreground inline-flex h-5 w-fit items-center rounded-sm px-1.5 font-mono text-xs font-medium select-all">
                {t("auth.login.noSmtpHelpCommand")}
              </code>{" "}
              {t("auth.login.noSmtpHelpSuffix")}
            </Typography>
          )}
        </div>
      </form>
    </div>
  )
}

export { LoginForm }
