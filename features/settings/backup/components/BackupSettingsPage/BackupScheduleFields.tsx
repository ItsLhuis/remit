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

type BackupScheduleFieldsProps = {
  control: Control<BackupSettingsInputValues>
  disabled: boolean
}

type RetentionFieldName =
  | "backupRetentionDaily"
  | "backupRetentionWeekly"
  | "backupRetentionMonthly"

const BackupScheduleFields = ({ control, disabled }: BackupScheduleFieldsProps) => {
  const { t } = useTranslation()

  const retentionFields: ReadonlyArray<{
    name: RetentionFieldName
    label: string
    description: string
  }> = [
    {
      name: "backupRetentionDaily",
      label: t("settings.backup.retentionDaily"),
      description: t("settings.backup.retentionDailyHelp")
    },
    {
      name: "backupRetentionWeekly",
      label: t("settings.backup.retentionWeekly"),
      description: t("settings.backup.retentionWeeklyHelp")
    },
    {
      name: "backupRetentionMonthly",
      label: t("settings.backup.retentionMonthly"),
      description: t("settings.backup.retentionMonthlyHelp")
    }
  ]

  return (
    <FieldGroup>
      <div className="space-y-1">
        <Typography variant="h4">{t("settings.backup.retentionSection")}</Typography>
        <Typography variant="p" affects={["muted", "removePMargin", "small"]}>
          {t("settings.backup.retentionSectionDescription")}
        </Typography>
      </div>
      <Controller
        name="backupCadence"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>{t("settings.backup.cadence")}</FieldLabel>
            <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
              <SelectTrigger
                ref={field.ref}
                id={field.name}
                className="w-full md:w-64"
                aria-invalid={fieldState.invalid}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="daily">{t("settings.backup.cadenceDaily")}</SelectItem>
                  <SelectItem value="weekly">{t("settings.backup.cadenceWeekly")}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>{t("settings.backup.cadenceHelp")}</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {retentionFields.map((retentionField) => (
          <Controller
            key={retentionField.name}
            name={retentionField.name}
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{retentionField.label}</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={365}
                  aria-invalid={fieldState.invalid}
                  disabled={disabled}
                />
                <FieldDescription>{retentionField.description}</FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        ))}
      </div>
      <div className="space-y-1">
        <FieldDescription>{t("settings.backup.retentionWarning")}</FieldDescription>
        <FieldDescription>{t("settings.backup.retentionLocalNote")}</FieldDescription>
      </div>
    </FieldGroup>
  )
}

export { BackupScheduleFields }
