import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

export const totpVerifySchema = z.object({
  code: z
    .string()
    .length(6, i18n.t("totp.validation.codeLength"))
    .regex(/^\d{6}$/, i18n.t("totp.validation.codeDigits"))
})

export type TotpVerifyValues = z.infer<typeof totpVerifySchema>

export const businessProfileSchema = z.object({
  businessName: z.string().min(1, i18n.t("setup.businessProfile.validation.businessNameRequired")),
  businessEmail: z
    .email(i18n.t("setup.businessProfile.validation.businessEmailInvalid"))
    .or(z.literal("")),
  businessTaxId: z.string(),
  businessCountry: z
    .string()
    .length(2, i18n.t("setup.businessProfile.validation.businessCountryRequired")),
  defaultCurrency: z
    .string()
    .min(1, i18n.t("setup.businessProfile.validation.defaultCurrencyRequired"))
})

export type BusinessProfileValues = z.infer<typeof businessProfileSchema>

export const totpEnableSchema = z.object({
  password: z.string().min(1, i18n.t("setup.totp.validation.passwordRequired"))
})

export type TotpEnableValues = z.infer<typeof totpEnableSchema>
