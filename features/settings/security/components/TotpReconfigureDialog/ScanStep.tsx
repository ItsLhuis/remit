"use client"

import { Fragment, useMemo, useState } from "react"

import { useTranslation } from "@/lib/i18n"

import { authClient } from "@/lib/auth/client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { totpVerifySchema, type TotpVerifyValues } from "../../schemas"

import {
  Button,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldError,
  FieldLabel,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  Spinner
} from "@/components/ui"

import { ManualEntryCode } from "./ManualEntryCode"
import { QrCodeDisplay } from "./QrCodeDisplay"

type ScanStepProps = {
  totpUri: string
  password: string
  onSuccess: (backupCodes: string[]) => void
}

const ScanStep = ({ totpUri, password, onSuccess }: ScanStepProps) => {
  const { t } = useTranslation()

  const [submitError, setSubmitError] = useState<string | null>(null)

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

    setSubmitError(null)

    const { error: verifyError } = await authClient.twoFactor.verifyTotp({ code: values.code })

    if (verifyError) {
      form.setError("code", {
        message: verifyError.message ?? t("totp.invalidCode")
      })

      return
    }

    const { data: codesData, error: codesError } = await authClient.twoFactor.generateBackupCodes({
      password
    })

    if (codesError || !codesData?.backupCodes?.length) {
      setSubmitError(t("settings.security.dialog.recoveryGenerationFailed"))

      return
    }

    onSuccess(codesData.backupCodes)
  }

  return (
    <Fragment>
      <DialogHeader>
        <DialogTitle>{t("totp.scanQr")}</DialogTitle>
        <DialogDescription>{t("totp.scanDescription")}</DialogDescription>
      </DialogHeader>
      <QrCodeDisplay totpUri={totpUri} />
      {secret && <ManualEntryCode secret={secret} />}
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
        {submitError && <FieldError>{submitError}</FieldError>}
        <DialogFooter>
          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={isSubmitting || !(isDirty && isValid)}
          >
            {isSubmitting && <Spinner />}
            {t("totp.verifyCode")}
          </Button>
        </DialogFooter>
      </form>
    </Fragment>
  )
}

export { ScanStep }
