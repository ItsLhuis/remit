"use server"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { eq } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole, type Role } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { emit } from "@/lib/events"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

import { database } from "@/database"
import { settings } from "@/database/schema"

import { toEmailSettingsFormData, type EmailSettingsFormData } from "./queries"
import { emailSettingsSchema, testEmailSettingsSchema, type EmailSettingsValues } from "./schemas"

type SaveEmailSettingsResult = { data: { settings: EmailSettingsFormData } } | { error: string }

type SendEmailSettingsTestResult = { data: { emailTestSendAt: string } } | { error: string }

type EmailSettingsWriteContext = {
  userId: string
  userEmail: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

type EmailSettingsWriteGate = { context: EmailSettingsWriteContext } | { error: string }

type PersistedEmailSettings = {
  id: string
  businessName: string | null
  businessEmail: string | null
  emailProvider: "smtp" | "resend" | null
  smtpHost: string | null
  smtpPort: number | null
  smtpUser: string | null
  smtpPass: string | null
  smtpSecure: boolean
  resendApiKey: string | null
  emailFromName: string | null
  emailFromAddress: string | null
  emailTestSendAt: Date | null
}

type EmailSettingsWritePlan = {
  values: Partial<typeof settings.$inferInsert>
  changedFields: string[]
  secretFieldsChanged: string[]
}

const emailSettingsReturnColumns = {
  id: settings.id,
  businessName: settings.businessName,
  businessEmail: settings.businessEmail,
  emailProvider: settings.emailProvider,
  smtpHost: settings.smtpHost,
  smtpPort: settings.smtpPort,
  smtpUser: settings.smtpUser,
  smtpPass: settings.smtpPass,
  smtpSecure: settings.smtpSecure,
  resendApiKey: settings.resendApiKey,
  emailFromName: settings.emailFromName,
  emailFromAddress: settings.emailFromAddress,
  emailTestSendAt: settings.emailTestSendAt
} as const

const emailDeliveryErrorCodes = [
  "not_configured",
  "provider_failed",
  "resend_auth",
  "resend_rejected",
  "smtp_auth",
  "smtp_connection",
  "smtp_timeout",
  "smtp_tls"
] as const

type EmailDeliveryErrorCode = (typeof emailDeliveryErrorCodes)[number]

export async function saveEmailSettings(input: unknown): Promise<SaveEmailSettingsResult> {
  const gate = await requireEmailSettingsWrite()

  if ("error" in gate) return gate

  const parsed = emailSettingsSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await getPersistedEmailSettings()
    const writePlan = buildEmailSettingsWritePlan(parsed.data, existing)
    const savedSettings = await upsertEmailSettings(writePlan.values, existing)

    if (writePlan.changedFields.length > 0) {
      await writeEmailSettingsAudit(context, savedSettings.id, writePlan)
    }

    revalidatePath("/settings/email")
    revalidatePath("/settings/system")

    return { data: { settings: toEmailSettingsFormData(savedSettings) } }
  } catch (error) {
    return handleEmailSettingsError(error, "saveEmailSettings", context.userId)
  }
}

export async function sendEmailSettingsTest(input: unknown): Promise<SendEmailSettingsTestResult> {
  const gate = await requireEmailSettingsWrite()

  if ("error" in gate) return gate

  const parsed = testEmailSettingsSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await getPersistedEmailSettings()

    if (!existing?.emailProvider) {
      return { error: t("settings.email.errors.notConfigured") }
    }

    const recipientEmail = parsed.data.recipientEmail || context.userEmail
    const { sendTransactionalEmail } = await import("@/features/email/server")

    await sendTransactionalEmail({
      to: recipientEmail,
      subject: t("settings.email.testSubject"),
      text: t("settings.email.testText")
    })

    const emailTestSendAt = new Date()
    const [updatedSettings] = await database
      .update(settings)
      .set({ emailTestSendAt })
      .where(eq(settings.id, existing.id))
      .returning(emailSettingsReturnColumns)

    if (!updatedSettings) throw new Error("Email settings test-send update returned no row")

    await emit("settings.email.configured", { userId: context.userId })

    revalidatePath("/settings/email")
    revalidatePath("/settings/system")

    return { data: { emailTestSendAt: updatedSettings.emailTestSendAt?.toISOString() ?? "" } }
  } catch (error) {
    const deliveryCode = getEmailDeliveryErrorCode(error)

    if (deliveryCode) {
      logger.error(
        {
          action: "sendEmailSettingsTest",
          userId: context.userId,
          code: deliveryCode,
          err: error
        },
        "Email settings test send failed"
      )

      return { error: getEmailDeliveryErrorMessage(deliveryCode) }
    }

    return handleEmailSettingsError(error, "sendEmailSettingsTest", context.userId)
  }
}

async function requireEmailSettingsWrite(): Promise<EmailSettingsWriteGate> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) return { error: t("errors.unauthorized") }

  const role = await getCurrentRole({ headers: requestHeaders, userId: session.user.id })

  if (role !== "owner") return { error: t("errors.forbidden") }

  return {
    context: {
      userId: session.user.id,
      userEmail: session.user.email,
      role,
      ipAddress: getIpAddress(requestHeaders),
      userAgent: requestHeaders.get("user-agent")
    }
  }
}

async function getPersistedEmailSettings(): Promise<PersistedEmailSettings | null> {
  return (
    (await database.query.settings.findFirst({
      columns: {
        id: true,
        businessName: true,
        businessEmail: true,
        emailProvider: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        smtpPass: true,
        smtpSecure: true,
        resendApiKey: true,
        emailFromName: true,
        emailFromAddress: true,
        emailTestSendAt: true
      }
    })) ?? null
  )
}

function buildEmailSettingsWritePlan(
  values: EmailSettingsValues,
  existing: PersistedEmailSettings | null
): EmailSettingsWritePlan {
  const emailFromName = values.emailFromName.trim()
  const emailFromAddress = values.emailFromAddress.trim()
  const writeValues: Partial<typeof settings.$inferInsert> = {
    emailProvider: values.emailProvider,
    emailFromName,
    emailFromAddress
  }
  const changedFields = getSharedChangedFields(values, existing)
  const secretFieldsChanged: string[] = []

  if (values.emailProvider === "smtp") {
    const smtpPass = values.smtpPass.trim() || existing?.smtpPass

    if (!smtpPass) {
      throw new ExpectedEmailSettingsError(t("settings.email.validation.smtpPasswordRequired"))
    }

    writeValues.smtpHost = values.smtpHost.trim()
    writeValues.smtpPort = values.smtpPort
    writeValues.smtpUser = values.smtpUser.trim()
    writeValues.smtpSecure = values.smtpSecure

    changedFields.push(
      ...getChangedFields([
        ["smtpHost", existing?.smtpHost ?? null, writeValues.smtpHost],
        ["smtpPort", existing?.smtpPort ?? null, writeValues.smtpPort],
        ["smtpUser", existing?.smtpUser ?? null, writeValues.smtpUser],
        ["smtpSecure", existing?.smtpSecure ?? null, writeValues.smtpSecure]
      ])
    )

    if (values.smtpPass.trim() && values.smtpPass.trim() !== existing?.smtpPass) {
      writeValues.smtpPass = values.smtpPass.trim()
      changedFields.push("smtpPass")
      secretFieldsChanged.push("smtpPass")
    }
  }

  if (values.emailProvider === "resend") {
    const resendApiKey = values.resendApiKey.trim() || existing?.resendApiKey

    if (!resendApiKey) {
      throw new ExpectedEmailSettingsError(t("settings.email.validation.resendApiKeyRequired"))
    }

    if (values.resendApiKey.trim() && values.resendApiKey.trim() !== existing?.resendApiKey) {
      writeValues.resendApiKey = values.resendApiKey.trim()
      changedFields.push("resendApiKey")
      secretFieldsChanged.push("resendApiKey")
    }
  }

  return {
    values: writeValues,
    changedFields: Array.from(new Set(changedFields)),
    secretFieldsChanged
  }
}

function getSharedChangedFields(
  values: EmailSettingsValues,
  existing: PersistedEmailSettings | null
): string[] {
  return getChangedFields([
    ["emailProvider", existing?.emailProvider ?? null, values.emailProvider],
    ["emailFromName", existing?.emailFromName ?? null, values.emailFromName.trim()],
    ["emailFromAddress", existing?.emailFromAddress ?? null, values.emailFromAddress.trim()]
  ])
}

function getChangedFields(
  comparisons: Array<
    [field: string, previous: string | number | boolean | null, next: string | number | boolean]
  >
): string[] {
  return comparisons.flatMap(([field, previous, next]) => (previous !== next ? [field] : []))
}

async function upsertEmailSettings(
  values: Partial<typeof settings.$inferInsert>,
  existing: PersistedEmailSettings | null
): Promise<PersistedEmailSettings> {
  if (existing) {
    const [updatedSettings] = await database
      .update(settings)
      .set(values)
      .where(eq(settings.id, existing.id))
      .returning(emailSettingsReturnColumns)

    if (!updatedSettings) throw new Error("Email settings update returned no row")

    return updatedSettings
  }

  const [createdSettings] = await database
    .insert(settings)
    .values(values)
    .returning(emailSettingsReturnColumns)

  if (!createdSettings) throw new Error("Email settings insert returned no row")

  return createdSettings
}

async function writeEmailSettingsAudit(
  context: EmailSettingsWriteContext,
  settingsId: string,
  writePlan: EmailSettingsWritePlan
): Promise<void> {
  await writeAudit("settings.email.updated", {
    actorUserId: context.userId,
    actorRole: context.role,
    targetEntityType: "settings",
    targetEntityId: settingsId,
    metadata: {
      provider: writePlan.values.emailProvider ?? null,
      changedFields: writePlan.changedFields,
      secretFieldsChanged: writePlan.secretFieldsChanged
    },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
}

function getEmailDeliveryErrorCode(error: unknown): EmailDeliveryErrorCode | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null

  const code = error.code

  if (typeof code !== "string") return null

  return isEmailDeliveryErrorCode(code) ? code : null
}

function isEmailDeliveryErrorCode(value: string): value is EmailDeliveryErrorCode {
  return emailDeliveryErrorCodes.some((code) => code === value)
}

function getEmailDeliveryErrorMessage(code: EmailDeliveryErrorCode): string {
  if (code === "not_configured") return t("settings.email.errors.notConfigured")
  if (code === "resend_auth") return t("settings.email.errors.resendAuthFailed")
  if (code === "resend_rejected") return t("settings.email.errors.resendRejected")
  if (code === "smtp_auth") return t("settings.email.errors.smtpAuthFailed")
  if (code === "smtp_connection") return t("settings.email.errors.smtpConnectionFailed")
  if (code === "smtp_timeout") return t("settings.email.errors.smtpTimeout")
  if (code === "smtp_tls") return t("settings.email.errors.smtpTlsFailed")

  return t("settings.email.errors.testSendFailed")
}

function handleEmailSettingsError(
  error: unknown,
  action: string,
  userId: string | null
): { error: string } {
  if (error instanceof ExpectedEmailSettingsError) return { error: error.message }

  logger.error({ action, userId, err: error }, "Email settings action failed")

  return { error: t("settings.email.errors.updateFailed") }
}

class ExpectedEmailSettingsError extends Error {}
