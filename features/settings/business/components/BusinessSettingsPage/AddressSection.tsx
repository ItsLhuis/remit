"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  CountrySelect,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Spinner,
  toast,
  Typography
} from "@/components/ui"

import { saveBusinessAddressSettings } from "../../mutations"
import { businessAddressSettingsSchema, type BusinessAddressSettingsValues } from "../../schemas"

type AddressSectionProps = {
  initialValues: BusinessAddressSettingsValues
}

const AddressSection = ({ initialValues }: AddressSectionProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<BusinessAddressSettingsValues>({
    resolver: zodResolver(businessAddressSettingsSchema),
    mode: "onChange",
    defaultValues: initialValues
  })

  const { isDirty, isValid } = form.formState

  const onSubmit = (values: BusinessAddressSettingsValues) => {
    if (!isDirty || !isValid) return

    setServerError(null)

    startTransition(async () => {
      const result = await saveBusinessAddressSettings(values)

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      form.reset(result.data.settings)

      router.refresh()

      toast.success(t("settings.business.addressSaved"))
    })
  }

  return (
    <section className="space-y-4">
      <Typography variant="h4">{t("settings.business.addressSection")}</Typography>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Controller
            name="businessAddressLine1"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{t("settings.business.addressLine1")}</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  placeholder={t("settings.business.addressLine1Placeholder")}
                  aria-invalid={fieldState.invalid}
                  disabled={isPending}
                  autoComplete="address-line1"
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="businessAddressLine2"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{t("settings.business.addressLine2")}</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  placeholder={t("settings.business.addressLine2Placeholder")}
                  aria-invalid={fieldState.invalid}
                  disabled={isPending}
                  autoComplete="address-line2"
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="businessCity"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{t("settings.business.city")}</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  placeholder={t("settings.business.cityPlaceholder")}
                  aria-invalid={fieldState.invalid}
                  disabled={isPending}
                  autoComplete="address-level2"
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="businessState"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{t("settings.business.state")}</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  placeholder={t("settings.business.statePlaceholder")}
                  aria-invalid={fieldState.invalid}
                  disabled={isPending}
                  autoComplete="address-level1"
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="businessPostalCode"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{t("settings.business.postalCode")}</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  placeholder={t("settings.business.postalCodePlaceholder")}
                  aria-invalid={fieldState.invalid}
                  disabled={isPending}
                  autoComplete="postal-code"
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
                <FieldLabel htmlFor={field.name}>{t("settings.business.country")}</FieldLabel>
                <CountrySelect
                  ref={field.ref}
                  id={field.name}
                  value={field.value}
                  onChangeAction={(country) => field.onChange(country?.alpha2 ?? "")}
                  valid={!fieldState.invalid}
                  disabled={isPending}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {serverError && <FieldError className="sm:mr-auto">{serverError}</FieldError>}
          <Button type="submit" disabled={isPending || !(isDirty && isValid)}>
            {isPending && <Spinner />}
            {t("settings.business.saveAddress")}
          </Button>
        </div>
      </form>
    </section>
  )
}

export { AddressSection }
