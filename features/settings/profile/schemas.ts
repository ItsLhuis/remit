import { z } from "zod"

import { t } from "@/lib/i18n/server"

export const accountDetailsSchema = z.object({
  name: z.string().min(1, t("settings.profile.validation.nameRequired")),
  email: z.email(t("settings.profile.validation.emailInvalid"))
})

export type AccountDetailsValues = z.infer<typeof accountDetailsSchema>
