import { z } from "zod"

export const confirmPasswordSchema = z.object({
  password: z.string().min(1, "Password is required.")
})

export type ConfirmPasswordValues = z.infer<typeof confirmPasswordSchema>

export const totpVerifySchema = z.object({
  code: z
    .string()
    .length(6, "Enter the 6-digit code.")
    .regex(/^\d{6}$/, "Code must be 6 digits.")
})

export type TotpVerifyValues = z.infer<typeof totpVerifySchema>
