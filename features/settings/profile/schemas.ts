import { z } from "zod"

import { t } from "@/lib/i18n/server"

export const accountDetailsSchema = z.object({
  name: z.string().min(1, t("settings.profile.validation.nameRequired")),
  email: z.email(t("settings.profile.validation.emailInvalid"))
})

export type AccountDetailsValues = z.infer<typeof accountDetailsSchema>

export const changeEmailSchema = z.object({
  email: z.email(t("settings.profile.validation.emailInvalid"))
})

export type ChangeEmailValues = z.infer<typeof changeEmailSchema>

export const confirmAvatarUploadSchema = z.object({
  objectKey: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive()
})

export type ConfirmAvatarUploadValues = z.infer<typeof confirmAvatarUploadSchema>
