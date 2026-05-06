import { z } from "zod"

import { t } from "@/lib/i18n/server"

export const confirmPasswordSchema = z.object({
  password: z.string().min(1, t("settings.security.validation.passwordRequired"))
})

export type ConfirmPasswordValues = z.infer<typeof confirmPasswordSchema>

export const totpVerifySchema = z.object({
  code: z
    .string()
    .length(6, t("totp.validation.codeLength"))
    .regex(/^\d{6}$/, t("totp.validation.codeDigits"))
})

export type TotpVerifyValues = z.infer<typeof totpVerifySchema>
