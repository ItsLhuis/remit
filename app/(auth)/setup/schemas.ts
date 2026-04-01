import { z } from "zod"

export const businessProfileSchema = z.object({
  businessName: z.string().min(1, "Business name is required."),
  businessEmail: z.email("Enter a valid email address.").or(z.literal("")),
  businessTaxId: z.string(),
  businessCountry: z.string().length(2, "Select a country."),
  defaultCurrency: z.string().min(1, "Select a currency.")
})

export type BusinessProfileValues = z.infer<typeof businessProfileSchema>

export const totpEnableSchema = z.object({
  password: z.string().min(1, "Password is required.")
})

export type TotpEnableValues = z.infer<typeof totpEnableSchema>

export const totpVerifySchema = z.object({
  code: z
    .string()
    .length(6, "Enter the 6-digit code.")
    .regex(/^\d{6}$/, "Code must be 6 digits.")
})

export type TotpVerifyValues = z.infer<typeof totpVerifySchema>
