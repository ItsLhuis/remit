"use client"

import { useTranslation } from "@/lib/i18n"

import { authClient } from "@/lib/auth/client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { recoveryCodeSchema, type RecoveryCodeValues } from "../../schemas"

import { Button, Field, FieldError, FieldLabel, Input, Spinner } from "@/components/ui"

type RecoveryCodeFormProps = {
  onSuccess: () => void
}

const RecoveryCodeForm = ({ onSuccess }: RecoveryCodeFormProps) => {
  const { t } = useTranslation()

  const form = useForm<RecoveryCodeValues>({
    resolver: zodResolver(recoveryCodeSchema),
    mode: "onChange",
    defaultValues: { code: "" }
  })

  const { isSubmitting, isDirty, isValid } = form.formState

  const onSubmit = async (values: RecoveryCodeValues) => {
    if (!isDirty || !isValid) return

    const { error } = await authClient.twoFactor.verifyBackupCode({ code: values.code })

    if (error) {
      form.setError("code", { message: error.message ?? t("recoveryCode.invalid") })

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
            <FieldLabel htmlFor={field.name}>{t("recoveryCode.label")}</FieldLabel>
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
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isSubmitting || !(isDirty && isValid)}
      >
        {isSubmitting && <Spinner />}
        {t("recoveryCode.verify")}
      </Button>
    </form>
  )
}

export { RecoveryCodeForm }
