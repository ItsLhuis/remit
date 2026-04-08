"use client"

import { useState } from "react"

import { useRouter } from "next/navigation"

import { authClient } from "@/lib/authClient"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { loginSchema, totpSchema, type LoginValues, type TotpValues } from "./schemas"

import Image from "next/image"

import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  Input,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  Spinner,
  Typography
} from "@/components/ui"

const TotpForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const form = useForm<TotpValues>({
    resolver: zodResolver(totpSchema),
    mode: "onSubmit",
    defaultValues: { code: "" }
  })

  const { isSubmitting } = form.formState

  const onSubmit = async (values: TotpValues) => {
    const { error } = await authClient.twoFactor.verifyTotp({ code: values.code })

    if (error) {
      form.setError("code", { message: error.message ?? "Invalid code. Please try again." })
      return
    }

    onSuccess()
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <Image src="/logo.png" alt="Remit logo" width={64} height={64} className="mb-4" />
        <Typography variant="h2" className="mb-2">
          Two-factor authentication
        </Typography>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          Enter the 6-digit code from your authenticator app.
        </Typography>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Controller
          name="code"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Verification code</FieldLabel>
              <InputOTP
                {...field}
                id={field.name}
                maxLength={6}
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="\d*"
                disabled={isSubmitting}
                aria-invalid={fieldState.invalid}
              >
                <InputOTPGroup className="w-full">
                  <InputOTPSlot index={0} className="w-full" />
                  <InputOTPSlot index={1} className="w-full" />
                  <InputOTPSlot index={2} className="w-full" />
                  <InputOTPSlot index={3} className="w-full" />
                  <InputOTPSlot index={4} className="w-full" />
                  <InputOTPSlot index={5} className="w-full" />
                </InputOTPGroup>
              </InputOTP>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          Verify code
        </Button>
      </form>
    </div>
  )
}

const LoginForm = () => {
  const router = useRouter()

  const [authError, setAuthError] = useState<string | null>(null)

  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: "onSubmit",
    defaultValues: { email: "", password: "" }
  })

  const { isSubmitting } = form.formState

  const onSubmit = async (values: LoginValues) => {
    setAuthError(null)

    const { data, error } = await authClient.signIn.email({
      email: values.email,
      password: values.password
    })

    if (error) {
      setAuthError(error.message ?? "Invalid email or password.")
      return
    }

    if (data && "twoFactorRedirect" in data) {
      setRequiresTwoFactor(true)
      return
    }

    router.push("/setup")
  }

  if (requiresTwoFactor) {
    return <TotpForm onSuccess={() => router.push("/setup")} />
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <Image src="/logo.png" alt="Remit logo" width={64} height={64} className="mb-4" />
        <Typography variant="h2" className="mb-2">
          Welcome Back
        </Typography>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          Enter your email and password to access your account
        </Typography>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
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
              <FieldLabel htmlFor={field.name}>Password</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="password"
                placeholder="Your password"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
                disabled={isSubmitting}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Button type="submit" size="lg" className="mt-2 w-full" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          Sign in
        </Button>
        {authError && (
          <FieldError className="text-center" role="alert">
            {authError}
          </FieldError>
        )}
      </form>
    </div>
  )
}

export { LoginForm }
