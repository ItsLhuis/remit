"use client"

import { useState } from "react"

import { authClient } from "@/lib/authClient"

import { totpSchema, type TotpValues } from "@/features/auth/schemas"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import Image from "next/image"

import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  Spinner,
  Typography
} from "@/components/ui"

import { RecoveryCodeForm } from "./RecoveryCodeForm"

type TotpFormProps = {
  onSuccess: () => void
}

const TotpForm = ({ onSuccess }: TotpFormProps) => {
  const [useRecovery, setUseRecovery] = useState(false)

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
          {useRecovery
            ? "Enter one of your saved recovery codes."
            : "Enter the 6-digit code from your authenticator app."}
        </Typography>
      </div>
      {useRecovery ? (
        <RecoveryCodeForm onSuccess={onSuccess} />
      ) : (
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
      )}
      <div className="mt-4 text-center">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-3"
          onClick={() => setUseRecovery((v) => !v)}
        >
          {useRecovery ? "Use authenticator app instead" : "Use a recovery code instead"}
        </button>
      </div>
    </div>
  )
}

export { TotpForm }
