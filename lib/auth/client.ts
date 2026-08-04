import { organizationClient, twoFactorClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  // A literal `process.env.NEXT_PUBLIC_*` member expression rather than `lib/config/env.ts`, for
  // the same reason as `lib/storage/index.ts`: this module ships to the browser, and Next.js
  // inlines a public variable only when it sees that exact expression.
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [twoFactorClient(), organizationClient()]
})

export const { signOut, useSession } = authClient
