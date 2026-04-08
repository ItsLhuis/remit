"use client"

import { useState } from "react"

import { authClient } from "@/lib/authClient"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { totpEnableSchema, type TotpEnableValues } from "./schemas"

import Image from "next/image"

import { Button, Field, FieldError, FieldLabel, Input, Spinner, Typography } from "@/components/ui"

type TotpEnableStepProps = {
  onSuccess: (totpUri: string) => void
}

const TotpEnableStep = ({ onSuccess }: TotpEnableStepProps) => {
  const [enableError, setEnableError] = useState<string | null>(null)

  const form = useForm<TotpEnableValues>({
    resolver: zodResolver(totpEnableSchema),
    mode: "onSubmit",
    defaultValues: { password: "" }
  })

  const { isSubmitting } = form.formState

  const onSubmit = async (values: TotpEnableValues) => {
    setEnableError(null)

    const { data, error } = await authClient.twoFactor.enable({ password: values.password })

    if (error) {
      setEnableError(error.message ?? "Failed to enable two-factor authentication.")
      return
    }

    if (!data?.totpURI) {
      setEnableError("Something went wrong. Please try again.")
      return
    }

    form.reset()
    onSuccess(data.totpURI)
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <Image src="/logo.png" alt="Remit logo" width={64} height={64} className="mb-4" />
        <Typography variant="h2" className="mb-2">
          Two-factor authentication
        </Typography>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          Add an extra layer of security to your account with a one-time code from your
          authenticator app.
        </Typography>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
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
            </Field>
          )}
        />
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          Set up authenticator
        </Button>
      </form>
      {enableError && (
        <FieldError className="mt-4 text-center" role="alert">
          {enableError}
        </FieldError>
      )}
      <div className="mt-6 text-center">
        <Typography affects="small" className="text-muted-foreground">
          Step 2 of 2
        </Typography>
      </div>
    </div>
  )
}

export { TotpEnableStep }
