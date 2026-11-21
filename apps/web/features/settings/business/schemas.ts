import { z } from "zod"

import i18n from "@/lib/i18n/i18n"
import { Locales } from "@/lib/i18n/locales"

const optionalEmailSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || z.email().safeParse(value).success, {
    message: i18n.t("settings.business.validation.emailInvalid")
  })

const optionalUrlSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || z.url().safeParse(value).success, {
    message: i18n.t("settings.business.validation.websiteInvalid")
  })

const optionalTextSchema = z.string().trim()

export const businessProfileSettingsSchema = z.object({
  businessName: z.string().trim().min(1, i18n.t("settings.business.validation.nameRequired")),
  businessEmail: optionalEmailSchema,
  businessPhone: optionalTextSchema,
  businessWebsite: optionalUrlSchema
})

export type BusinessProfileSettingsValues = z.infer<typeof businessProfileSettingsSchema>

export const regionalDefaultsSettingsSchema = z.object({
  defaultCurrency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, i18n.t("settings.business.validation.currencyRequired")),
  defaultLocale: z
    .string()
    .trim()
    .min(1, i18n.t("settings.business.validation.localeRequired"))
    .refine(isValidLocale, i18n.t("settings.business.validation.localeInvalid")),
  defaultTimezone: z
    .string()
    .trim()
    .min(1, i18n.t("settings.business.validation.timezoneRequired"))
    .refine(isValidTimeZone, i18n.t("settings.business.validation.timezoneInvalid"))
})

export type RegionalDefaultsSettingsValues = z.infer<typeof regionalDefaultsSettingsSchema>

export const taxDetailsSettingsSchema = z.object({
  businessTaxId: optionalTextSchema
})

export type TaxDetailsSettingsValues = z.infer<typeof taxDetailsSettingsSchema>

export const businessAddressSettingsSchema = z.object({
  businessAddressLine1: optionalTextSchema,
  businessAddressLine2: optionalTextSchema,
  businessCity: optionalTextSchema,
  businessState: optionalTextSchema,
  businessPostalCode: optionalTextSchema,
  businessCountry: z
    .string()
    .trim()
    .length(2, i18n.t("settings.business.validation.countryRequired"))
})

export type BusinessAddressSettingsValues = z.infer<typeof businessAddressSettingsSchema>

export const businessSettingsSchema = businessProfileSettingsSchema
  .extend(regionalDefaultsSettingsSchema.shape)
  .extend(taxDetailsSettingsSchema.shape)
  .extend(businessAddressSettingsSchema.shape)

export type BusinessSettingsValues = z.infer<typeof businessSettingsSchema>

const businessLogoUploadRequestSchema = z.object({
  filename: z.string().trim().min(1, i18n.t("settings.business.validation.logoFilenameRequired")),
  contentType: z
    .string()
    .trim()
    .min(1, i18n.t("settings.business.validation.logoContentTypeRequired")),
  sizeBytes: z
    .number()
    .int(i18n.t("settings.business.validation.logoSizeInvalid"))
    .positive(i18n.t("settings.business.validation.logoSizeInvalid"))
    .max(5 * 1024 * 1024, i18n.t("settings.business.validation.logoTooLarge"))
})

export const confirmBusinessLogoUploadSchema = businessLogoUploadRequestSchema.extend({
  objectKey: z.string().trim().min(1, i18n.t("settings.business.validation.logoObjectKeyRequired"))
})

function isValidLocale(value: string): boolean {
  return Object.keys(Locales).includes(value)
}

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value })

    return true
  } catch {
    return false
  }
}
