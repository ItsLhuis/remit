"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Icon,
  Input,
  Spinner,
  toast,
  Typography
} from "@/components/ui"

import { sendEmailSettingsTest } from "../../mutations"
import { testEmailSettingsSchema, type TestEmailSettingsValues } from "../../schemas"

const TEST_SEND_DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short"
})

type EmailTestFormProps = {
  defaultTestRecipient: string
  settingsDirty: boolean
  disabled: boolean
  lastTestSendAt: string | null
  onTested: (emailTestSendAt: string) => void
}

const EmailTestForm = ({
  defaultTestRecipient,
  settingsDirty,
  disabled,
  lastTestSendAt,
  onTested
}: EmailTestFormProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [testError, setTestError] = useState<string | null>(null)

  const [isTesting, startTesting] = useTransition()

  const testForm = useForm<TestEmailSettingsValues>({
    resolver: zodResolver(testEmailSettingsSchema),
    mode: "onChange",
    defaultValues: { recipientEmail: defaultTestRecipient }
  })

  const { isValid: testValid } = testForm.formState

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

      onTested(result.data.emailTestSendAt)

      router.refresh()

      toast.success(t("settings.email.testSent"))
    })
  }

  return (
    <form onSubmit={testForm.handleSubmit(onTestSubmit)} noValidate className="flex flex-col gap-4">
      <div className="space-y-1">
        <Typography variant="h4">{t("settings.email.testSection")}</Typography>
        {lastTestSendAt ? (
          <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
            {t("settings.email.lastTestSend", {
              date: TEST_SEND_DATE_FORMAT.format(new Date(lastTestSendAt))
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
              disabled={disabled || isTesting}
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
          disabled={disabled || isTesting || settingsDirty || !testValid}
        >
          {isTesting ? <Spinner /> : <Icon name="Send" />}
          {t("settings.email.sendTest")}
        </Button>
      </div>
    </form>
  )
}

export { EmailTestForm }
