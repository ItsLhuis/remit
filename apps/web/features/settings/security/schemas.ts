import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

export const confirmPasswordSchema = z.object({
  password: z.string().min(1, i18n.t("settings.security.validation.passwordRequired"))
})

export type ConfirmPasswordValues = z.infer<typeof confirmPasswordSchema>

export const totpVerifySchema = z.object({
  code: z
    .string()
    .length(6, i18n.t("totp.validation.codeLength"))
    .regex(/^\d{6}$/, i18n.t("totp.validation.codeDigits"))
})

export type TotpVerifyValues = z.infer<typeof totpVerifySchema>
