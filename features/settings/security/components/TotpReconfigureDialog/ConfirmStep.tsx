"use client"

import { Fragment, useState } from "react"

import { authClient } from "@/lib/authClient"

import {
  confirmPasswordSchema,
  type ConfirmPasswordValues
} from "@/features/settings/security/schemas"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import {
  Button,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Spinner
} from "@/components/ui"

type ConfirmStepProps = {
  onSuccess: (totpUri: string, password: string) => void
}

const ConfirmStep = ({ onSuccess }: ConfirmStepProps) => {
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<ConfirmPasswordValues>({
    resolver: zodResolver(confirmPasswordSchema),
    mode: "onSubmit",
    defaultValues: { password: "" }
  })

  const { isSubmitting, isDirty, isValid } = form.formState

  const onSubmit = async (values: ConfirmPasswordValues) => {
    if (!isDirty || !isValid) return

    setSubmitError(null)

    const { data, error } = await authClient.twoFactor.enable({ password: values.password })

    if (error) {
      setSubmitError(error.message ?? "Failed to start reconfiguration. Check your password.")
      return
    }

    if (!data?.totpURI) {
      setSubmitError("Something went wrong. Please try again.")

      return
    }

    onSuccess(data.totpURI, values.password)
  }

  return (
    <Fragment>
      <DialogHeader>
        <DialogTitle>Reconfigure two-factor authentication</DialogTitle>
        <DialogDescription>
          Your current TOTP secret will be replaced immediately. Do not close this dialog until you
          have scanned the new QR code and saved your recovery codes.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Confirm your password</FieldLabel>
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
        {submitError && <FieldError>{submitError}</FieldError>}
        <DialogFooter>
          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={isSubmitting || !(isDirty && isValid)}
          >
            {isSubmitting && <Spinner />}
            Continue
          </Button>
        </DialogFooter>
      </form>
    </Fragment>
  )
}

export { ConfirmStep }
