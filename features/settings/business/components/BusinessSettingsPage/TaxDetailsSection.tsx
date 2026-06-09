"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { saveTaxDetailsSettings } from "../../mutations"
import { taxDetailsSettingsSchema, type TaxDetailsSettingsValues } from "../../schemas"

import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Spinner,
  toast,
  Typography
} from "@/components/ui"

type TaxDetailsSectionProps = {
  initialValues: TaxDetailsSettingsValues
}

const TaxDetailsSection = ({ initialValues }: TaxDetailsSectionProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<TaxDetailsSettingsValues>({
    resolver: zodResolver(taxDetailsSettingsSchema),
    mode: "onChange",
    defaultValues: initialValues
  })

  const { isDirty, isValid } = form.formState

  const onSubmit = (values: TaxDetailsSettingsValues) => {
    if (!isDirty || !isValid) return

    setServerError(null)

    startTransition(async () => {
      const result = await saveTaxDetailsSettings(values)

      if ("error" in result) {
        setServerError(result.error)

        return
      }

      form.reset(result.data.settings)

      router.refresh()

      toast.success(t("settings.business.taxDetailsSaved"))
    })
  }

  return (
    <section className="space-y-4">
      <Typography variant="h4">{t("settings.business.taxSection")}</Typography>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Controller
          name="businessTaxId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("settings.business.businessTaxId")}</FieldLabel>
              <Input
                {...field}
                id={field.name}
                placeholder={t("settings.business.businessTaxIdPlaceholder")}
                aria-invalid={fieldState.invalid}
                disabled={isPending}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {serverError && <FieldError className="sm:mr-auto">{serverError}</FieldError>}
          <Button type="submit" disabled={isPending || !(isDirty && isValid)}>
            {isPending && <Spinner />}
            {t("settings.business.saveTaxDetails")}
          </Button>
        </div>
      </form>
    </section>
  )
}

export { TaxDetailsSection }
