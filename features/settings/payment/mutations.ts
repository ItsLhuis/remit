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

import { toPaymentSettingsFormData, type PaymentSettingsFormData } from "./queries"
import {
  paymentSettingsSchema,
  testStripeConnectionSchema,
  type PaymentSettingsValues
} from "./schemas"
import { normalizeIban } from "./services/iban"
import { StripeConnectionTestError, type StripeConnectionTestErrorCode } from "./stripe"

type SavePaymentSettingsResult = { data: { settings: PaymentSettingsFormData } } | { error: string }

type TestStripeConnectionResult = { data: { stripeTestConnectionAt: string } } | { error: string }

type PaymentSettingsWriteContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

type PersistedPaymentSettings = {
  id: string
  paymentIban: string | null
  paymentBankName: string | null
  paymentInstructions: string | null
  stripePublishableKey: string | null
  stripeSecretKey: string | null
  stripeWebhookSecret: string | null
  stripeTestConnectionAt: Date | null
}

type PaymentSettingsWritePlan = {
  values: Partial<typeof settings.$inferInsert>
  changedFields: string[]
  secretFieldsChanged: string[]
}

const paymentSettingsReturnColumns = {
  id: settings.id,
  paymentIban: settings.paymentIban,
  paymentBankName: settings.paymentBankName,
  paymentInstructions: settings.paymentInstructions,
  stripePublishableKey: settings.stripePublishableKey,
  stripeSecretKey: settings.stripeSecretKey,
  stripeWebhookSecret: settings.stripeWebhookSecret,
  stripeTestConnectionAt: settings.stripeTestConnectionAt
} as const

export async function savePaymentSettings(input: unknown): Promise<SavePaymentSettingsResult> {
  const parsed = paymentSettingsSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  let context: PaymentSettingsWriteContext | null = null

  try {
    context = await requirePaymentSettingsWrite()

    const existing = await getPersistedPaymentSettings()
    const writePlan = buildPaymentSettingsWritePlan(parsed.data, existing)

    if (!existing && writePlan.changedFields.length === 0) {
      return { data: { settings: toPaymentSettingsFormData(null) } }
    }

    const savedSettings = await upsertPaymentSettings(writePlan, existing)

    if (writePlan.changedFields.length > 0) {
      await writePaymentSettingsAudit(context, savedSettings.id, writePlan)
    }

    revalidatePath("/settings/payment")
    revalidatePath("/settings/system")

    return { data: { settings: toPaymentSettingsFormData(savedSettings) } }
  } catch (error) {
    return handlePaymentSettingsError(error, "savePaymentSettings", context?.userId ?? null)
  }
}

export async function testStripeConnection(
  input: unknown = {}
): Promise<TestStripeConnectionResult> {
  const parsed = testStripeConnectionSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  let context: PaymentSettingsWriteContext | null = null

  try {
    context = await requirePaymentSettingsWrite()

    const existing = await getPersistedPaymentSettings()

    if (!existing?.stripePublishableKey || !existing.stripeSecretKey) {
      return { error: t("settings.payment.errors.stripeNotConfigured") }
    }

    const { testStripeConnection: testConnection } = await import("./stripe")

    await testConnection(existing.stripeSecretKey)

    const stripeTestConnectionAt = new Date()
    const [updatedSettings] = await database
      .update(settings)
      .set({ stripeTestConnectionAt })
      .where(eq(settings.id, existing.id))
      .returning(paymentSettingsReturnColumns)

    if (!updatedSettings) throw new Error("Stripe test connection update returned no row")

    await writePaymentSettingsAudit(context, updatedSettings.id, {
      values: { stripeTestConnectionAt },
      changedFields: ["stripeTestConnectionAt"],
      secretFieldsChanged: []
    })
    await emit("settings.payment.configured", { userId: context.userId })

    revalidatePath("/settings/payment")
    revalidatePath("/settings/system")

    return {
      data: {
        stripeTestConnectionAt: updatedSettings.stripeTestConnectionAt?.toISOString() ?? ""
      }
    }
  } catch (error) {
    if (error instanceof StripeConnectionTestError) {
      logger.error(
        {
          action: "testStripeConnection",
          userId: context?.userId ?? null,
          code: error.code,
          stripeErrorType: error.stripeErrorType
        },
        "Stripe settings test connection failed"
      )

      return { error: getStripeConnectionErrorMessage(error.code) }
    }

    return handlePaymentSettingsError(error, "testStripeConnection", context?.userId ?? null)
  }
}

async function requirePaymentSettingsWrite(): Promise<PaymentSettingsWriteContext> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) throw new ExpectedPaymentSettingsError(t("errors.unauthorized"))

  const role = await getCurrentRole({ headers: requestHeaders, userId: session.user.id })

  if (role !== "owner") throw new ExpectedPaymentSettingsError(t("errors.forbidden"))

  return {
    userId: session.user.id,
    role,
    ipAddress: getIpAddress(requestHeaders),
    userAgent: requestHeaders.get("user-agent")
  }
}

async function getPersistedPaymentSettings(): Promise<PersistedPaymentSettings | null> {
  return (
    (await database.query.settings.findFirst({
      columns: {
        id: true,
        paymentIban: true,
        paymentBankName: true,
        paymentInstructions: true,
        stripePublishableKey: true,
        stripeSecretKey: true,
        stripeWebhookSecret: true,
        stripeTestConnectionAt: true
      }
    })) ?? null
  )
}

function buildPaymentSettingsWritePlan(
  values: PaymentSettingsValues,
  existing: PersistedPaymentSettings | null
): PaymentSettingsWritePlan {
  const paymentBankName = emptyToNull(values.paymentBankName)
  const paymentInstructions = emptyToNull(values.paymentInstructions)
  const stripePublishableKey = emptyToNull(values.stripePublishableKey)
  const writeValues: Partial<typeof settings.$inferInsert> = {
    paymentBankName,
    paymentInstructions,
    stripePublishableKey
  }
  const changedFields = getChangedFields([
    ["paymentBankName", existing?.paymentBankName ?? null, paymentBankName],
    ["paymentInstructions", existing?.paymentInstructions ?? null, paymentInstructions],
    ["stripePublishableKey", existing?.stripePublishableKey ?? null, stripePublishableKey]
  ])
  const secretFieldsChanged: string[] = []
  const paymentIban = values.paymentIban ? normalizeIban(values.paymentIban) : null

  if (paymentIban && paymentIban !== existing?.paymentIban) {
    writeValues.paymentIban = paymentIban
    changedFields.push("paymentIban")
    secretFieldsChanged.push("paymentIban")
  }

  const stripeSecretKey = emptyToNull(values.stripeSecretKey)

  if (stripePublishableKey && !stripeSecretKey && !existing?.stripeSecretKey) {
    throw new ExpectedPaymentSettingsError(t("settings.payment.validation.stripeSecretKeyRequired"))
  }

  if (stripeSecretKey && stripeSecretKey !== existing?.stripeSecretKey) {
    writeValues.stripeSecretKey = stripeSecretKey
    changedFields.push("stripeSecretKey")
    secretFieldsChanged.push("stripeSecretKey")
  }

  const stripeWebhookSecret = emptyToNull(values.stripeWebhookSecret)

  if (stripeWebhookSecret && stripeWebhookSecret !== existing?.stripeWebhookSecret) {
    writeValues.stripeWebhookSecret = stripeWebhookSecret
    changedFields.push("stripeWebhookSecret")
    secretFieldsChanged.push("stripeWebhookSecret")
  }

  return {
    values: writeValues,
    changedFields: Array.from(new Set(changedFields)),
    secretFieldsChanged
  }
}

function getChangedFields(
  comparisons: Array<[field: string, previous: string | null, next: string | null]>
): string[] {
  return comparisons.flatMap(([field, previous, next]) => (previous !== next ? [field] : []))
}

async function upsertPaymentSettings(
  writePlan: PaymentSettingsWritePlan,
  existing: PersistedPaymentSettings | null
): Promise<PersistedPaymentSettings> {
  if (existing) {
    if (writePlan.changedFields.length === 0) return existing

    const [updatedSettings] = await database
      .update(settings)
      .set(writePlan.values)
      .where(eq(settings.id, existing.id))
      .returning(paymentSettingsReturnColumns)

    if (!updatedSettings) throw new Error("Payment settings update returned no row")

    return updatedSettings
  }

  const [createdSettings] = await database
    .insert(settings)
    .values(writePlan.values)
    .returning(paymentSettingsReturnColumns)

  if (!createdSettings) throw new Error("Payment settings insert returned no row")

  return createdSettings
}

async function writePaymentSettingsAudit(
  context: PaymentSettingsWriteContext,
  settingsId: string,
  writePlan: PaymentSettingsWritePlan
): Promise<void> {
  await writeAudit("settings.payment.updated", {
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

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}

function getStripeConnectionErrorMessage(code: StripeConnectionTestErrorCode): string {
  if (code === "auth") return t("settings.payment.errors.stripeAuthFailed")
  if (code === "connection") return t("settings.payment.errors.stripeConnectionFailed")
  if (code === "permission") return t("settings.payment.errors.stripePermissionFailed")
  if (code === "rate_limit") return t("settings.payment.errors.stripeRateLimited")
  if (code === "rejected") return t("settings.payment.errors.stripeRejected")
  if (code === "api") return t("settings.payment.errors.stripeApiFailed")

  return t("settings.payment.errors.stripeTestFailed")
}

function handlePaymentSettingsError(
  error: unknown,
  action: string,
  userId: string | null
): { error: string } {
  if (error instanceof ExpectedPaymentSettingsError) return { error: error.message }

  logger.error({ action, userId, err: error }, "Payment settings action failed")

  return { error: t("settings.payment.errors.updateFailed") }
}

class ExpectedPaymentSettingsError extends Error {}
