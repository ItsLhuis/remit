"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  Input,
  PhoneInput,
  Spinner,
  toast,
  Typography
} from "@/components/ui"

import { saveBusinessProfileSettings } from "../../mutations"
import { businessProfileSettingsSchema, type BusinessProfileSettingsValues } from "../../schemas"

type BusinessProfileSectionProps = {
  initialValues: BusinessProfileSettingsValues
}

const BusinessProfileSection = ({ initialValues }: BusinessProfileSectionProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<BusinessProfileSettingsValues>({
    resolver: zodResolver(businessProfileSettingsSchema),
    mode: "onChange",
    defaultValues: initialValues
  })

  const { isDirty, isValid } = form.formState

  const onSubmit = (values: BusinessProfileSettingsValues) => {
    if (!isDirty || !isValid) return

    setServerError(null)

    startTransition(async () => {
      const result = await saveBusinessProfileSettings(values)

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      form.reset(result.data.settings)

      router.refresh()

      toast.success(t("settings.business.profileSaved"))
    })
  }

  return (
    <section className="space-y-4">
      <Typography variant="h4">{t("settings.business.profileSection")}</Typography>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Controller
            name="businessName"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{t("settings.business.businessName")}</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  placeholder={t("settings.business.businessNamePlaceholder")}
                  aria-invalid={fieldState.invalid}
                  disabled={isPending}
                  autoComplete="organization"
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
                <FieldLabel htmlFor={field.name}>{t("settings.business.businessEmail")}</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="email"
                  placeholder={t("settings.business.businessEmailPlaceholder")}
                  aria-invalid={fieldState.invalid}
                  disabled={isPending}
                  autoComplete="email"
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="businessPhone"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{t("settings.business.businessPhone")}</FieldLabel>
                <PhoneInput
                  ref={field.ref}
                  id={field.name}
                  value={field.value}
                  onValueChangeAction={field.onChange}
                  placeholder={t("settings.business.businessPhonePlaceholder")}
                  valid={!fieldState.invalid}
                  disabled={isPending}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="businessWebsite"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  {t("settings.business.businessWebsite")}
                </FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="url"
                  placeholder={t("settings.business.businessWebsitePlaceholder")}
                  aria-invalid={fieldState.invalid}
                  disabled={isPending}
                  autoComplete="url"
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
            {t("settings.business.saveProfile")}
          </Button>
        </div>
      </form>
    </section>
  )
}

export { BusinessProfileSection }
