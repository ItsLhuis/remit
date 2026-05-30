import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

export type EmailProvider = "smtp" | "resend"

function isEmailProvider(value: string): value is EmailProvider {
  return value === "smtp" || value === "resend"
}

const optionalTextSchema = z.string().trim()

const emailProviderSchema = z
  .string()
  .trim()
  .refine(isEmailProvider, i18n.t("settings.email.validation.providerRequired"))

const optionalEmailSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || z.email().safeParse(value).success, {
    message: i18n.t("settings.email.validation.recipientInvalid")
  })

export const emailSettingsSchema = z
  .object({
    emailProvider: emailProviderSchema,
    smtpHost: optionalTextSchema,
    smtpPort: z.number().int(i18n.t("settings.email.validation.smtpPortInvalid")),
    smtpUser: optionalTextSchema,
    smtpPass: optionalTextSchema,
    smtpPassConfigured: z.boolean(),
    smtpSecure: z.boolean(),
    resendApiKey: optionalTextSchema,
    resendApiKeyConfigured: z.boolean(),
    emailFromName: z.string().trim().min(1, i18n.t("settings.email.validation.fromNameRequired")),
    emailFromAddress: z.email(i18n.t("settings.email.validation.fromAddressInvalid"))
  })
  .superRefine((values, context) => {
    if (values.emailProvider === "smtp") {
      if (!values.smtpHost) {
        context.addIssue({
          code: "custom",
          path: ["smtpHost"],
          message: i18n.t("settings.email.validation.smtpHostRequired")
        })
      }

      if (values.smtpPort < 1 || values.smtpPort > 65535) {
        context.addIssue({
          code: "custom",
          path: ["smtpPort"],
          message: i18n.t("settings.email.validation.smtpPortInvalid")
        })
      }

      if (!values.smtpUser) {
        context.addIssue({
          code: "custom",
          path: ["smtpUser"],
          message: i18n.t("settings.email.validation.smtpUserRequired")
        })
      }

      if (!values.smtpPass && !values.smtpPassConfigured) {
        context.addIssue({
          code: "custom",
          path: ["smtpPass"],
          message: i18n.t("settings.email.validation.smtpPasswordRequired")
        })
      }

      return
    }

    if (values.emailProvider === "resend") {
      if (!values.resendApiKey && !values.resendApiKeyConfigured) {
        context.addIssue({
          code: "custom",
          path: ["resendApiKey"],
          message: i18n.t("settings.email.validation.resendApiKeyRequired")
        })
      }
    }
  })

export type EmailSettingsValues = z.infer<typeof emailSettingsSchema>
export type EmailSettingsInputValues = z.input<typeof emailSettingsSchema>

export const testEmailSettingsSchema = z.object({
  recipientEmail: optionalEmailSchema
})

export type TestEmailSettingsValues = z.infer<typeof testEmailSettingsSchema>
