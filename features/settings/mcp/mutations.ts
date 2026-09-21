"use server"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { eq } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole, type Role } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

import { database } from "@/database"
import { settings } from "@/database/schema"

import { setMcpEnabledSchema } from "./schemas"

type SetMcpEnabledResult = { data: { enabled: boolean } } | { error: string }

type McpSettingsWriteContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

type McpSettingsWriteGate = { context: McpSettingsWriteContext } | { error: string }

type SavedMcpSetting = { changed: false } | { changed: true; settingsId: string }

// Turning the server off needs no confirmation and takes effect on the assistant's next request,
// because `features/mcp/queries.ts`'s `isMcpEnabled` reads the column on every call. Turning it on
// is the consent decision, which `components/McpSettingsPage/McpAccessCard.tsx` states on the card
// itself rather than in a dialog, so it can be read again while the server is on.
export async function setMcpEnabled(input: unknown): Promise<SetMcpEnabledResult> {
  const gate = await requireMcpSettingsWrite()

  if ("error" in gate) return gate

  const parsed = setMcpEnabledSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate
  const { enabled } = parsed.data

  try {
    const saved = await saveMcpEnabled(enabled)

    if (saved.changed) {
      await writeAudit("settings.mcp.updated", {
        actorUserId: context.userId,
        actorRole: context.role,
        targetEntityType: "settings",
        targetEntityId: saved.settingsId,
        metadata: { enabled },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      })

      revalidatePath("/settings/mcp")
    }

    return { data: { enabled } }
  } catch (error) {
    logger.error(
      { action: "setMcpEnabled", userId: context.userId, err: error },
      "MCP setting update failed"
    )

    return { error: t("settings.mcp.errors.updateFailed") }
  }
}

// Owner-only, on the same footing as minting an API token: letting an assistant read the
// instance's business data is a transmit decision, which ARCHITECTURE.md's role table refuses to
// both other roles.
async function requireMcpSettingsWrite(): Promise<McpSettingsWriteGate> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) return { error: t("errors.unauthorized") }

  const role = await getCurrentRole({ headers: requestHeaders, userId: session.user.id })

  if (role !== "owner") return { error: t("errors.forbidden") }

  return {
    context: {
      userId: session.user.id,
      role,
      ipAddress: getIpAddress(requestHeaders),
      userAgent: requestHeaders.get("user-agent")
    }
  }
}

// Setting the value it already holds writes nothing and records nothing, so a double click cannot
// leave two audit entries for one decision.
async function saveMcpEnabled(enabled: boolean): Promise<SavedMcpSetting> {
  const [existing] = await database
    .select({ id: settings.id, mcpEnabled: settings.mcpEnabled })
    .from(settings)
    .limit(1)

  if (existing?.mcpEnabled === enabled) return { changed: false }

  if (!existing) {
    const [inserted] = await database
      .insert(settings)
      .values({ mcpEnabled: enabled })
      .returning({ id: settings.id })

    if (!inserted) throw new Error("Settings insert returned no row")

    return { changed: true, settingsId: inserted.id }
  }

  await database.update(settings).set({ mcpEnabled: enabled }).where(eq(settings.id, existing.id))

  return { changed: true, settingsId: existing.id }
}
