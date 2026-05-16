import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

export { totpVerifySchema, type TotpVerifyValues } from "@/features/settings"

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
