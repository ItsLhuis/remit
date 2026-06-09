"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { useTranslation } from "@/lib/i18n"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"

import { saveEmailSettings, sendEmailSettingsTest } from "../mutations"
import {
  emailSettingsSchema,
  testEmailSettingsSchema,
  type EmailSettingsInputValues,
  type EmailSettingsValues,
  type TestEmailSettingsValues
} from "../schemas"

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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  Icon,
  Input,
  SecretField,
  Separator,
  Spinner,
  Switch,
  toast,
  Typography
} from "@/components/ui"

type EmailSettingsFormProps = {
  initialValues: EmailSettingsValues
  defaultTestRecipient: string
  initialEmailTestSendAt: string | null
}

const getSecretSafeEmailSettingsValues = (values: EmailSettingsValues): EmailSettingsValues => ({
  ...values,
  smtpPass: values.smtpPassConfigured ? "" : values.smtpPass,
  resendApiKey: values.resendApiKeyConfigured ? "" : values.resendApiKey
})

const EmailSettingsForm = ({
  initialValues,
  defaultTestRecipient,
  initialEmailTestSendAt
}: EmailSettingsFormProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [testError, setTestError] = useState<string | null>(null)

  const [emailTestSendAt, setEmailTestSendAt] = useState<string | null>(initialEmailTestSendAt)

  const [editingSmtpPass, setEditingSmtpPass] = useState(false)
  const [editingResendApiKey, setEditingResendApiKey] = useState(false)

  const [isSaving, startSaving] = useTransition()
  const [isTesting, startTesting] = useTransition()

  const settingsForm = useForm<EmailSettingsInputValues, unknown, EmailSettingsValues>({
    resolver: zodResolver(emailSettingsSchema),
    mode: "onChange",
    defaultValues: getSecretSafeEmailSettingsValues(initialValues)
  })

  const { isDirty: settingsDirty, isValid: settingsValid } = settingsForm.formState

  const testForm = useForm<TestEmailSettingsValues>({
    resolver: zodResolver(testEmailSettingsSchema),
    mode: "onChange",
    defaultValues: { recipientEmail: defaultTestRecipient }
  })

  const { isValid: testValid } = testForm.formState

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

  const onTestSubmit = (values: TestEmailSettingsValues) => {
    if (!testValid || settingsDirty) return

    setTestError(null)

    startTesting(async () => {
      const result = await sendEmailSettingsTest(values)

      if ("error" in result) {
        setTestError(result.error)
        toast.error(result.error)

        return
      }

      setEmailTestSendAt(result.data.emailTestSendAt)

      router.refresh()

      toast.success(t("settings.email.testSent"))
    })
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
                  disabled={isSaving || isTesting}
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
                    disabled={isSaving || isTesting}
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
                    disabled={isSaving || isTesting}
                    autoComplete="email"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </div>
        </FieldGroup>
        {provider === "smtp" ? (
          <FieldGroup>
            <Typography variant="h4">{t("settings.email.smtpSection")}</Typography>
            <div className="grid gap-4 md:grid-cols-2">
              <Controller
                name="smtpHost"
                control={settingsForm.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>{t("settings.email.smtpHost")}</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      placeholder={t("settings.email.smtpHostPlaceholder")}
                      aria-invalid={fieldState.invalid}
                      disabled={isSaving || isTesting}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="smtpPort"
                control={settingsForm.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>{t("settings.email.smtpPort")}</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      ref={field.ref}
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={(event) => field.onChange(Number(event.target.value))}
                      type="number"
                      min={1}
                      max={65535}
                      inputMode="numeric"
                      aria-invalid={fieldState.invalid}
                      disabled={isSaving || isTesting}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="smtpUser"
                control={settingsForm.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>{t("settings.email.smtpUser")}</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      placeholder={t("settings.email.smtpUserPlaceholder")}
                      aria-invalid={fieldState.invalid}
                      disabled={isSaving || isTesting}
                      autoComplete="username"
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="smtpPass"
                control={settingsForm.control}
                render={({ field, fieldState }) => (
                  <SecretField
                    id={field.name}
                    name={field.name}
                    label={t("settings.email.smtpPassword")}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    inputRef={field.ref}
                    description={smtpPassConfigured ? t("settings.email.secretPreserved") : ""}
                    configuredPlaceholder={t("settings.email.configuredPlaceholder")}
                    unconfiguredPlaceholder={t("settings.email.smtpPasswordPlaceholder")}
                    changeLabel={t("settings.email.changeSecret")}
                    cancelLabel={t("common.actions.cancel")}
                    configured={smtpPassConfigured}
                    editing={editingSmtpPass}
                    disabled={isSaving || isTesting}
                    invalid={fieldState.invalid}
                    error={fieldState.error}
                    autoComplete="new-password"
                    onEdit={() => {
                      settingsForm.setValue("smtpPass", "", { shouldValidate: true })
                      setEditingSmtpPass(true)
                    }}
                    onCancel={() => {
                      setEditingSmtpPass(false)
                      settingsForm.setValue("smtpPass", "", { shouldValidate: true })
                    }}
                  />
                )}
              />
            </div>
            <Controller
              name="smtpSecure"
              control={settingsForm.control}
              render={({ field, fieldState }) => (
                <Field orientation="horizontal" data-invalid={fieldState.invalid}>
                  <Switch
                    id={field.name}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSaving || isTesting}
                    aria-invalid={fieldState.invalid}
                  />
                  <div className="flex flex-col gap-1">
                    <FieldLabel htmlFor={field.name}>{t("settings.email.smtpSecure")}</FieldLabel>
                    <FieldDescription>{t("settings.email.smtpSecureHelp")}</FieldDescription>
                  </div>
                </Field>
              )}
            />
          </FieldGroup>
        ) : null}
        {provider === "resend" ? (
          <FieldGroup>
            <Typography variant="h4">{t("settings.email.resendSection")}</Typography>
            <Controller
              name="resendApiKey"
              control={settingsForm.control}
              render={({ field, fieldState }) => (
                <SecretField
                  id={field.name}
                  name={field.name}
                  label={t("settings.email.resendApiKey")}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  inputRef={field.ref}
                  description={resendApiKeyConfigured ? t("settings.email.secretPreserved") : ""}
                  configuredPlaceholder={t("settings.email.configuredPlaceholder")}
                  unconfiguredPlaceholder={t("settings.email.resendApiKeyPlaceholder")}
                  changeLabel={t("settings.email.changeSecret")}
                  cancelLabel={t("common.actions.cancel")}
                  configured={resendApiKeyConfigured}
                  editing={editingResendApiKey}
                  disabled={isSaving || isTesting}
                  invalid={fieldState.invalid}
                  error={fieldState.error}
                  autoComplete="new-password"
                  onEdit={() => {
                    settingsForm.setValue("resendApiKey", "", { shouldValidate: true })
                    setEditingResendApiKey(true)
                  }}
                  onCancel={() => {
                    setEditingResendApiKey(false)
                    settingsForm.setValue("resendApiKey", "", { shouldValidate: true })
                  }}
                />
              )}
            />
          </FieldGroup>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {settingsError && <FieldError className="sm:mr-auto">{settingsError}</FieldError>}
          <Button
            type="submit"
            disabled={isSaving || isTesting || !(settingsDirty && settingsValid)}
          >
            {isSaving && <Spinner />}
            {t("settings.email.save")}
          </Button>
        </div>
      </form>
      <Separator />
      <form
        onSubmit={testForm.handleSubmit(onTestSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <div className="space-y-1">
          <Typography variant="h4">{t("settings.email.testSection")}</Typography>
          {emailTestSendAt ? (
            <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
              {t("settings.email.lastTestSend", {
                date: new Intl.DateTimeFormat(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short"
                }).format(new Date(emailTestSendAt))
              })}
            </Typography>
          ) : (
            <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
              {t("settings.email.lastTestSendNever")}
            </Typography>
          )}
        </div>
        <Controller
          name="recipientEmail"
          control={testForm.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{t("settings.email.testRecipient")}</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="email"
                placeholder={defaultTestRecipient}
                aria-invalid={fieldState.invalid}
                disabled={isSaving || isTesting}
                autoComplete="email"
              />
              {settingsDirty ? (
                <FieldDescription>{t("settings.email.saveBeforeTest")}</FieldDescription>
              ) : null}
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {testError && <FieldError className="sm:mr-auto">{testError}</FieldError>}
          <Button
            type="submit"
            variant="outline"
            disabled={isSaving || isTesting || settingsDirty || !testValid}
          >
            {isTesting ? <Spinner /> : <Icon name="Send" />}
            {t("settings.email.sendTest")}
          </Button>
        </div>
      </form>
    </div>
  )
}

export { EmailSettingsForm }
