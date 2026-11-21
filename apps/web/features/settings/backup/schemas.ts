import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

import {
  getMissingBackupCredentialFields,
  isBackupDestination,
  type BackupCredentialField
} from "./services/destinationRequirements"

const MAX_RETENTION_COUNT = 365

const optionalTextSchema = z.string().trim()

const destinationSchema = z
  .string()
  .trim()
  .refine(isBackupDestination, i18n.t("settings.backup.validation.destinationInvalid"))

const cadenceSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === "daily" || value === "weekly",
    i18n.t("settings.backup.validation.cadenceInvalid")
  )

// A count of retained archives, never blank: all three columns are `NOT NULL` with defaults, and
// zero already means "keep none in this window".
const retentionCountSchema = z
  .string()
  .trim()
  .refine(
    (value) => /^\d+$/.test(value) && Number(value) >= 0 && Number(value) <= MAX_RETENTION_COUNT,
    i18n.t("settings.backup.validation.retentionRangeInvalid")
  )
  .transform(Number)

const credentialFieldPaths: Record<BackupCredentialField, string> = {
  bucket: "backupS3Bucket",
  region: "backupS3Region",
  endpoint: "backupS3Endpoint",
  accessKey: "backupS3AccessKey",
  secretKey: "backupS3SecretKey"
}

const credentialFieldMessages: Record<BackupCredentialField, string> = {
  bucket: i18n.t("settings.backup.validation.bucketRequired"),
  region: i18n.t("settings.backup.validation.regionRequired"),
  endpoint: i18n.t("settings.backup.validation.endpointRequired"),
  accessKey: i18n.t("settings.backup.validation.accessKeyRequired"),
  secretKey: i18n.t("settings.backup.validation.secretKeyRequired")
}

export const backupSettingsSchema = z
  .object({
    backupDestination: destinationSchema,
    backupCadence: cadenceSchema,
    backupRetentionDaily: retentionCountSchema,
    backupRetentionWeekly: retentionCountSchema,
    backupRetentionMonthly: retentionCountSchema,
    backupS3Bucket: optionalTextSchema,
    backupS3Region: optionalTextSchema,
    backupS3Endpoint: optionalTextSchema,
    backupS3AccessKey: optionalTextSchema,
    // Not a field anyone fills in: `toBackupSettingsFormData` never sends a stored credential to the
    // client, so a blank key box means "keep what is stored" whenever this flag is true and "no key
    // has ever been set" when it is false. The refinement below is the only place that distinction
    // decides whether a destination is complete.
    backupS3AccessKeyConfigured: z.boolean(),
    backupS3SecretKey: optionalTextSchema,
    backupS3SecretKeyConfigured: z.boolean()
  })
  .superRefine((values, context) => {
    if (!isBackupDestination(values.backupDestination)) return

    const missing = getMissingBackupCredentialFields(values.backupDestination, {
      bucket: values.backupS3Bucket,
      region: values.backupS3Region,
      endpoint: values.backupS3Endpoint,
      accessKeyConfigured:
        values.backupS3AccessKey.length > 0 || values.backupS3AccessKeyConfigured,
      secretKeyConfigured: values.backupS3SecretKey.length > 0 || values.backupS3SecretKeyConfigured
    })

    for (const field of missing) {
      context.addIssue({
        code: "custom",
        path: [credentialFieldPaths[field]],
        message: credentialFieldMessages[field]
      })
    }
  })

export type BackupSettingsValues = z.infer<typeof backupSettingsSchema>
export type BackupSettingsInputValues = z.input<typeof backupSettingsSchema>

export const testBackupConnectionSchema = z.object({})
