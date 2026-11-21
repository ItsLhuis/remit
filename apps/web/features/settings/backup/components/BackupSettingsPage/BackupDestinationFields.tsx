"use client"

import { type Control, Controller } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Typography
} from "@/components/ui"

import { type BackupSettingsInputValues } from "../../schemas"

import { BackupSecretField } from "./BackupSecretField"

type BackupDestinationFieldsProps = {
  control: Control<BackupSettingsInputValues>
  destination: string
  accessKeyConfigured: boolean
  secretKeyConfigured: boolean
  editingAccessKey: boolean
  editingSecretKey: boolean
  disabled: boolean
  onDestinationChange: (value: string) => void
  onAccessKeyEdit: () => void
  onAccessKeyCancel: () => void
  onSecretKeyEdit: () => void
  onSecretKeyCancel: () => void
}

const BackupDestinationFields = ({
  control,
  destination,
  accessKeyConfigured,
  secretKeyConfigured,
  editingAccessKey,
  editingSecretKey,
  disabled,
  onDestinationChange,
  onAccessKeyEdit,
  onAccessKeyCancel,
  onSecretKeyEdit,
  onSecretKeyCancel
}: BackupDestinationFieldsProps) => {
  const { t } = useTranslation()

  return (
    <FieldGroup>
      <div className="space-y-1">
        <Typography variant="h4">{t("settings.backup.destinationSection")}</Typography>
        <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
          {t("settings.backup.destinationSectionDescription")}
        </Typography>
      </div>
      <Controller
        name="backupDestination"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>{t("settings.backup.destination")}</FieldLabel>
            <Select value={field.value} onValueChange={onDestinationChange} disabled={disabled}>
              <SelectTrigger
                ref={field.ref}
                id={field.name}
                className="w-full"
                aria-invalid={fieldState.invalid}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="local">{t("settings.backup.destinationLocal")}</SelectItem>
                  <SelectItem value="s3">{t("settings.backup.destinationS3")}</SelectItem>
                  <SelectItem value="r2">{t("settings.backup.destinationR2")}</SelectItem>
                  <SelectItem value="b2">{t("settings.backup.destinationB2")}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>
              {destination === "local"
                ? t("settings.backup.destinationLocalHelp")
                : t("settings.backup.destinationRemoteHelp")}
            </FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      {destination === "local" ? null : (
        <div className="grid gap-4 md:grid-cols-2">
          <Controller
            name="backupS3Bucket"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{t("settings.backup.bucket")}</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  placeholder={t("settings.backup.bucketPlaceholder")}
                  aria-invalid={fieldState.invalid}
                  disabled={disabled}
                  autoComplete="off"
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="backupS3Region"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{t("settings.backup.region")}</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  placeholder={t("settings.backup.regionPlaceholder")}
                  aria-invalid={fieldState.invalid}
                  disabled={disabled}
                  autoComplete="off"
                />
                <FieldDescription>
                  {destination === "r2"
                    ? t("settings.backup.regionR2Help")
                    : t("settings.backup.regionHelp")}
                </FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="backupS3Endpoint"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="md:col-span-2">
                <FieldLabel htmlFor={field.name}>{t("settings.backup.endpoint")}</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  placeholder={t("settings.backup.endpointPlaceholder")}
                  aria-invalid={fieldState.invalid}
                  disabled={disabled}
                  autoComplete="off"
                />
                <FieldDescription>
                  {destination === "r2"
                    ? t("settings.backup.endpointR2Help")
                    : t("settings.backup.endpointHelp")}
                </FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <BackupSecretField
            control={control}
            name="backupS3AccessKey"
            label={t("settings.backup.accessKey")}
            unconfiguredPlaceholder={t("settings.backup.accessKeyPlaceholder")}
            configured={accessKeyConfigured}
            editing={editingAccessKey}
            disabled={disabled}
            onEdit={onAccessKeyEdit}
            onCancel={onAccessKeyCancel}
          />
          <BackupSecretField
            control={control}
            name="backupS3SecretKey"
            label={t("settings.backup.secretKey")}
            unconfiguredPlaceholder={t("settings.backup.secretKeyPlaceholder")}
            configured={secretKeyConfigured}
            editing={editingSecretKey}
            disabled={disabled}
            onEdit={onSecretKeyEdit}
            onCancel={onSecretKeyCancel}
          />
        </div>
      )}
    </FieldGroup>
  )
}

export { BackupDestinationFields }
