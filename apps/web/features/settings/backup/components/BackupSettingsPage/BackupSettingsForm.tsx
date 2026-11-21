"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  FieldError,
  Icon,
  Separator,
  Spinner,
  toast
} from "@/components/ui"

import { saveBackupSettings, testBackupConnection } from "../../mutations"
import { type BackupSettingsStatus } from "../../queries"
import {
  backupSettingsSchema,
  type BackupSettingsInputValues,
  type BackupSettingsValues
} from "../../schemas"

import { BackupDestinationFields } from "./BackupDestinationFields"
import { BackupScheduleFields } from "./BackupScheduleFields"
import { BackupStatusPanel } from "./BackupStatusPanel"

type BackupSettingsFormProps = {
  initialValues: BackupSettingsValues
  status: BackupSettingsStatus
  hostedMode: boolean
}

// The form holds every value as the string its control produces, and the schema's transform turns
// the retention counts into numbers on the server. The two credentials are always blank here: the
// read model never sends a stored one, and a blank submission means "keep what is stored".
function toBackupSettingsInputValues(values: BackupSettingsValues): BackupSettingsInputValues {
  return {
    backupDestination: values.backupDestination,
    backupCadence: values.backupCadence,
    backupRetentionDaily: String(values.backupRetentionDaily),
    backupRetentionWeekly: String(values.backupRetentionWeekly),
    backupRetentionMonthly: String(values.backupRetentionMonthly),
    backupS3Bucket: values.backupS3Bucket,
    backupS3Region: values.backupS3Region,
    backupS3Endpoint: values.backupS3Endpoint,
    backupS3AccessKey: "",
    backupS3AccessKeyConfigured: values.backupS3AccessKeyConfigured,
    backupS3SecretKey: "",
    backupS3SecretKeyConfigured: values.backupS3SecretKeyConfigured
  }
}

const BackupSettingsForm = ({ initialValues, status, hostedMode }: BackupSettingsFormProps) => {
  const { t, i18n } = useTranslation()

  const locale = i18n.resolvedLanguage ?? i18n.language

  const router = useRouter()

  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [currentStatus, setCurrentStatus] = useState(status)

  const [editingAccessKey, setEditingAccessKey] = useState(false)
  const [editingSecretKey, setEditingSecretKey] = useState(false)

  const [isSaving, startSaving] = useTransition()
  const [isTesting, startTesting] = useTransition()

  const form = useForm<BackupSettingsInputValues>({
    resolver: zodResolver(backupSettingsSchema, {}, { raw: true }),
    mode: "onChange",
    defaultValues: toBackupSettingsInputValues(initialValues)
  })

  const { isDirty, isValid } = form.formState

  const destination = useWatch({ control: form.control, name: "backupDestination" })
  const accessKeyConfigured = useWatch({
    control: form.control,
    name: "backupS3AccessKeyConfigured"
  })
  const secretKeyConfigured = useWatch({
    control: form.control,
    name: "backupS3SecretKeyConfigured"
  })

  const disabled = hostedMode || isSaving || isTesting

  const onSubmit = (values: BackupSettingsInputValues) => {
    if (!isDirty || !isValid) return

    setSettingsError(null)

    startSaving(async () => {
      const result = await saveBackupSettings(values)

      if ("error" in result) {
        setSettingsError(result.error)

        return
      }

      form.reset(toBackupSettingsInputValues(result.data.settings))

      setCurrentStatus(result.data.status)
      setEditingAccessKey(false)
      setEditingSecretKey(false)

      router.refresh()

      toast.success(t("settings.backup.saved"))
    })
  }

  const onTestConnection = () => {
    if (isDirty) return

    setTestError(null)

    startTesting(async () => {
      const result = await testBackupConnection({})

      if ("error" in result) {
        setTestError(result.error)
        toast.error(result.error)

        return
      }

      setCurrentStatus((previous) => ({
        ...previous,
        backupTestConnectionAt: result.data.backupTestConnectionAt
      }))

      router.refresh()

      toast.success(t("settings.backup.testSucceeded"))
    })
  }

  // Changing the destination changes which fields the schema requires, and react-hook-form only
  // revalidates the field that changed. Without this the credential errors of the previous
  // destination stay on screen, or the new one's never appear.
  const handleDestinationChange = (value: string) => {
    form.setValue("backupDestination", value, { shouldValidate: true, shouldDirty: true })

    setSettingsError(null)

    void form.trigger([
      "backupS3Bucket",
      "backupS3Region",
      "backupS3Endpoint",
      "backupS3AccessKey",
      "backupS3SecretKey"
    ])
  }

  return (
    <div className="space-y-8">
      {hostedMode ? (
        <Alert>
          <Icon name="Info" aria-hidden="true" />
          <AlertTitle>{t("settings.backup.hostedTitle")}</AlertTitle>
          <AlertDescription>{t("settings.backup.hostedDescription")}</AlertDescription>
        </Alert>
      ) : null}
      <BackupStatusPanel
        status={currentStatus}
        testConnectionAt={currentStatus.backupTestConnectionAt}
        locale={locale}
      />
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        <BackupDestinationFields
          control={form.control}
          destination={destination}
          accessKeyConfigured={accessKeyConfigured}
          secretKeyConfigured={secretKeyConfigured}
          editingAccessKey={editingAccessKey}
          editingSecretKey={editingSecretKey}
          disabled={disabled}
          onDestinationChange={handleDestinationChange}
          onAccessKeyEdit={() => {
            form.setValue("backupS3AccessKey", "", { shouldValidate: true })
            setEditingAccessKey(true)
          }}
          onAccessKeyCancel={() => {
            setEditingAccessKey(false)
            form.setValue("backupS3AccessKey", "", { shouldValidate: true })
          }}
          onSecretKeyEdit={() => {
            form.setValue("backupS3SecretKey", "", { shouldValidate: true })
            setEditingSecretKey(true)
          }}
          onSecretKeyCancel={() => {
            setEditingSecretKey(false)
            form.setValue("backupS3SecretKey", "", { shouldValidate: true })
          }}
        />
        <Separator />
        <BackupScheduleFields control={form.control} disabled={disabled} />
        {hostedMode ? null : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            {settingsError && <FieldError className="sm:mr-auto">{settingsError}</FieldError>}
            {testError && <FieldError className="sm:mr-auto">{testError}</FieldError>}
            <Button
              type="button"
              variant="outline"
              disabled={isSaving || isTesting || isDirty}
              onClick={onTestConnection}
            >
              {isTesting ? <Spinner /> : <Icon name="BadgeCheck" />}
              {t("settings.backup.testConnection")}
            </Button>
            <Button type="submit" disabled={isSaving || isTesting || !(isDirty && isValid)}>
              {isSaving && <Spinner />}
              {t("common.actions.save")}
            </Button>
          </div>
        )}
      </form>
    </div>
  )
}

export { BackupSettingsForm }
