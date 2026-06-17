"use client"

import { useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"
import { Locales } from "@/lib/i18n/locales"

import {
  Button,
  CurrencySelect,
  Field,
  FieldError,
  FieldLabel,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  toast,
  Typography
} from "@/components/ui"

import { saveRegionalDefaultsSettings } from "../../mutations"
import { regionalDefaultsSettingsSchema, type RegionalDefaultsSettingsValues } from "../../schemas"

type RegionalDefaultsSectionProps = {
  initialValues: RegionalDefaultsSettingsValues
}

function getTimezoneOptions(): string[] {
  const intl = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[]
  }
  const supportedTimezones = intl.supportedValuesOf?.("timeZone") ?? []

  return ["UTC", ...supportedTimezones.filter((timezone) => timezone !== "UTC")]
}

function getLocaleOptions(): { code: string; label: string }[] {
  return Object.values(Locales).map((lang) => ({ code: lang.code, label: lang.name }))
}

const RegionalDefaultsSection = ({ initialValues }: RegionalDefaultsSectionProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<RegionalDefaultsSettingsValues>({
    resolver: zodResolver(regionalDefaultsSettingsSchema),
    mode: "onChange",
    defaultValues: initialValues
  })

  const { isDirty, isValid } = form.formState

  const timezoneOptions = useMemo(() => getTimezoneOptions(), [])
  const localeOptions = useMemo(() => getLocaleOptions(), [])

  const onSubmit = (values: RegionalDefaultsSettingsValues) => {
    if (!isDirty || !isValid) return

    setServerError(null)

    startTransition(async () => {
      const result = await saveRegionalDefaultsSettings(values)

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      form.reset(result.data.settings)

      router.refresh()

      toast.success(t("settings.business.defaultsSaved"))
    })
  }

  return (
    <section className="space-y-4">
      <Typography variant="h4">{t("settings.business.localeSection")}</Typography>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Controller
            name="defaultCurrency"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  {t("settings.business.defaultCurrency")}
                </FieldLabel>
                <CurrencySelect
                  ref={field.ref}
                  id={field.name}
                  value={field.value}
                  onValueChangeAction={field.onChange}
                  currencies="all"
                  variant="default"
                  valid={!fieldState.invalid}
                  disabled={isPending}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="defaultLocale"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{t("settings.business.defaultLocale")}</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={isPending}>
                  <SelectTrigger
                    ref={field.ref}
                    id={field.name}
                    className="w-full"
                    aria-invalid={fieldState.invalid}
                  >
                    <SelectValue placeholder={t("settings.business.selectLocale")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {localeOptions.map(({ code, label }) => (
                        <SelectItem key={code} value={code}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="defaultTimezone"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  {t("settings.business.defaultTimezone")}
                </FieldLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={isPending}>
                  <SelectTrigger
                    ref={field.ref}
                    id={field.name}
                    className="w-full"
                    aria-invalid={fieldState.invalid}
                  >
                    <SelectValue placeholder={t("settings.business.selectTimezone")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {timezoneOptions.map((timezone) => (
                        <SelectItem key={timezone} value={timezone}>
                          {timezone}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {serverError && <FieldError className="sm:mr-auto">{serverError}</FieldError>}
          <Button type="submit" disabled={isPending || !(isDirty && isValid)}>
            {isPending && <Spinner />}
            {t("settings.business.saveDefaults")}
          </Button>
        </div>
      </form>
    </section>
  )
}

export { RegionalDefaultsSection }
