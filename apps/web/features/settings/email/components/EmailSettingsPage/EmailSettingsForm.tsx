"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Choicebox,
  ChoiceboxItem,
  ChoiceboxItemContent,
  ChoiceboxItemDescription,
  ChoiceboxItemHeader,
  ChoiceboxItemIndicator,
  ChoiceboxItemTitle,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  Input,
  Separator,
  Spinner,
  toast,
  Typography
} from "@/components/ui"

import { saveEmailSettings } from "../../mutations"
import {
  emailSettingsSchema,
  type EmailSettingsInputValues,
  type EmailSettingsValues
} from "../../schemas"

import { EmailSecretField } from "./EmailSecretField"
import { EmailTestForm } from "./EmailTestForm"
import { SmtpFields } from "./SmtpFields"

type EmailSettingsFormProps = {
  initialValues: EmailSettingsValues
  defaultTestRecipient: string
  initialEmailTestSendAt: string | null
}

function getSecretSafeEmailSettingsValues(values: EmailSettingsValues): EmailSettingsValues {
  return {
    ...values,
    smtpPass: values.smtpPassConfigured ? "" : values.smtpPass,
    resendApiKey: values.resendApiKeyConfigured ? "" : values.resendApiKey
  }
}

const EmailSettingsForm = ({
  initialValues,
  defaultTestRecipient,
  initialEmailTestSendAt
}: EmailSettingsFormProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [settingsError, setSettingsError] = useState<string | null>(null)

  const [emailTestSendAt, setEmailTestSendAt] = useState<string | null>(initialEmailTestSendAt)

  const [editingSmtpPass, setEditingSmtpPass] = useState(false)
  const [editingResendApiKey, setEditingResendApiKey] = useState(false)

  const [isSaving, startSaving] = useTransition()

  const settingsForm = useForm<EmailSettingsInputValues, unknown, EmailSettingsValues>({
    resolver: zodResolver(emailSettingsSchema),
    mode: "onChange",
    defaultValues: getSecretSafeEmailSettingsValues(initialValues)
  })

  const { isDirty: settingsDirty, isValid: settingsValid } = settingsForm.formState

  const provider = useWatch({ control: settingsForm.control, name: "emailProvider" })
  const smtpPassConfigured = useWatch({ control: settingsForm.control, name: "smtpPassConfigured" })
  const resendApiKeyConfigured = useWatch({
    control: settingsForm.control,
    name: "resendApiKeyConfigured"
  })

  const onSettingsSubmit = (values: EmailSettingsValues) => {
    if (!settingsDirty || !settingsValid) return

    setSettingsError(null)

    startSaving(async () => {
      const result = await saveEmailSettings(values)

      if ("error" in result) {
        setSettingsError(result.error)

        return
      }

      settingsForm.reset(getSecretSafeEmailSettingsValues(result.data.settings))

      setEmailTestSendAt(result.data.settings.emailTestSendAt)
      setEditingSmtpPass(false)
      setEditingResendApiKey(false)

      router.refresh()

      toast.success(t("settings.email.saved"))
    })
  }

  const handleProviderChange = (value: string) => {
    settingsForm.setValue("emailProvider", value, { shouldValidate: true, shouldDirty: true })

    setSettingsError(null)
    setEditingSmtpPass(false)
    setEditingResendApiKey(false)
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={settingsForm.handleSubmit(onSettingsSubmit)}
        noValidate
        className="flex flex-col gap-6"
      >
        <FieldSet>
          <FieldLegend>{t("settings.email.provider")}</FieldLegend>
          <Controller
            name="emailProvider"
            control={settingsForm.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <Choicebox
                  value={field.value}
                  onValueChange={handleProviderChange}
                  disabled={isSaving}
                  className="grid gap-3 sm:grid-cols-2"
                  aria-invalid={fieldState.invalid}
                >
                  <ChoiceboxItem id="email-provider-smtp" value="smtp">
                    <ChoiceboxItemHeader>
                      <ChoiceboxItemTitle>{t("settings.email.providerSmtp")}</ChoiceboxItemTitle>
                      <ChoiceboxItemDescription>
                        {t("settings.email.providerSmtpHelp")}
                      </ChoiceboxItemDescription>
                    </ChoiceboxItemHeader>
                    <ChoiceboxItemContent>
                      <ChoiceboxItemIndicator />
                    </ChoiceboxItemContent>
                  </ChoiceboxItem>
                  <ChoiceboxItem id="email-provider-resend" value="resend">
                    <ChoiceboxItemHeader>
                      <ChoiceboxItemTitle>{t("settings.email.providerResend")}</ChoiceboxItemTitle>
                      <ChoiceboxItemDescription>
                        {t("settings.email.providerResendHelp")}
                      </ChoiceboxItemDescription>
                    </ChoiceboxItemHeader>
                    <ChoiceboxItemContent>
                      <ChoiceboxItemIndicator />
                    </ChoiceboxItemContent>
                  </ChoiceboxItem>
                </Choicebox>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </FieldSet>
        <FieldGroup>
          <Typography variant="h4">{t("settings.email.senderSection")}</Typography>
          <div className="grid gap-4 md:grid-cols-2">
            <Controller
              name="emailFromName"
              control={settingsForm.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{t("settings.email.fromName")}</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    placeholder={t("settings.email.fromNamePlaceholder")}
                    aria-invalid={fieldState.invalid}
                    disabled={isSaving}
                    autoComplete="organization"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="emailFromAddress"
              control={settingsForm.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{t("settings.email.fromAddress")}</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="email"
                    placeholder={t("settings.email.fromAddressPlaceholder")}
                    aria-invalid={fieldState.invalid}
                    disabled={isSaving}
                    autoComplete="email"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </div>
        </FieldGroup>
        {provider === "smtp" ? (
          <SmtpFields
            control={settingsForm.control}
            smtpPassConfigured={smtpPassConfigured}
            editingSmtpPass={editingSmtpPass}
            disabled={isSaving}
            onSmtpPassEdit={() => {
              settingsForm.setValue("smtpPass", "", { shouldValidate: true })
              setEditingSmtpPass(true)
            }}
            onSmtpPassCancel={() => {
              setEditingSmtpPass(false)
              settingsForm.setValue("smtpPass", "", { shouldValidate: true })
            }}
          />
        ) : null}
        {provider === "resend" ? (
          <FieldGroup>
            <Typography variant="h4">{t("settings.email.resendSection")}</Typography>
            <EmailSecretField
              control={settingsForm.control}
              name="resendApiKey"
              label={t("settings.email.resendApiKey")}
              unconfiguredPlaceholder={t("settings.email.resendApiKeyPlaceholder")}
              configured={resendApiKeyConfigured}
              editing={editingResendApiKey}
              disabled={isSaving}
              onEdit={() => {
                settingsForm.setValue("resendApiKey", "", { shouldValidate: true })
                setEditingResendApiKey(true)
              }}
              onCancel={() => {
                setEditingResendApiKey(false)
                settingsForm.setValue("resendApiKey", "", { shouldValidate: true })
              }}
            />
          </FieldGroup>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {settingsError && <FieldError className="sm:mr-auto">{settingsError}</FieldError>}
          <Button type="submit" disabled={isSaving || !(settingsDirty && settingsValid)}>
            {isSaving && <Spinner />}
            {t("settings.email.save")}
          </Button>
        </div>
      </form>
      <Separator />
      <EmailTestForm
        defaultTestRecipient={defaultTestRecipient}
        settingsDirty={settingsDirty}
        disabled={isSaving}
        lastTestSendAt={emailTestSendAt}
        onTested={setEmailTestSendAt}
      />
    </div>
  )
}

export { EmailSettingsForm }
