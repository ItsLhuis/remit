import { organizationClient, twoFactorClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

// No `baseURL`, deliberately. Better Auth's client resolves to the relative `/api/auth` when none is
// given, which is always this instance's own origin, whereas any configured value would be frozen
// into the browser bundle at build time and ship the build machine's address in every image
// (ADR-0040).
export const authClient = createAuthClient({
  plugins: [twoFactorClient(), organizationClient()]
})

export const { signOut, useSession } = authClient
