import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

export const TAX_RATE_NAME_MAX_LENGTH = 80

function hasAtMostTwoDecimalPlaces(value: number): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value.toString())
}

export const taxRateFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, i18n.t("settings.taxRates.validation.nameRequired"))
    .max(
      TAX_RATE_NAME_MAX_LENGTH,
      i18n.t("settings.taxRates.validation.nameTooLong", {
        count: TAX_RATE_NAME_MAX_LENGTH
      })
    ),
  percentage: z
    .number(i18n.t("settings.taxRates.validation.percentageInvalid"))
    .min(0, i18n.t("settings.taxRates.validation.percentageRange"))
    .max(100, i18n.t("settings.taxRates.validation.percentageRange"))
    .refine(hasAtMostTwoDecimalPlaces, {
      message: i18n.t("settings.taxRates.validation.percentagePrecision")
    })
})

export type TaxRateFormValues = z.infer<typeof taxRateFormSchema>
export type TaxRateFormInputValues = z.input<typeof taxRateFormSchema>

export const createTaxRateSchema = taxRateFormSchema

export const updateTaxRateSchema = taxRateFormSchema.extend({
  id: z.uuid(i18n.t("settings.taxRates.validation.idInvalid"))
})

export const taxRateIdSchema = z.object({
  id: z.uuid(i18n.t("settings.taxRates.validation.idInvalid"))
})

export type CreateTaxRateValues = z.infer<typeof createTaxRateSchema>
export type UpdateTaxRateValues = z.infer<typeof updateTaxRateSchema>
export type TaxRateIdValues = z.infer<typeof taxRateIdSchema>

export type TaxRateListItem = {
  id: string
  name: string
  percentage: number
  isDefault: boolean
}
