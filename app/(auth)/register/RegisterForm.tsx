"use client"

import { useMemo, useState } from "react"

import { useRouter } from "next/navigation"

import { authClient } from "@/lib/authClient"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { accountSchema, passwordRules, type AccountValues } from "./schemas"

import Image from "next/image"

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
  const router = useRouter()

  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    mode: "onTouched",
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" }
  })

  const { isSubmitting } = form.formState

  const password =
    useWatch({
      control: form.control,
      name: "password"
    }) ?? ""

  const passwordChecks = useMemo(
    () => [
      {
        label: `At least ${passwordRules.minLength} characters`,
        valid: password.length >= passwordRules.minLength
      },
      { label: "1 uppercase letter", valid: passwordRules.hasUppercase.test(password) },
      { label: "1 lowercase letter", valid: passwordRules.hasLowercase.test(password) },
      { label: "1 number", valid: passwordRules.hasNumber.test(password) },
      { label: "1 special character", valid: passwordRules.hasSpecialChar.test(password) }
    ],
    [password]
  )
  const passedChecks = passwordChecks.filter((check) => check.valid).length

  const onSubmit = async (values: AccountValues) => {
    setServerError(null)

    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password
    })

    if (error) {
      setServerError(error.message ?? "Failed to create account.")

      return
    }

    router.push("/setup")
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <Image src="/logo.png" alt="Remit logo" width={64} height={64} className="mb-4" />
        <Typography variant="h2" className="mb-2">
          Create your account
        </Typography>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          Set up your Remit account to get started.
        </Typography>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Name</FieldLabel>
              <Input
                {...field}
                id={field.name}
                placeholder="Your name"
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
              <FieldLabel htmlFor={field.name}>Email</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="email"
                placeholder="Your email"
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
              <FieldLabel htmlFor={field.name}>Password</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="password"
                placeholder="Your password"
                aria-invalid={fieldState.invalid}
                disabled={isSubmitting}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              <div className="dark:bg-input/30 mt-2 rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <Typography affects="small">Password strength requirements</Typography>
                  <Typography affects="small" className="text-foreground font-medium">
                    {passedChecks}/{passwordChecks.length}
                  </Typography>
                </div>
                <Progress
                  className="mb-3"
                  value={(passedChecks / passwordChecks.length) * 100}
                  aria-label="Password requirements completion"
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
              <FieldLabel htmlFor={field.name}>Confirm password</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="password"
                placeholder="Repeat your password"
                aria-invalid={fieldState.invalid}
                disabled={isSubmitting}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Button type="submit" size="lg" className="mt-2 w-full" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          Create account
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
