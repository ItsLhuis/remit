import { type NextRequest } from "next/server"

import { toNextJsHandler } from "better-auth/next-js"

import { eq } from "drizzle-orm"

import { writeAudit } from "@/lib/audit"

import { auth } from "@/lib/auth"

import { database } from "@/database"
import { users } from "@/database/schema"

const handler = toNextJsHandler(auth)

type AuditContext = {
  ipAddress: string | null
  userAgent: string | null
}

type AuditedAuthRoute =
  | "signIn"
  | "signUp"
  | "backupCode"
  | "requestPasswordReset"
  | "changePassword"
  | "enableTwoFactor"
  | "verifyTotp"
  | "generateBackupCodes"

function getIp(request: NextRequest): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  )
}

function getAuditedRoute(pathname: string): AuditedAuthRoute | null {
  if (pathname.endsWith("/sign-in/email")) return "signIn"
  if (pathname.endsWith("/sign-up/email")) return "signUp"
  if (pathname.endsWith("/two-factor/verify-backup-code")) return "backupCode"
  if (pathname.endsWith("/request-password-reset")) return "requestPasswordReset"
  if (pathname.endsWith("/change-password")) return "changePassword"
  if (pathname.endsWith("/two-factor/enable")) return "enableTwoFactor"
  if (pathname.endsWith("/two-factor/verify-totp")) return "verifyTotp"
  if (pathname.endsWith("/two-factor/generate-backup-codes")) return "generateBackupCodes"

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getStringProperty(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null

  const property = value[key]

  return typeof property === "string" ? property : null
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.clone().json()
  } catch {
    return null
  }
}

async function readResponseJson(response: Response): Promise<unknown> {
  try {
    return await response.clone().json()
  } catch {
    return null
  }
}

function getResponseUserId(value: unknown): string | null {
  if (!isRecord(value)) return null

  const user = value.user

  return getStringProperty(user, "id")
}

type SessionUser = {
  id: string
}

async function getSessionUser(request: NextRequest): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: request.headers })

  return session?.user ? { id: session.user.id } : null
}

function withUserAuditContext(context: AuditContext, user: SessionUser | null): WriteAuditContext {
  if (!user) return context

  return {
    ...context,
    actorUserId: user.id,
    targetEntityType: "user",
    targetEntityId: user.id
  }
}

type WriteAuditContext = AuditContext & {
  actorUserId?: string
  targetEntityType?: "user"
  targetEntityId?: string
}

async function clearMustChangePassword(userId: string): Promise<void> {
  await database.update(users).set({ mustChangePassword: false }).where(eq(users.id, userId))
}

function getEmailMetadata(body: unknown): { email: string } | undefined {
  const email = getStringProperty(body, "email")

  return email ? { email } : undefined
}

function isSuccess(response: Response): boolean {
  return response.status >= 200 && response.status < 300
}

export const GET = handler.GET

export async function POST(request: NextRequest): Promise<Response> {
  const pathname = new URL(request.url).pathname
  const auditedRoute = getAuditedRoute(pathname)

  if (!auditedRoute) return handler.POST(request)

  const body = await readJson(request)
  const context: AuditContext = {
    ipAddress: getIp(request),
    userAgent: request.headers.get("user-agent") ?? null
  }
  const sessionUser =
    auditedRoute === "backupCode" ||
    auditedRoute === "changePassword" ||
    auditedRoute === "enableTwoFactor" ||
    auditedRoute === "verifyTotp" ||
    auditedRoute === "generateBackupCodes"
      ? await getSessionUser(request)
      : null

  const response = await handler.POST(request)

  if (response.status === 429) {
    await writeAudit("auth.rate_limit.tripped", {
      ...context,
      metadata: { path: pathname }
    })

    return response
  }

  if (auditedRoute === "signIn") {
    if (isSuccess(response)) {
      const responseBody = await readResponseJson(response)
      const actorUserId = getResponseUserId(responseBody)

      await writeAudit("auth.login.succeeded", {
        ...context,
        ...(actorUserId ? { actorUserId } : {})
      })

      return response
    }

    const emailMetadata = getEmailMetadata(body)

    await writeAudit("auth.login.failed", {
      ...context,
      ...(emailMetadata ? { metadata: emailMetadata } : {})
    })

    return response
  }

  if (auditedRoute === "signUp") return response

  if (!isSuccess(response)) return response

  if (auditedRoute === "backupCode") {
    await writeAudit("auth.backup_code.consumed", withUserAuditContext(context, sessionUser))

    return response
  }

  if (auditedRoute === "requestPasswordReset") {
    const emailMetadata = getEmailMetadata(body)

    await writeAudit("auth.password_reset.email_requested", {
      ...context,
      ...(emailMetadata ? { metadata: emailMetadata } : {})
    })

    return response
  }

  if (auditedRoute === "changePassword") {
    if (sessionUser) await clearMustChangePassword(sessionUser.id)

    await writeAudit("auth.password.changed", withUserAuditContext(context, sessionUser))

    return response
  }

  if (auditedRoute === "enableTwoFactor") {
    await writeAudit("auth.totp.reconfigured", withUserAuditContext(context, sessionUser))

    return response
  }

  await writeAudit("auth.totp.reconfigured", withUserAuditContext(context, sessionUser))

  return response
}
