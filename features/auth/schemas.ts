import { z } from "zod"

export const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Password is required.")
})

export type LoginValues = z.infer<typeof loginSchema>

export const totpSchema = z.object({
  code: z.string().length(6, "Enter the 6-digit code.")
})

export type TotpValues = z.infer<typeof totpSchema>

export const recoveryCodeSchema = z.object({
  code: z
    .string()
    .min(8, "Enter your recovery code.")
    .regex(/^[a-zA-Z0-9-]+$/, "Invalid recovery code format.")
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
    name: z.string().min(1, "Name is required."),
    email: z.email("Enter a valid email address."),
    password: z
      .string()
      .min(
        passwordRules.minLength,
        `Password must be at least ${passwordRules.minLength} characters.`
      )
      .max(128)
      .refine((value) => passwordRules.hasUppercase.test(value), {
        message: "Password must include at least 1 uppercase letter."
      })
      .refine((value) => passwordRules.hasLowercase.test(value), {
        message: "Password must include at least 1 lowercase letter."
      })
      .refine((value) => passwordRules.hasNumber.test(value), {
        message: "Password must include at least 1 number."
      })
      .refine((value) => passwordRules.hasSpecialChar.test(value), {
        message: "Password must include at least 1 special character."
      }),
    confirmPassword: z.string().min(1, "Please confirm your password.")
  })
  .superRefine((values, ctx) => {
    if (values.password !== values.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match."
      })
    }
  })

export type AccountValues = z.infer<typeof accountSchema>
