import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

export const accountDetailsSchema = z.object({
  name: z.string().min(1, i18n.t("settings.profile.validation.nameRequired")),
  email: z.email(i18n.t("settings.profile.validation.emailInvalid"))
})

export type AccountDetailsValues = z.infer<typeof accountDetailsSchema>

export const changeEmailSchema = z.object({
  email: z.email(i18n.t("settings.profile.validation.emailInvalid"))
})

export const confirmAvatarUploadSchema = z.object({
  objectKey: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive()
})
