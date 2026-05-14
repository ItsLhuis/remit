"use client"

import { useState } from "react"

import { useTranslation } from "@/lib/i18n"

import { authClient } from "@/lib/auth/client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { totpSchema, type TotpValues } from "../../schemas"

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
  const { t } = useTranslation()

  const [useRecovery, setUseRecovery] = useState(false)

  const form = useForm<TotpValues>({
    resolver: zodResolver(totpSchema),
    mode: "onChange",
    defaultValues: { code: "" }
  })

  const { isSubmitting, isDirty, isValid } = form.formState

  const onSubmit = async (values: TotpValues) => {
    if (!isDirty || !isValid) return

    const { error } = await authClient.twoFactor.verifyTotp({ code: values.code })

    if (error) {
      form.setError("code", { message: error.message ?? t("totp.invalidCode") })

      return
    }

    onSuccess()
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <Image src="/logo.png" alt={t("app.logoAlt")} width={64} height={64} className="mb-4" />
        <Typography variant="h2" className="mb-2">
          {t("totp.title")}
        </Typography>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          {useRecovery ? t("recoveryCode.description") : t("auth.totp.authenticatorDescription")}
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
                <FieldLabel htmlFor={field.name}>{t("totp.codeLabel")}</FieldLabel>
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
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isSubmitting || !(isDirty && isValid)}
          >
            {isSubmitting && <Spinner />}
            {t("totp.verifyCode")}
          </Button>
        </form>
      )}
      <div className="mt-4 text-center">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-3"
          onClick={() => setUseRecovery((v) => !v)}
        >
          {useRecovery ? t("totp.useAuthenticator") : t("totp.useRecoveryCode")}
        </button>
      </div>
    </div>
  )
}

export { TotpForm }
