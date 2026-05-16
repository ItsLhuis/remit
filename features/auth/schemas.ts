import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

export const loginSchema = z.object({
  email: z.email(i18n.t("auth.login.validation.emailInvalid")),
  password: z.string().min(1, i18n.t("auth.login.validation.passwordRequired"))
})

export type LoginValues = z.infer<typeof loginSchema>

export const totpSchema = z.object({
  code: z.string().length(6, i18n.t("totp.validation.codeLength"))
})

export type TotpValues = z.infer<typeof totpSchema>

export const recoveryCodeSchema = z.object({
  code: z
    .string()
    .min(8, i18n.t("recoveryCode.validation.required"))
    .regex(/^[a-zA-Z0-9-]+$/, i18n.t("recoveryCode.validation.format"))
})

export type RecoveryCodeValues = z.infer<typeof recoveryCodeSchema>

export const passwordRules = {
  minLength: 12,
  hasUppercase: /[A-Z]/,
  hasLowercase: /[a-z]/,
  hasNumber: /[0-9]/,
  hasSpecialChar: /[^A-Za-z0-9]/
} as const

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, i18n.t("auth.changePassword.validation.currentPasswordRequired")),
    newPassword: z
      .string()
      .min(
        passwordRules.minLength,
        i18n.t("auth.changePassword.validation.passwordMin", { count: passwordRules.minLength })
      )
      .max(128)
      .refine((value) => passwordRules.hasUppercase.test(value), {
        message: i18n.t("auth.changePassword.validation.passwordUppercase")
      })
      .refine((value) => passwordRules.hasLowercase.test(value), {
        message: i18n.t("auth.changePassword.validation.passwordLowercase")
      })
      .refine((value) => passwordRules.hasNumber.test(value), {
        message: i18n.t("auth.changePassword.validation.passwordNumber")
      })
      .refine((value) => passwordRules.hasSpecialChar.test(value), {
        message: i18n.t("auth.changePassword.validation.passwordSpecial")
      }),
    confirmPassword: z
      .string()
      .min(1, i18n.t("auth.changePassword.validation.confirmPasswordRequired"))
  })
  .superRefine((values, ctx) => {
    if (values.newPassword !== values.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: i18n.t("auth.changePassword.validation.passwordsMatch")
      })
    }
  })

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>

export const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(
        passwordRules.minLength,
        i18n.t("auth.resetPassword.validation.passwordMin", { count: passwordRules.minLength })
      )
      .max(128)
      .refine((value) => passwordRules.hasUppercase.test(value), {
        message: i18n.t("auth.resetPassword.validation.passwordUppercase")
      })
      .refine((value) => passwordRules.hasLowercase.test(value), {
        message: i18n.t("auth.resetPassword.validation.passwordLowercase")
      })
      .refine((value) => passwordRules.hasNumber.test(value), {
        message: i18n.t("auth.resetPassword.validation.passwordNumber")
      })
      .refine((value) => passwordRules.hasSpecialChar.test(value), {
        message: i18n.t("auth.resetPassword.validation.passwordSpecial")
      }),
    confirmPassword: z
      .string()
      .min(1, i18n.t("auth.resetPassword.validation.confirmPasswordRequired"))
  })
  .superRefine((values, ctx) => {
    if (values.newPassword !== values.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: i18n.t("auth.resetPassword.validation.passwordsMatch")
      })
    }
  })

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>
export const accountSchema = z
  .object({
    name: z.string().min(1, i18n.t("auth.register.validation.nameRequired")),
    email: z.email(i18n.t("auth.register.validation.emailInvalid")),
    password: z
      .string()
      .min(
        passwordRules.minLength,
        i18n.t("auth.register.validation.passwordMin", { count: passwordRules.minLength })
      )
      .max(128)
      .refine((value) => passwordRules.hasUppercase.test(value), {
        message: i18n.t("auth.register.validation.passwordUppercase")
      })
      .refine((value) => passwordRules.hasLowercase.test(value), {
        message: i18n.t("auth.register.validation.passwordLowercase")
      })
      .refine((value) => passwordRules.hasNumber.test(value), {
        message: i18n.t("auth.register.validation.passwordNumber")
      })
      .refine((value) => passwordRules.hasSpecialChar.test(value), {
        message: i18n.t("auth.register.validation.passwordSpecial")
      }),
    confirmPassword: z.string().min(1, i18n.t("auth.register.validation.confirmPasswordRequired"))
  })
  .superRefine((values, ctx) => {
    if (values.password !== values.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: i18n.t("auth.register.validation.passwordsMatch")
      })
    }
  })

export type AccountValues = z.infer<typeof accountSchema>
