"use client"

import { useState } from "react"

import Image from "next/image"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { authClient } from "@/lib/authClient"

import { totpEnableSchema, type TotpEnableValues } from "../schemas"

import { Button, Field, FieldError, FieldLabel, Input, Spinner, Typography } from "@/components/ui"

export type TotpEnableData = {
  totpUri: string
  backupCodes: string[]
}

type TotpEnableStepProps = {
  onSuccess: (data: TotpEnableData) => void
}

const TotpEnableStep = ({ onSuccess }: TotpEnableStepProps) => {
  const { t } = useTranslation()

  const [enableError, setEnableError] = useState<string | null>(null)

  const form = useForm<TotpEnableValues>({
    resolver: zodResolver(totpEnableSchema),
    mode: "onSubmit",
    defaultValues: { password: "" }
  })

  const { isSubmitting, isDirty, isValid } = form.formState

  const onSubmit = async (values: TotpEnableValues) => {
    if (!isDirty || !isValid) return

    setEnableError(null)

    const { data: enableData, error: enableErr } = await authClient.twoFactor.enable({
      password: values.password
    })

    if (enableErr) {
      setEnableError(enableErr.message ?? t("setup.errors.totpEnableFailed"))
      return
    }

    if (!enableData?.totpURI) {
      setEnableError(t("setup.errors.totpUriMissing"))
      return
    }

    if (!enableData.backupCodes?.length) {
      setEnableError(t("setup.errors.recoveryCodesMissing"))
      return
    }

    form.reset()
    onSuccess({ totpUri: enableData.totpURI, backupCodes: enableData.backupCodes })
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <Image src="/logo.png" alt={t("app.logoAlt")} width={64} height={64} className="mb-4" />
        <Typography variant="h2" className="mb-2">
          {t("totp.title")}
        </Typography>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          {t("setup.totp.description")}
        </Typography>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("common.fields.password")}</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="password"
                placeholder={t("setup.totp.passwordPlaceholder")}
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
          {t("setup.totp.setupAuthenticator")}
        </Button>
      </form>
      {enableError && <FieldError className="mt-4 text-center">{enableError}</FieldError>}
      <div className="mt-6 text-center">
        <Typography affects="small" className="text-muted-foreground">
          {t("setup.progress", { current: 2, total: 4 })}
        </Typography>
      </div>
    </div>
  )
}

export { TotpEnableStep }
