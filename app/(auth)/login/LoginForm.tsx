"use client"

import { useState } from "react"

import { authClient } from "@/lib/authClient"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { loginSchema, type LoginValues } from "./schema"

import Image from "next/image"

import { Button, Field, FieldError, FieldLabel, Input, Spinner, Typography } from "@/components/ui"

const LoginForm = () => {
  const [authError, setAuthError] = useState<string | null>(null)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" }
  })

  const { isSubmitting } = form.formState

  const onSubmit = async (values: LoginValues) => {
    setAuthError(null)

    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
      callbackURL: "/dashboard"
    })

    if (error) {
      setAuthError(error.message ?? "Invalid email or password.")
    }
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
                placeholder="Enter your email"
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
                placeholder="Enter your password"
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
