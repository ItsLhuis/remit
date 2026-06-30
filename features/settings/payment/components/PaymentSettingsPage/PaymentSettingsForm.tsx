"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Icon,
  Input,
  Separator,
  Spinner,
  Textarea,
  toast,
  Typography
} from "@/components/ui"

import { savePaymentSettings, testStripeConnection } from "../../mutations"
import {
  paymentSettingsSchema,
  type PaymentSettingsInputValues,
  type PaymentSettingsValues
} from "../../schemas"

import { PaymentSecretField } from "./PaymentSecretField"

const STRIPE_TEST_DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short"
})

type PaymentSettingsFormProps = {
  initialValues: PaymentSettingsValues
  initialStripeTestConnectionAt: string | null
}

function getSecretSafePaymentSettingsValues(values: PaymentSettingsValues): PaymentSettingsValues {
  return {
    ...values,
    paymentIban: values.paymentIbanConfigured ? "" : values.paymentIban,
    stripeSecretKey: values.stripeSecretKeyConfigured ? "" : values.stripeSecretKey,
    stripeWebhookSecret: values.stripeWebhookSecretConfigured ? "" : values.stripeWebhookSecret
  }
}

const PaymentSettingsForm = ({
  initialValues,
  initialStripeTestConnectionAt
}: PaymentSettingsFormProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [stripeTestConnectionAt, setStripeTestConnectionAt] = useState<string | null>(
    initialStripeTestConnectionAt
  )

  const [editing, setEditing] = useState({
    paymentIban: false,
    stripeSecretKey: false,
    stripeWebhookSecret: false
  })

  const [isSaving, startSaving] = useTransition()
  const [isTesting, startTesting] = useTransition()

  const form = useForm<PaymentSettingsInputValues, unknown, PaymentSettingsValues>({
    resolver: zodResolver(paymentSettingsSchema),
    mode: "onChange",
    defaultValues: getSecretSafePaymentSettingsValues(initialValues)
  })

  const { isDirty, isValid } = form.formState

  const paymentIbanConfigured = useWatch({
    control: form.control,
    name: "paymentIbanConfigured"
  })
  const stripePublishableKey = useWatch({
    control: form.control,
    name: "stripePublishableKey"
  })
  const stripeSecretKeyConfigured = useWatch({
    control: form.control,
    name: "stripeSecretKeyConfigured"
  })
  const stripeWebhookSecretConfigured = useWatch({
    control: form.control,
    name: "stripeWebhookSecretConfigured"
  })

  const stripeConfigured = Boolean(stripePublishableKey.trim() && stripeSecretKeyConfigured)

  const onSubmit = (values: PaymentSettingsValues) => {
    if (!isDirty || !isValid) return

    setSettingsError(null)

    startSaving(async () => {
      const result = await savePaymentSettings(values)

      if ("error" in result) {
        setSettingsError(result.error)

        return
      }

      form.reset(getSecretSafePaymentSettingsValues(result.data.settings))

      setStripeTestConnectionAt(result.data.settings.stripeTestConnectionAt)
      setEditing({ paymentIban: false, stripeSecretKey: false, stripeWebhookSecret: false })

      router.refresh()

      toast.success(t("settings.payment.saved"))
    })
  }

  const onTestStripe = () => {
    if (isDirty || !stripeConfigured) return

    setTestError(null)

    startTesting(async () => {
      const result = await testStripeConnection({})

      if ("error" in result) {
        setTestError(result.error)
        toast.error(result.error)

        return
      }

      setStripeTestConnectionAt(result.data.stripeTestConnectionAt)

      router.refresh()

      toast.success(t("settings.payment.stripeTestSucceeded"))
    })
  }

  return (
    <div className="space-y-8">
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        <FieldGroup>
          <div className="space-y-1">
            <Typography variant="h4">{t("settings.payment.bankSection")}</Typography>
            <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
              {t("settings.payment.bankSectionDescription")}
            </Typography>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Controller
              name="paymentBankName"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{t("settings.payment.bankName")}</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    placeholder={t("settings.payment.bankNamePlaceholder")}
                    aria-invalid={fieldState.invalid}
                    disabled={isSaving || isTesting}
                    autoComplete="organization"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <PaymentSecretField
              control={form.control}
              name="paymentIban"
              label={t("settings.payment.iban")}
              configuredPlaceholder={t("settings.payment.configuredPlaceholder")}
              unconfiguredPlaceholder={t("settings.payment.ibanPlaceholder")}
              configuredDescription={t("settings.payment.encryptedValuePreserved")}
              changeLabel={t("settings.payment.changeSecret")}
              cancelLabel={t("common.actions.cancel")}
              configured={paymentIbanConfigured}
              editing={editing.paymentIban}
              disabled={isSaving || isTesting}
              onEdit={() => {
                form.setValue("paymentIban", "", { shouldValidate: true })
                setEditing((prev) => ({ ...prev, paymentIban: true }))
              }}
              onCancel={() => {
                setEditing((prev) => ({ ...prev, paymentIban: false }))
                form.setValue("paymentIban", "", { shouldValidate: true })
              }}
            />
          </div>
          <Controller
            name="paymentInstructions"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  {t("settings.payment.paymentInstructions")}
                </FieldLabel>
                <Textarea
                  {...field}
                  id={field.name}
                  rows={4}
                  placeholder={t("settings.payment.paymentInstructionsPlaceholder")}
                  aria-invalid={fieldState.invalid}
                  disabled={isSaving || isTesting}
                />
                <FieldDescription>{t("settings.payment.paymentInstructionsHelp")}</FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </FieldGroup>
        <Separator />
        <FieldGroup>
          <div className="space-y-1">
            <Typography variant="h4">{t("settings.payment.stripeSection")}</Typography>
            <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
              {t("settings.payment.stripeSectionDescription")}
            </Typography>
          </div>
          <Controller
            name="stripePublishableKey"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  {t("settings.payment.stripePublishableKey")}
                </FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  placeholder={t("settings.payment.stripePublishableKeyPlaceholder")}
                  aria-invalid={fieldState.invalid}
                  disabled={isSaving || isTesting}
                  autoComplete="off"
                  onChange={(event) => {
                    field.onChange(event)
                    void form.trigger("stripeSecretKey")
                  }}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <PaymentSecretField
              control={form.control}
              name="stripeSecretKey"
              label={t("settings.payment.stripeSecretKey")}
              configuredPlaceholder={t("settings.payment.configuredPlaceholder")}
              unconfiguredPlaceholder={t("settings.payment.stripeSecretKeyPlaceholder")}
              configuredDescription={t("settings.payment.secretPreserved")}
              changeLabel={t("settings.payment.changeSecret")}
              cancelLabel={t("common.actions.cancel")}
              configured={stripeSecretKeyConfigured}
              editing={editing.stripeSecretKey}
              disabled={isSaving || isTesting}
              autoComplete="new-password"
              onChangeAfter={() => void form.trigger("stripePublishableKey")}
              onEdit={() => {
                form.setValue("stripeSecretKey", "", { shouldValidate: true })
                setEditing((prev) => ({ ...prev, stripeSecretKey: true }))
              }}
              onCancel={() => {
                setEditing((prev) => ({ ...prev, stripeSecretKey: false }))
                form.setValue("stripeSecretKey", "", { shouldValidate: true })
              }}
            />
            <PaymentSecretField
              control={form.control}
              name="stripeWebhookSecret"
              label={t("settings.payment.stripeWebhookSecret")}
              configuredPlaceholder={t("settings.payment.configuredPlaceholder")}
              unconfiguredPlaceholder={t("settings.payment.stripeWebhookSecretPlaceholder")}
              configuredDescription={t("settings.payment.secretPreserved")}
              changeLabel={t("settings.payment.changeSecret")}
              cancelLabel={t("common.actions.cancel")}
              configured={stripeWebhookSecretConfigured}
              editing={editing.stripeWebhookSecret}
              disabled={isSaving || isTesting}
              autoComplete="new-password"
              onEdit={() => {
                form.setValue("stripeWebhookSecret", "", { shouldValidate: true })
                setEditing((prev) => ({ ...prev, stripeWebhookSecret: true }))
              }}
              onCancel={() => {
                setEditing((prev) => ({ ...prev, stripeWebhookSecret: false }))
                form.setValue("stripeWebhookSecret", "", { shouldValidate: true })
              }}
            />
          </div>
          <div className="space-y-1" aria-live="polite">
            {stripeTestConnectionAt ? (
              <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
                {t("settings.payment.lastStripeTest", {
                  date: STRIPE_TEST_DATE_FORMAT.format(new Date(stripeTestConnectionAt))
                })}
              </Typography>
            ) : (
              <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
                {t("settings.payment.lastStripeTestNever")}
              </Typography>
            )}
            {isDirty ? (
              <FieldDescription>{t("settings.payment.saveBeforeTest")}</FieldDescription>
            ) : null}
          </div>
        </FieldGroup>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {settingsError && <FieldError className="sm:mr-auto">{settingsError}</FieldError>}
          {testError && <FieldError className="sm:mr-auto">{testError}</FieldError>}
          <Button
            type="button"
            variant="outline"
            disabled={isSaving || isTesting || isDirty || !stripeConfigured}
            onClick={onTestStripe}
          >
            {isTesting ? <Spinner /> : <Icon name="BadgeCheck" />}
            {t("settings.payment.testStripeConnection")}
          </Button>
          <Button type="submit" disabled={isSaving || isTesting || !(isDirty && isValid)}>
            {isSaving && <Spinner />}
            {t("settings.payment.save")}
          </Button>
        </div>
      </form>
    </div>
  )
}

export { PaymentSettingsForm }
