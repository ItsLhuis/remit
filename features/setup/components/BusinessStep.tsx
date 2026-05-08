"use client"

import { useState } from "react"

import Image from "next/image"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { saveBusinessProfile } from "../mutations"
import { businessProfileSchema, type BusinessProfileValues } from "../schemas"

import {
  Button,
  CountrySelect,
  CurrencySelect,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Spinner,
  Typography
} from "@/components/ui"

type BusinessStepProps = {
  onComplete: () => void
}

const BusinessStep = ({ onComplete }: BusinessStepProps) => {
  const { t } = useTranslation()

  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<BusinessProfileValues>({
    resolver: zodResolver(businessProfileSchema),
    mode: "onBlur",
    defaultValues: {
      businessName: "",
      businessEmail: "",
      businessTaxId: "",
      businessCountry: "",
      defaultCurrency: ""
    }
  })

  const { isSubmitting, isDirty, isValid } = form.formState

  const onSubmit = async (values: BusinessProfileValues) => {
    if (!isDirty || !isValid) return

    setServerError(null)

    const result = await saveBusinessProfile(values)

    if ("error" in result) {
      setServerError(result.error)
      return
    }

    onComplete()
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <Image src="/logo.png" alt={t("app.logoAlt")} width={64} height={64} className="mb-4" />
        <Typography variant="h2" className="mb-2">
          {t("setup.businessProfile.title")}
        </Typography>
        <Typography variant="p" affects={["muted", "removePMargin"]}>
          {t("setup.businessProfile.description")}
        </Typography>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Controller
          name="businessName"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                {t("setup.businessProfile.businessName")}
              </FieldLabel>
              <Input
                {...field}
                id={field.name}
                placeholder={t("setup.businessProfile.businessNamePlaceholder")}
                aria-invalid={fieldState.invalid}
                disabled={isSubmitting}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="businessEmail"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                {t("setup.businessProfile.businessEmail")}
              </FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="email"
                placeholder={t("setup.businessProfile.businessEmailPlaceholder")}
                aria-invalid={fieldState.invalid}
                disabled={isSubmitting}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="businessTaxId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                {t("setup.businessProfile.businessTaxId")}
              </FieldLabel>
              <Input
                {...field}
                id={field.name}
                placeholder={t("setup.businessProfile.businessTaxIdPlaceholder")}
                aria-invalid={fieldState.invalid}
                disabled={isSubmitting}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="businessCountry"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("common.fields.country")}</FieldLabel>
              <CountrySelect
                ref={field.ref}
                id={field.name}
                value={field.value}
                onChangeAction={(country) => field.onChange(country.alpha2)}
                valid={!fieldState.invalid}
                disabled={isSubmitting}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="defaultCurrency"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                {t("setup.businessProfile.defaultCurrency")}
              </FieldLabel>
              <CurrencySelect
                ref={field.ref}
                id={field.name}
                value={field.value}
                onValueChangeAction={field.onChange}
                currencies="all"
                variant="default"
                valid={!fieldState.invalid}
                disabled={isSubmitting}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Button
          type="submit"
          size="lg"
          className="mt-2 w-full"
          disabled={isSubmitting || !(isDirty && isValid)}
        >
          {isSubmitting && <Spinner />}
          {t("common.actions.continue")}
        </Button>
        {serverError && (
          <FieldError className="text-center" role="alert">
            {serverError}
          </FieldError>
        )}
      </form>
      <div className="mt-6 text-center">
        <Typography affects="small" className="text-muted-foreground">
          {t("setup.progress", { current: 1, total: 4 })}
        </Typography>
      </div>
    </div>
  )
}

export { BusinessStep }
