"use client"

import { useMemo } from "react"

import Image from "next/image"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { QRCodeSVG } from "qrcode.react"

import { useTranslation } from "@/lib/i18n"

import { authClient } from "@/lib/auth/client"

import {
  Button,
  CopyIcon,
  Field,
  FieldError,
  FieldLabel,
  IconButton,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  Spinner,
  StepProgress,
  Typography
} from "@/components/ui"

import { useCopyWithFeedback } from "@/hooks"

import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from "../constants/onboarding"
import { totpVerifySchema, type TotpVerifyValues } from "../schemas"

type TotpVerifyStepProps = {
  totpUri: string
  onComplete: () => void
}

const TotpVerifyStep = ({ totpUri, onComplete }: TotpVerifyStepProps) => {
  const { t } = useTranslation()

  const { copied: isSecretCopied, copy: copySecret } = useCopyWithFeedback()

  const secret = useMemo(() => {
    try {
      return new URL(totpUri).searchParams.get("secret")
    } catch {
      return null
    }
  }, [totpUri])

  const form = useForm<TotpVerifyValues>({
    resolver: zodResolver(totpVerifySchema),
    mode: "onChange",
    defaultValues: { code: "" }
  })

  const { isSubmitting, isDirty, isValid } = form.formState

  const onSubmit = async (values: TotpVerifyValues) => {
    if (!isDirty || !isValid) return

    const { error } = await authClient.twoFactor.verifyTotp({ code: values.code })

    if (error) {
      form.setError("code", { message: error.message ?? t("totp.invalidCode") })

      return
    }

    onComplete()
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <Image src="/logo.png" alt={t("app.logoAlt")} width={64} height={64} className="mb-4" />
        <Typography variant="h2" className="mb-2">
          {t("totp.scanQr")}
        </Typography>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          {t("totp.scanDescription")}
        </Typography>
      </div>
      <div className="mx-auto mb-6 flex w-fit justify-center rounded-lg border bg-white p-4">
        <QRCodeSVG value={totpUri} bgColor="white" size={200} />
      </div>
      {secret && (
        <div className="dark:bg-input/30 mb-6 rounded-lg border p-3">
          <Typography affects="small" className="text-muted-foreground">
            {t("totp.manualEntryCode")}
          </Typography>
          <div className="mt-1 flex items-center gap-3">
            <Typography
              variant="p"
              affects={["bold", "removePMargin"]}
              className="min-w-0 flex-1 font-mono break-all"
              title={secret}
            >
              {secret}
            </Typography>
            <IconButton
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => secret && copySecret(secret)}
              label={t("totp.copyManualEntryCode")}
            >
              <CopyIcon copied={isSecretCopied} />
            </IconButton>
          </div>
        </div>
      )}
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
      <StepProgress
        className="mt-6 text-center"
        label={t("setup.progress", {
          current: ONBOARDING_STEPS.totpVerify,
          total: ONBOARDING_TOTAL_STEPS
        })}
      />
    </div>
  )
}

export { TotpVerifyStep }
