"use client"

import { useMemo, useState } from "react"

import Image from "next/image"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { authClient } from "@/lib/authClient"

import { accountSchema, passwordRules, type AccountValues } from "../schemas"

import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  Icon,
  Input,
  Progress,
  Spinner,
  Typography
} from "@/components/ui"

const RegisterForm = () => {
  const { t } = useTranslation()

  const [serverError, setServerError] = useState<string | null>(null)

  const router = useRouter()

  const form = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    mode: "onTouched",
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" }
  })

  const { isSubmitting, isDirty, isValid } = form.formState

  const password =
    useWatch({
      control: form.control,
      name: "password"
    }) ?? ""

  const passwordChecks = useMemo(
    () => [
      {
        label: t("auth.register.passwordMinLength", { count: passwordRules.minLength }),
        valid: password.length >= passwordRules.minLength
      },
      {
        label: t("auth.register.passwordUppercase"),
        valid: passwordRules.hasUppercase.test(password)
      },
      {
        label: t("auth.register.passwordLowercase"),
        valid: passwordRules.hasLowercase.test(password)
      },
      { label: t("auth.register.passwordNumber"), valid: passwordRules.hasNumber.test(password) },
      {
        label: t("auth.register.passwordSpecial"),
        valid: passwordRules.hasSpecialChar.test(password)
      }
    ],
    [password, t]
  )
  const passedChecks = passwordChecks.filter((check) => check.valid).length

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
              <div className="dark:bg-input/30 mt-2 rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <Typography affects="small">{t("auth.register.passwordRequirements")}</Typography>
                  <Typography affects="small" className="text-foreground font-medium">
                    {passedChecks}/{passwordChecks.length}
                  </Typography>
                </div>
                <Progress
                  className="mb-3"
                  value={(passedChecks / passwordChecks.length) * 100}
                  aria-label={t("auth.register.passwordRequirementsProgress")}
                />
                <div className="space-y-1">
                  {passwordChecks.map((check) => (
                    <div
                      key={check.label}
                      className="flex items-center gap-2 rounded-sm px-1 py-0.5 transition-all"
                    >
                      <Icon
                        name={check.valid ? "CheckCircle2" : "Circle"}
                        className={
                          check.valid
                            ? "size-3.5 text-emerald-600 dark:text-emerald-500"
                            : "text-muted-foreground size-3.5"
                        }
                      />
                      <Typography
                        affects="small"
                        className={check.valid ? "text-foreground" : "text-muted-foreground"}
                      >
                        {check.label}
                      </Typography>
                    </div>
                  ))}
                </div>
              </div>
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
    </div>
  )
}

export { RegisterForm }
