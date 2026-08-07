"use server"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { eq, inArray, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole, type Role } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

import { database } from "@/database"
import { activityLogs } from "@/database/schema"

import { activityIdSchema, activityIdsSchema } from "./schemas"

export type MarkActivityReadResult = { data: { count: number } } | { error: string }

export type DeleteActivityResult = { data: { id: string } } | { error: string }

type ActivityWriteContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

type ActivityWriteGate = { context: ActivityWriteContext } | { error: string }

const activityPath = "/activity"

export async function markActivityRead(input: unknown): Promise<MarkActivityReadResult> {
  const gate = await requireActivityWrite()

  if ("error" in gate) return gate

  const parsed = activityIdsSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    const updated = await database
      .update(activityLogs)
      .set({ readAt: new Date() })
      .where(inArray(activityLogs.id, parsed.data.ids))
      .returning({ id: activityLogs.id })

    revalidateActivity()

    return { data: { count: updated.length } }
  } catch (error) {
    logger.error(
      { action: "markActivityRead", userId: gate.context.userId, err: error },
      "Activity mark-read failed"
    )

    return { error: t("activity.errors.markReadFailed") }
  }
}

export async function markAllActivityRead(): Promise<MarkActivityReadResult> {
  const gate = await requireActivityWrite()

  if ("error" in gate) return gate

  try {
    const updated = await database
      .update(activityLogs)
      .set({ readAt: new Date() })
      .where(isNull(activityLogs.readAt))
      .returning({ id: activityLogs.id })

    revalidateActivity()

    return { data: { count: updated.length } }
  } catch (error) {
    logger.error(
      { action: "markAllActivityRead", userId: gate.context.userId, err: error },
      "Activity mark-all-read failed"
    )

    return { error: t("activity.errors.markReadFailed") }
  }
}

// A hard delete, because `activity_logs` carries no `deleted_at` (SCHEMA.md's activity logs table):
// the row is user-owned history rather than the security record `audit_logs` keeps, and editing one
// is specified as delete plus insert. The audit entry below is what preserves the fact that a
// history entry was removed, since the row itself no longer can.
export async function deleteActivity(input: unknown): Promise<DeleteActivityResult> {
  const gate = await requireActivityDelete()

  if ("error" in gate) return gate

  const parsed = activityIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const [deleted] = await database
      .delete(activityLogs)
      .where(eq(activityLogs.id, parsed.data.id))
      .returning({
        id: activityLogs.id,
        entityType: activityLogs.entityType,
        entityId: activityLogs.entityId,
        action: activityLogs.action
      })

    if (!deleted) return { error: t("activity.errors.notFound") }

    await writeAudit("activity.deleted", {
      actorUserId: context.userId,
      actorRole: context.role,
      targetEntityType: "activity_log",
      targetEntityId: deleted.id,
      metadata: {
        entityType: deleted.entityType,
        entityId: deleted.entityId,
        action: deleted.action
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    })

    revalidateActivity()

    return { data: { id: deleted.id } }
  } catch (error) {
    logger.error(
      { action: "deleteActivity", userId: context.userId, activityId: parsed.data.id, err: error },
      "Activity delete failed"
    )

    return { error: t("activity.errors.deleteFailed") }
  }
}

// Reading the feed is not privileged — every role that can see the app can see what happened in it —
// so marking an entry read is granted to any member. Deleting history is not: it is the one action
// here that destroys a record, and it stays with the owner.
async function requireActivityWrite(): Promise<ActivityWriteGate> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) return { error: t("errors.unauthorized") }

  const role = await getCurrentRole({ headers: requestHeaders, userId: session.user.id })

  if (!isRole(role)) return { error: t("errors.forbidden") }

  return {
    context: {
      userId: session.user.id,
      role,
      ipAddress: getIpAddress(requestHeaders),
      userAgent: requestHeaders.get("user-agent")
    }
  }
}

async function requireActivityDelete(): Promise<ActivityWriteGate> {
  const gate = await requireActivityWrite()

  if ("error" in gate) return gate

  if (gate.context.role !== "owner") return { error: t("errors.forbidden") }

  return gate
}

// The layout revalidation is not redundant with the page one: the unread count lives in the sidebar,
// which the dashboard layout renders, so a page-only revalidation would leave a stale badge above a
// freshly emptied feed.
function revalidateActivity(): void {
  revalidatePath(activityPath)
  revalidatePath("/", "layout")
}

function isRole(value: string | null | undefined): value is Role {
  return value === "owner" || value === "accountant" || value === "assistant"
}
