import { headers } from "next/headers"

import { notFound, redirect } from "next/navigation"

import { eq } from "drizzle-orm"

import { auth } from "@/lib/auth"

import { database } from "@/database"
import { members } from "@/database/schema"

export type Role = "owner" | "accountant" | "assistant"

type RequestHeaders = Awaited<ReturnType<typeof headers>>

export async function getSession(requestHeaders?: RequestHeaders) {
  return auth.api.getSession({
    headers: requestHeaders ?? (await headers())
  })
}

export async function requireSession(requestHeaders?: RequestHeaders) {
  const session = await getSession(requestHeaders)

  if (!session) redirect("/login")

  return session
}

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

function isNoActiveOrganizationError(error: unknown): boolean {
  return error instanceof Error && error.message === "No active organization"
}
