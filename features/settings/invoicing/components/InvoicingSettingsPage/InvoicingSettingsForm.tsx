"use client"

import { useMemo, useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  NumberInput,
  Separator,
  Spinner,
  Textarea,
  toast,
  Typography
} from "@/components/ui"

import { saveInvoicingSettings } from "../../mutations"
import {
  createInvoicingSettingsSchema,
  type InvoicingSettingsInputValues,
  type InvoicingSettingsValues
} from "../../schemas"

type InvoicingSettingsFormProps = {
  initialValues: InvoicingSettingsValues
}

const InvoicingSettingsForm = ({ initialValues }: InvoicingSettingsFormProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [minimumNextInvoiceNumber, setMinimumNextInvoiceNumber] = useState(
    initialValues.nextInvoiceNumber
  )

  const [settingsError, setSettingsError] = useState<string | null>(null)

  const [isSaving, startSaving] = useTransition()

  const schema = useMemo(
    () => createInvoicingSettingsSchema(minimumNextInvoiceNumber),
    [minimumNextInvoiceNumber]
  )

  const form = useForm<InvoicingSettingsInputValues, unknown, InvoicingSettingsValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: initialValues
  })

  const { isDirty, isValid } = form.formState

  const onSubmit = (values: InvoicingSettingsValues) => {
    if (!isDirty || !isValid) return

    if (values.nextInvoiceNumber < minimumNextInvoiceNumber) {
      form.setError("nextInvoiceNumber", {
        type: "validate",
        message: t("settings.invoicing.validation.nextInvoiceNumberForward", {
          number: minimumNextInvoiceNumber
        })
      })

      return
    }

    setSettingsError(null)

    startSaving(async () => {
      const result = await saveInvoicingSettings(values)

      if ("error" in result) {
        setSettingsError(result.error)

        return
      }

      setMinimumNextInvoiceNumber(result.data.settings.nextInvoiceNumber)

      form.reset(result.data.settings)

      router.refresh()

      toast.success(t("settings.invoicing.saved"))
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <FieldGroup>
        <div className="space-y-1">
          <Typography variant="h4">{t("settings.invoicing.numberingSection")}</Typography>
          <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
            {t("settings.invoicing.numberingSectionDescription")}
          </Typography>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Controller
            name="invoicePrefix"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  {t("settings.invoicing.invoicePrefix")}
                </FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  placeholder={t("settings.invoicing.invoicePrefixPlaceholder")}
                  aria-invalid={fieldState.invalid}
                  disabled={isSaving}
                  autoComplete="off"
                />
                <FieldDescription>{t("settings.invoicing.invoicePrefixHelp")}</FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="numberPaddingWidth"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  {t("settings.invoicing.numberPaddingWidth")}
                </FieldLabel>
                <NumberInput
                  id={field.name}
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={(event) => field.onChange(Number(event.target.value))}
                  min={1}
                  max={10}
                  step={1}
                  inputMode="numeric"
                  aria-invalid={fieldState.invalid}
                  disabled={isSaving}
                />
                <FieldDescription>
                  {t("settings.invoicing.numberPaddingWidthHelp")}
                </FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="nextInvoiceNumber"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  {t("settings.invoicing.nextInvoiceNumber")}
                </FieldLabel>
                <NumberInput
                  id={field.name}
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={(event) => field.onChange(Number(event.target.value))}
                  min={minimumNextInvoiceNumber}
                  step={1}
                  inputMode="numeric"
                  aria-invalid={fieldState.invalid}
                  disabled={isSaving}
                />
                <FieldDescription>
                  {t("settings.invoicing.nextInvoiceNumberHelp", {
                    number: minimumNextInvoiceNumber
                  })}
                </FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="defaultHourlyRate"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  {t("settings.invoicing.defaultHourlyRate")}
                </FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  inputMode="decimal"
                  placeholder={t("settings.invoicing.defaultHourlyRatePlaceholder")}
                  aria-invalid={fieldState.invalid}
                  disabled={isSaving}
                  autoComplete="off"
                />
                <FieldDescription>{t("settings.invoicing.defaultHourlyRateHelp")}</FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="paymentTermsDays"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  {t("settings.invoicing.paymentTermsDays")}
                </FieldLabel>
                <NumberInput
                  id={field.name}
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={(event) => field.onChange(Number(event.target.value))}
                  min={0}
                  max={365}
                  step={1}
                  inputMode="numeric"
                  aria-invalid={fieldState.invalid}
                  disabled={isSaving}
                />
                <FieldDescription>{t("settings.invoicing.paymentTermsDaysHelp")}</FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </div>
      </FieldGroup>
      <Separator />
      <FieldGroup>
        <div className="space-y-1">
          <Typography variant="h4">{t("settings.invoicing.documentDefaultsSection")}</Typography>
          <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
            {t("settings.invoicing.documentDefaultsSectionDescription")}
          </Typography>
        </div>
        <Controller
          name="defaultNotesInvoice"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                {t("settings.invoicing.defaultNotesInvoice")}
              </FieldLabel>
              <Textarea
                {...field}
                id={field.name}
                rows={5}
                placeholder={t("settings.invoicing.defaultNotesInvoicePlaceholder")}
                aria-invalid={fieldState.invalid}
                disabled={isSaving}
              />
              <FieldDescription>{t("settings.invoicing.defaultNotesInvoiceHelp")}</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="defaultInvoiceFooter"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>
                {t("settings.invoicing.defaultInvoiceFooter")}
              </FieldLabel>
              <Textarea
                {...field}
                id={field.name}
                rows={4}
                placeholder={t("settings.invoicing.defaultInvoiceFooterPlaceholder")}
                aria-invalid={fieldState.invalid}
                disabled={isSaving}
              />
              <FieldDescription>
                {t("settings.invoicing.defaultInvoiceFooterHelp")}
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        {settingsError && <FieldError className="sm:mr-auto">{settingsError}</FieldError>}
        <Button type="submit" disabled={isSaving || !(isDirty && isValid)}>
          {isSaving && <Spinner />}
          {t("settings.invoicing.save")}
        </Button>
      </div>
    </form>
  )
}

export { InvoicingSettingsForm }
