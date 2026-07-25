import { eq } from "drizzle-orm"

import { loadAppContext } from "./appContext"
import { E2E_OWNER_PASSWORD } from "./ownerCredentials"
import { createOwnerSessionCookie, getOwnerUserId } from "./ownerSession"
import { generateTotpCode } from "./totp"

// `proxy.ts` only lets a request past /setup once the settings row carries a business name and the
// session user has `twoFactorEnabled`, so every dashboard spec is unreachable until TOTP enrolment
// is finished. auth.spec.ts drives registration and the business step through the UI but stops at
// the QR screen, because reading the code off a QR image is the one step a browser cannot do. This
// completes the same flow through Better Auth's own endpoints - enable, then verify with a code
// generated from the returned URI - so no Better Auth-owned table is written by hand.
export async function ensureOwnerTotpEnrolled(): Promise<void> {
  const { auth, database, schema } = await loadAppContext()

  const userId = await getOwnerUserId()

  const owner = await database.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { twoFactorEnabled: true }
  })

  if (owner?.twoFactorEnabled) return

  const cookie = await createOwnerSessionCookie(userId)
  const headers = new Headers({ cookie: `${cookie.name}=${cookie.value}` })

  const { totpURI } = await auth.api.enableTwoFactor({
    headers,
    body: { password: E2E_OWNER_PASSWORD }
  })

  const secret = new URL(totpURI).searchParams.get("secret")

  if (!secret) throw new Error("Better Auth returned a TOTP URI with no secret parameter")

  await auth.api.verifyTOTP({
    headers,
    body: { code: generateTotpCode(secret) }
  })
}
