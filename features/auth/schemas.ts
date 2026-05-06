import { z } from "zod"

import { t } from "@/lib/i18n/server"

export const loginSchema = z.object({
  email: z.email(t("auth.login.validation.emailInvalid")),
  password: z.string().min(1, t("auth.login.validation.passwordRequired"))
})

export type LoginValues = z.infer<typeof loginSchema>

export const totpSchema = z.object({
  code: z.string().length(6, t("totp.validation.codeLength"))
})

export type TotpValues = z.infer<typeof totpSchema>

export const recoveryCodeSchema = z.object({
  code: z
    .string()
    .min(8, t("recoveryCode.validation.required"))
    .regex(/^[a-zA-Z0-9-]+$/, t("recoveryCode.validation.format"))
})

export type RecoveryCodeValues = z.infer<typeof recoveryCodeSchema>

export const passwordRules = {
  minLength: 12,
  hasUppercase: /[A-Z]/,
  hasLowercase: /[a-z]/,
  hasNumber: /[0-9]/,
  hasSpecialChar: /[^A-Za-z0-9]/
} as const

export const accountSchema = z
  .object({
    name: z.string().min(1, t("auth.register.validation.nameRequired")),
    email: z.email(t("auth.register.validation.emailInvalid")),
    password: z
      .string()
      .min(
        passwordRules.minLength,
        t("auth.register.validation.passwordMin", { count: passwordRules.minLength })
      )
      .max(128)
      .refine((value) => passwordRules.hasUppercase.test(value), {
        message: t("auth.register.validation.passwordUppercase")
      })
      .refine((value) => passwordRules.hasLowercase.test(value), {
        message: t("auth.register.validation.passwordLowercase")
      })
      .refine((value) => passwordRules.hasNumber.test(value), {
        message: t("auth.register.validation.passwordNumber")
      })
      .refine((value) => passwordRules.hasSpecialChar.test(value), {
        message: t("auth.register.validation.passwordSpecial")
      }),
    confirmPassword: z.string().min(1, t("auth.register.validation.confirmPasswordRequired"))
  })
  .superRefine((values, ctx) => {
    if (values.password !== values.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: t("auth.register.validation.passwordsMatch")
      })
    }
  })

export type AccountValues = z.infer<typeof accountSchema>
