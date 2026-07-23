import { headers } from "next/headers"

import { notFound, redirect } from "next/navigation"

import { eq } from "drizzle-orm"

import { auth } from "@/lib/auth"

import { database } from "@/database"
import { members } from "@/database/schema"

export type Role = "owner" | "accountant" | "assistant"

type RequestHeaders = Awaited<ReturnType<typeof headers>>

type GetSessionOptions = {
  disableCookieCache?: boolean
}

export async function getSession(requestHeaders?: RequestHeaders, options?: GetSessionOptions) {
  return auth.api.getSession({
    headers: requestHeaders ?? (await headers()),
    ...(options?.disableCookieCache
      ? {
          query: {
            disableCookieCache: true
          }
        }
      : {})
  })
}

export async function requireSession(requestHeaders?: RequestHeaders, options?: GetSessionOptions) {
  const session = await getSession(requestHeaders, options)

  if (!session) redirect("/login")

  return session
}

// Denies with `notFound()` rather than a 403 so an unauthorized role cannot use the response to
// learn that a route exists at all.
export async function requireRole(required: Role | Role[]) {
  const requestHeaders = await headers()
  const session = await requireSession(requestHeaders)
  const requiredRoles = Array.isArray(required) ? required : [required]

  const role = await getCurrentRole({
    headers: requestHeaders,
    userId: session.user.id
  })

  if (!isRole(role) || !requiredRoles.includes(role)) notFound()

  return { session, role }
}

type GetCurrentRoleInput = {
  headers: RequestHeaders
  userId: string
}

// The fallback path may only *select* an already-existing membership and make it the active
// organization; it must never create or repair one. `.agents/rules/auth.md` makes that a hard rule:
// Better Auth owns membership state, and silently minting a membership here would hand a role to a
// user the organization APIs never granted one to. Returning null for a user with no membership is
// the correct outcome, and `requireRole` turns it into a 404.
export async function getCurrentRole({
  headers,
  userId
}: GetCurrentRoleInput): Promise<string | null | undefined> {
  try {
    const activeMemberRole = await auth.api.getActiveMemberRole({ headers })

    return activeMemberRole.role
  } catch (error) {
    if (!isNoActiveOrganizationError(error)) throw error
  }

  const member = await database.query.members.findFirst({
    columns: {
      role: true,
      organizationId: true
    },
    where: eq(members.userId, userId)
  })

  if (!member) return null

  await auth.api.setActiveOrganization({
    headers,
    body: {
      organizationId: member.organizationId
    }
  })

  return member.role
}

function isRole(value: string | null | undefined): value is Role {
  return value === "owner" || value === "accountant" || value === "assistant"
}

// Better Auth signals "session has no active organization" only through this message string, so a
// Better Auth upgrade that rewords it turns the recoverable case above into a thrown error rather
// than a silent misbehaviour. Any other error is rethrown on purpose.
function isNoActiveOrganizationError(error: unknown): boolean {
  return error instanceof Error && error.message === "No active organization"
}
