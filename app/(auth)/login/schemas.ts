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
