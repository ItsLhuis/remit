"use client"

import { Fragment, useState } from "react"

import { useTranslation } from "@/lib/i18n"

import { authClient } from "@/lib/auth/client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { confirmPasswordSchema, type ConfirmPasswordValues } from "../../schemas"

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
  const { t } = useTranslation()

  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<ConfirmPasswordValues>({
    resolver: zodResolver(confirmPasswordSchema),
    mode: "onChange",
    defaultValues: { password: "" }
  })

  const { isSubmitting, isDirty, isValid } = form.formState

  const onSubmit = async (values: ConfirmPasswordValues) => {
    if (!isDirty || !isValid) return

    setSubmitError(null)

    const { data, error } = await authClient.twoFactor.enable({ password: values.password })

    if (error) {
      setSubmitError(error.message ?? t("settings.security.dialog.startFailed"))

      return
    }

    if (!data?.totpURI) {
      setSubmitError(t("errors.somethingWentWrong"))

      return
    }

    onSuccess(data.totpURI, values.password)
  }

  return (
    <Fragment>
      <DialogHeader>
        <DialogTitle>{t("settings.security.dialog.confirmTitle")}</DialogTitle>
        <DialogDescription>{t("settings.security.dialog.confirmDescription")}</DialogDescription>
      </DialogHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                {t("settings.security.dialog.confirmPassword")}
              </FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="password"
                placeholder={t("auth.register.passwordPlaceholder")}
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
            {t("common.actions.continue")}
          </Button>
        </DialogFooter>
      </form>
    </Fragment>
  )
}

export { ConfirmStep }
