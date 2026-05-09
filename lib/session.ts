import { headers } from "next/headers"

import { notFound, redirect } from "next/navigation"

import { auth } from "@/lib/auth"

export type Role = "owner" | "accountant" | "assistant"

export async function getSession() {
  return auth.api.getSession({
    headers: await headers()
  })
}

export async function requireSession() {
  const session = await getSession()
  if (!session) redirect("/login")
  return session
}

export async function requireRole(required: Role | Role[]) {
  const session = await requireSession()
  const requiredRoles = Array.isArray(required) ? required : [required]

  const activeMemberRole = await auth.api.getActiveMemberRole({
    headers: await headers()
  })

  const role = activeMemberRole.role

  if (!isRole(role) || !requiredRoles.includes(role)) notFound()

  return { session, role }
}

function isRole(value: string | null | undefined): value is Role {
  return value === "owner" || value === "accountant" || value === "assistant"
}
