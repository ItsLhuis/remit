"use client"

import { authClient } from "@/lib/authClient"

import { recoveryCodeSchema, type RecoveryCodeValues } from "@/features/auth/schemas"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { Button, Field, FieldError, FieldLabel, Input, Spinner } from "@/components/ui"

type RecoveryCodeFormProps = {
  onSuccess: () => void
}

const RecoveryCodeForm = ({ onSuccess }: RecoveryCodeFormProps) => {
  const form = useForm<RecoveryCodeValues>({
    resolver: zodResolver(recoveryCodeSchema),
    mode: "onSubmit",
    defaultValues: { code: "" }
  })

  const { isSubmitting } = form.formState

  const onSubmit = async (values: RecoveryCodeValues) => {
    const { error } = await authClient.twoFactor.verifyBackupCode({ code: values.code })

    if (error) {
      form.setError("code", { message: error.message ?? "Invalid recovery code." })

      return
    }

    onSuccess()
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <Controller
        name="code"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>Recovery code</FieldLabel>
            <Input
              {...field}
              id={field.name}
              type="text"
              placeholder="xxxxx-xxxxx"
              autoComplete="one-time-code"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={fieldState.invalid}
              disabled={isSubmitting}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Spinner />}
        Verify recovery code
      </Button>
    </form>
  )
}

export { RecoveryCodeForm }
