"use client"

import { useState } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import { authClient } from "@/lib/auth/client"

import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from "@/features/setup"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { accountSchema, type AccountValues } from "../schemas"

import Image from "next/image"

import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Spinner,
  StepProgress,
  Typography
} from "@/components/ui"

import { PasswordRequirements } from "./PasswordRequirements"

const RegisterForm = () => {
  const { t } = useTranslation()

  const [serverError, setServerError] = useState<string | null>(null)

  const router = useRouter()

  const form = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    mode: "onChange",
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" }
  })

  const { isSubmitting, isDirty, isValid } = form.formState

  const password =
    useWatch({
      control: form.control,
      name: "password"
    }) ?? ""

  const onSubmit = async (values: AccountValues) => {
    if (!isDirty || !isValid) return

    setServerError(null)

    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password
    })

    if (error) {
      setServerError(error.message ?? t("auth.register.failed"))

      return
    }

    router.push("/setup")
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <Image src="/logo.png" alt={t("app.logoAlt")} width={64} height={64} className="mb-4" />
        <Typography variant="h2" className="mb-2">
          {t("auth.register.title")}
        </Typography>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          {t("auth.register.description")}
        </Typography>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("common.fields.name")}</FieldLabel>
              <Input
                {...field}
                id={field.name}
                placeholder={t("auth.register.namePlaceholder")}
                aria-invalid={fieldState.invalid}
                disabled={isSubmitting}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
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
                aria-invalid={fieldState.invalid}
                disabled={isSubmitting}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              <PasswordRequirements password={password} />
            </Field>
          )}
        />
        <Controller
          name="confirmPassword"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("auth.register.confirmPassword")}</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="password"
                placeholder={t("auth.register.confirmPasswordPlaceholder")}
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
          {t("auth.register.submit")}
        </Button>
        {serverError && (
          <FieldError className="text-center" role="alert">
            {serverError}
          </FieldError>
        )}
      </form>
      <StepProgress
        className="mt-6 text-center"
        label={t("setup.progress", {
          current: ONBOARDING_STEPS.account,
          total: ONBOARDING_TOTAL_STEPS
        })}
      />
    </div>
  )
}

export { RegisterForm }
