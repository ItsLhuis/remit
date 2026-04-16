import { z } from "zod"

export const accountDetailsSchema = z.object({
  name: z.string().min(1, "Name is required."),
  email: z.email("Enter a valid email address.")
})

export type AccountDetailsValues = z.infer<typeof accountDetailsSchema>
