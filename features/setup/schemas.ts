import { z } from "zod"

import { t } from "@/lib/i18n/server"

export { totpVerifySchema, type TotpVerifyValues } from "@/features/settings"

export const businessProfileSchema = z.object({
  businessName: z.string().min(1, t("setup.businessProfile.validation.businessNameRequired")),
  businessEmail: z
    .email(t("setup.businessProfile.validation.businessEmailInvalid"))
    .or(z.literal("")),
  businessTaxId: z.string(),
  businessCountry: z
    .string()
    .length(2, t("setup.businessProfile.validation.businessCountryRequired")),
  defaultCurrency: z.string().min(1, t("setup.businessProfile.validation.defaultCurrencyRequired"))
})

export type BusinessProfileValues = z.infer<typeof businessProfileSchema>

export const totpEnableSchema = z.object({
  password: z.string().min(1, t("setup.totp.validation.passwordRequired"))
})

export type TotpEnableValues = z.infer<typeof totpEnableSchema>
