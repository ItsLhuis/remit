"use server"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import path from "node:path"

import { eq } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole, type Role } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

import { env } from "@/lib/config/env"

import { database } from "@/database"
import { settings } from "@/database/schema"

import { DEFAULT_BACKUP_DIRNAME } from "@/scripts/core/backup/filename"
import { redactOperationalError } from "@/scripts/core/cli/redact"

import { BackupConnectionTestError, type BackupConnectionTestErrorCode } from "./connectionTest"
import {
  toBackupSettingsFormData,
  toBackupSettingsStatus,
  type BackupSettingsStatus
} from "./queries"
import {
  backupSettingsSchema,
  testBackupConnectionSchema,
  type BackupSettingsValues
} from "./schemas"
import { requiresBackupCredentials } from "./services/destinationRequirements"

type SaveBackupSettingsResult =
  | { data: { settings: BackupSettingsValues; status: BackupSettingsStatus } }
  | { error: string }

type TestBackupConnectionResult = { data: { backupTestConnectionAt: string } } | { error: string }

type BackupSettingsWriteContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

type BackupSettingsWriteGate = { context: BackupSettingsWriteContext } | { error: string }

type PersistedBackupSettings = {
  id: string
  backupDestination: "local" | "s3" | "r2" | "b2"
  backupCadence: "daily" | "weekly"
  backupRetentionDaily: number
  backupRetentionWeekly: number
  backupRetentionMonthly: number
  backupS3Bucket: string | null
  backupS3Region: string | null
  backupS3Endpoint: string | null
  backupS3AccessKey: string | null
  backupS3SecretKey: string | null
  backupTestConnectionAt: Date | null
  backupLastSuccessAt: Date | null
  backupLastFailureAt: Date | null
  backupLastFailureReason: string | null
}

type BackupSettingsWritePlan = {
  values: Partial<typeof settings.$inferInsert>
  changedFields: string[]
  secretFieldsChanged: string[]
}

const backupSettingsReturnColumns = {
  id: settings.id,
  backupDestination: settings.backupDestination,
  backupCadence: settings.backupCadence,
  backupRetentionDaily: settings.backupRetentionDaily,
  backupRetentionWeekly: settings.backupRetentionWeekly,
  backupRetentionMonthly: settings.backupRetentionMonthly,
  backupS3Bucket: settings.backupS3Bucket,
  backupS3Region: settings.backupS3Region,
  backupS3Endpoint: settings.backupS3Endpoint,
  backupS3AccessKey: settings.backupS3AccessKey,
  backupS3SecretKey: settings.backupS3SecretKey,
  backupTestConnectionAt: settings.backupTestConnectionAt,
  backupLastSuccessAt: settings.backupLastSuccessAt,
  backupLastFailureAt: settings.backupLastFailureAt,
  backupLastFailureReason: settings.backupLastFailureReason
} as const

export async function saveBackupSettings(input: unknown): Promise<SaveBackupSettingsResult> {
  const gate = await requireBackupSettingsWrite()

  if ("error" in gate) return gate

  const parsed = backupSettingsSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await getPersistedBackupSettings()
    const writePlan = buildBackupSettingsWritePlan(parsed.data, existing)

    if (!existing && writePlan.changedFields.length === 0) {
      return {
        data: { settings: toBackupSettingsFormData(null), status: toBackupSettingsStatus(null) }
      }
    }

    const savedSettings = await upsertBackupSettings(writePlan, existing)

    if (writePlan.changedFields.length > 0) {
      await writeBackupSettingsAudit(context, savedSettings.id, writePlan)
    }

    revalidatePath("/settings/backup")
    revalidatePath("/settings/system")

    return {
      data: {
        settings: toBackupSettingsFormData(savedSettings),
        status: toBackupSettingsStatus(savedSettings)
      }
    }
  } catch (error) {
    return handleBackupSettingsError(error, "saveBackupSettings", context.userId)
  }
}

export async function testBackupConnection(
  input: unknown = {}
): Promise<TestBackupConnectionResult> {
  const gate = await requireBackupSettingsWrite()

  if ("error" in gate) return gate

  const parsed = testBackupConnectionSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await getPersistedBackupSettings()

    if (!existing) return { error: t("settings.backup.errors.notConfigured") }

    const destination = existing.backupDestination

    if (requiresBackupCredentials(destination) && !hasCompleteCredentials(existing)) {
      return { error: t("settings.backup.errors.notConfigured") }
    }

    // Imported dynamically so the S3 client is only constructed when someone actually runs a
    // connection test, rather than on every request that touches this module.
    const { testBackupConnection: runConnectionTest } = await import("./connectionTest")

    await runConnectionTest(destination, {
      accessKey: existing.backupS3AccessKey,
      bucket: existing.backupS3Bucket,
      endpoint: existing.backupS3Endpoint,
      localDirectory: resolveLocalBackupDirectory(),
      region: existing.backupS3Region,
      secretKey: existing.backupS3SecretKey
    })

    const backupTestConnectionAt = new Date()
    const [updatedSettings] = await database
      .update(settings)
      .set({ backupTestConnectionAt })
      .where(eq(settings.id, existing.id))
      .returning(backupSettingsReturnColumns)

    if (!updatedSettings) throw new Error("Backup test connection update returned no row")

    await writeBackupSettingsAudit(context, updatedSettings.id, {
      values: { backupTestConnectionAt },
      changedFields: ["backupTestConnectionAt"],
      secretFieldsChanged: []
    })

    revalidatePath("/settings/backup")
    revalidatePath("/settings/system")

    return {
      data: {
        backupTestConnectionAt: updatedSettings.backupTestConnectionAt?.toISOString() ?? ""
      }
    }
  } catch (error) {
    if (error instanceof BackupConnectionTestError) {
      logger.error(
        {
          action: "testBackupConnection",
          userId: context.userId,
          code: error.code,
          // The provider's own message can carry a presigned URL or a key id, so it reaches the log
          // through the same redactor the operational CLI uses rather than as `err`.
          reason: redactOperationalError(error.cause, { stripStackFrames: true })
        },
        "Backup destination connection test failed"
      )

      return { error: getBackupConnectionErrorMessage(error.code) }
    }

    return handleBackupSettingsError(error, "testBackupConnection", context.userId)
  }
}

async function requireBackupSettingsWrite(): Promise<BackupSettingsWriteGate> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) return { error: t("errors.unauthorized") }

  const role = await getCurrentRole({ headers: requestHeaders, userId: session.user.id })

  if (role !== "owner") return { error: t("errors.forbidden") }

  // Hosted mode makes the destination operator-managed (ARCHITECTURE.md section 18). The form
  // renders read-only there, but the refusal has to live here too: a read-only form is a rendering
  // decision and never the authorization.
  if (env.REMIT_HOSTED_MODE) return { error: t("settings.backup.errors.hostedManaged") }

  return {
    context: {
      userId: session.user.id,
      role,
      ipAddress: getIpAddress(requestHeaders),
      userAgent: requestHeaders.get("user-agent")
    }
  }
}

async function getPersistedBackupSettings(): Promise<PersistedBackupSettings | null> {
  return (
    (await database.query.settings.findFirst({
      columns: {
        id: true,
        backupDestination: true,
        backupCadence: true,
        backupRetentionDaily: true,
        backupRetentionWeekly: true,
        backupRetentionMonthly: true,
        backupS3Bucket: true,
        backupS3Region: true,
        backupS3Endpoint: true,
        backupS3AccessKey: true,
        backupS3SecretKey: true,
        backupTestConnectionAt: true,
        backupLastSuccessAt: true,
        backupLastFailureAt: true,
        backupLastFailureReason: true
      }
    })) ?? null
  )
}

// The two credentials are written only when the submission carries a non-empty value, so a blank
// field means "keep what is stored" rather than "clear it". That is the write half of the contract
// `toBackupSettingsFormData` in queries.ts sets up by never sending a stored credential to the
// client: treating blank as a clear would wipe an operator's backup credentials on the first save
// of the form, and the next backup would fail with no visible cause.
function buildBackupSettingsWritePlan(
  values: BackupSettingsValues,
  existing: PersistedBackupSettings | null
): BackupSettingsWritePlan {
  const backupS3Bucket = emptyToNull(values.backupS3Bucket)
  const backupS3Region = emptyToNull(values.backupS3Region)
  const backupS3Endpoint = emptyToNull(values.backupS3Endpoint)
  const writeValues: Partial<typeof settings.$inferInsert> = {
    backupDestination: values.backupDestination,
    backupCadence: values.backupCadence,
    backupRetentionDaily: values.backupRetentionDaily,
    backupRetentionWeekly: values.backupRetentionWeekly,
    backupRetentionMonthly: values.backupRetentionMonthly,
    backupS3Bucket,
    backupS3Region,
    backupS3Endpoint
  }
  const changedFields = getChangedFields([
    ["backupDestination", existing?.backupDestination ?? "local", values.backupDestination],
    ["backupCadence", existing?.backupCadence ?? "daily", values.backupCadence],
    ["backupRetentionDaily", existing?.backupRetentionDaily ?? 7, values.backupRetentionDaily],
    ["backupRetentionWeekly", existing?.backupRetentionWeekly ?? 4, values.backupRetentionWeekly],
    [
      "backupRetentionMonthly",
      existing?.backupRetentionMonthly ?? 12,
      values.backupRetentionMonthly
    ],
    ["backupS3Bucket", existing?.backupS3Bucket ?? null, backupS3Bucket],
    ["backupS3Region", existing?.backupS3Region ?? null, backupS3Region],
    ["backupS3Endpoint", existing?.backupS3Endpoint ?? null, backupS3Endpoint]
  ])
  const secretFieldsChanged: string[] = []
  const backupS3AccessKey = emptyToNull(values.backupS3AccessKey)

  if (backupS3AccessKey && backupS3AccessKey !== existing?.backupS3AccessKey) {
    writeValues.backupS3AccessKey = backupS3AccessKey
    changedFields.push("backupS3AccessKey")
    secretFieldsChanged.push("backupS3AccessKey")
  }

  const backupS3SecretKey = emptyToNull(values.backupS3SecretKey)

  if (backupS3SecretKey && backupS3SecretKey !== existing?.backupS3SecretKey) {
    writeValues.backupS3SecretKey = backupS3SecretKey
    changedFields.push("backupS3SecretKey")
    secretFieldsChanged.push("backupS3SecretKey")
  }

  return {
    values: writeValues,
    changedFields: Array.from(new Set(changedFields)),
    secretFieldsChanged
  }
}

function getChangedFields(
  comparisons: Array<
    [field: string, previous: string | number | null, next: string | number | null]
  >
): string[] {
  return comparisons.flatMap(([field, previous, next]) => (previous !== next ? [field] : []))
}

async function upsertBackupSettings(
  writePlan: BackupSettingsWritePlan,
  existing: PersistedBackupSettings | null
): Promise<PersistedBackupSettings> {
  if (existing) {
    if (writePlan.changedFields.length === 0) return existing

    const [updatedSettings] = await database
      .update(settings)
      .set(writePlan.values)
      .where(eq(settings.id, existing.id))
      .returning(backupSettingsReturnColumns)

    if (!updatedSettings) throw new Error("Backup settings update returned no row")

    return updatedSettings
  }

  const [createdSettings] = await database
    .insert(settings)
    .values(writePlan.values)
    .returning(backupSettingsReturnColumns)

  if (!createdSettings) throw new Error("Backup settings insert returned no row")

  return createdSettings
}

async function writeBackupSettingsAudit(
  context: BackupSettingsWriteContext,
  settingsId: string,
  writePlan: BackupSettingsWritePlan
): Promise<void> {
  await writeAudit("settings.backup.updated", {
    actorUserId: context.userId,
    actorRole: context.role,
    targetEntityType: "settings",
    targetEntityId: settingsId,
    metadata: {
      changedFields: writePlan.changedFields,
      secretFieldsChanged: writePlan.secretFieldsChanged
    },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
}

function hasCompleteCredentials(existing: PersistedBackupSettings): boolean {
  return Boolean(
    existing.backupS3AccessKey && existing.backupS3SecretKey && existing.backupS3Bucket
  )
}

// The same directory `buildBackupPlan` writes local archives into, so a local test proves the
// operator's data volume is writable by the process that will run the backup.
function resolveLocalBackupDirectory(): string {
  return path.resolve(env.REMIT_DATA_DIR, DEFAULT_BACKUP_DIRNAME)
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}

function getBackupConnectionErrorMessage(code: BackupConnectionTestErrorCode): string {
  if (code === "auth") return t("settings.backup.errors.authFailed")
  if (code === "permission") return t("settings.backup.errors.permissionFailed")
  if (code === "not_found") return t("settings.backup.errors.bucketNotFound")
  if (code === "connection") return t("settings.backup.errors.connectionFailed")
  if (code === "probe_not_removed") return t("settings.backup.errors.probeNotRemoved")

  return t("settings.backup.errors.testFailed")
}

function handleBackupSettingsError(
  error: unknown,
  action: string,
  userId: string | null
): { error: string } {
  logger.error({ action, userId, err: error }, "Backup settings action failed")

  return { error: t("settings.backup.errors.updateFailed") }
}
