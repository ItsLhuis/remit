"use server"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { eq } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole, type Role } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress, parseAmountToCents } from "@/lib/utils"

import { database } from "@/database"
import { settings } from "@/database/schema"

import { toInvoicingSettingsFormData } from "./queries"
import { invoicingSettingsSchema, type InvoicingSettingsValues } from "./schemas"

type SaveInvoicingSettingsResult =
  | { data: { settings: InvoicingSettingsValues } }
  | { error: string }

type InvoicingSettingsWriteContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

type InvoicingSettingsWriteGate = { context: InvoicingSettingsWriteContext } | { error: string }

type PersistedInvoicingSettings = {
  id: string
  invoicePrefix: string
  numberPaddingWidth: number
  nextInvoiceNumber: number
  paymentTermsDays: number
  defaultNotesInvoice: string | null
  defaultInvoiceFooter: string | null
  defaultHourlyRateCents: number | null
  lateFeeEnabled: boolean
  lateFeeType: "percentage" | "fixed" | null
  lateFeePercentage: string | null
  lateFeeAmountCents: number | null
  lateFeeGraceDays: number
  lateFeeMaxCents: number | null
}

type InvoicingSettingsWritePlan = {
  values: Partial<typeof settings.$inferInsert>
  changedFields: string[]
}

const invoicingSettingsReturnColumns = {
  id: settings.id,
  invoicePrefix: settings.invoicePrefix,
  numberPaddingWidth: settings.numberPaddingWidth,
  nextInvoiceNumber: settings.nextInvoiceNumber,
  paymentTermsDays: settings.paymentTermsDays,
  defaultNotesInvoice: settings.defaultNotesInvoice,
  defaultInvoiceFooter: settings.defaultInvoiceFooter,
  defaultHourlyRateCents: settings.defaultHourlyRateCents,
  lateFeeEnabled: settings.lateFeeEnabled,
  lateFeeType: settings.lateFeeType,
  lateFeePercentage: settings.lateFeePercentage,
  lateFeeAmountCents: settings.lateFeeAmountCents,
  lateFeeGraceDays: settings.lateFeeGraceDays,
  lateFeeMaxCents: settings.lateFeeMaxCents
} as const

export async function saveInvoicingSettings(input: unknown): Promise<SaveInvoicingSettingsResult> {
  const gate = await requireInvoicingSettingsWrite()

  if ("error" in gate) return gate

  const parsed = invoicingSettingsSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await getPersistedInvoicingSettings()

    // The forward-only rule is checked twice on purpose, and this is the half that counts. The
    // schema's floor (`createInvoicingSettingsSchema`) is built from whatever the counter read at
    // page render, so it only turns a stale form into a field error; by the time the write lands an
    // invoice may have consumed a number since. Only this comparison sees the current row.
    if (existing && parsed.data.nextInvoiceNumber < existing.nextInvoiceNumber) {
      return {
        error: t("settings.invoicing.validation.nextInvoiceNumberForward", {
          number: existing.nextInvoiceNumber
        })
      }
    }

    const writePlan = buildInvoicingSettingsWritePlan(parsed.data, existing)
    const savedSettings = await upsertInvoicingSettings(writePlan, existing)

    if (writePlan.changedFields.length > 0) {
      await writeInvoicingSettingsAudit(context, savedSettings.id, writePlan)
    }

    revalidatePath("/settings/invoicing")

    return { data: { settings: toInvoicingSettingsFormData(savedSettings) } }
  } catch (error) {
    return handleInvoicingSettingsError(error, "saveInvoicingSettings", context.userId)
  }
}

async function requireInvoicingSettingsWrite(): Promise<InvoicingSettingsWriteGate> {
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

async function getPersistedInvoicingSettings(): Promise<PersistedInvoicingSettings | null> {
  return (
    (await database.query.settings.findFirst({
      columns: {
        id: true,
        invoicePrefix: true,
        numberPaddingWidth: true,
        nextInvoiceNumber: true,
        paymentTermsDays: true,
        defaultNotesInvoice: true,
        defaultInvoiceFooter: true,
        defaultHourlyRateCents: true,
        lateFeeEnabled: true,
        lateFeeType: true,
        lateFeePercentage: true,
        lateFeeAmountCents: true,
        lateFeeGraceDays: true,
        lateFeeMaxCents: true
      }
    })) ?? null
  )
}

function buildInvoicingSettingsWritePlan(
  values: InvoicingSettingsValues,
  existing: PersistedInvoicingSettings | null
): InvoicingSettingsWritePlan {
  const defaultNotesInvoice = emptyToNull(values.defaultNotesInvoice)
  const defaultInvoiceFooter = emptyToNull(values.defaultInvoiceFooter)
  const invoicePrefix = values.invoicePrefix.trim()
  const defaultHourlyRateCents = parseAmountToCents(values.defaultHourlyRate)
  const lateFee = toLateFeeColumns(values)
  const writeValues: Partial<typeof settings.$inferInsert> = {
    invoicePrefix,
    numberPaddingWidth: values.numberPaddingWidth,
    nextInvoiceNumber: values.nextInvoiceNumber,
    paymentTermsDays: values.paymentTermsDays,
    defaultNotesInvoice,
    defaultInvoiceFooter,
    defaultHourlyRateCents,
    ...lateFee
  }
  const changedFields = getChangedFields([
    ["invoicePrefix", existing?.invoicePrefix ?? null, invoicePrefix],
    ["numberPaddingWidth", existing?.numberPaddingWidth ?? null, values.numberPaddingWidth],
    ["nextInvoiceNumber", existing?.nextInvoiceNumber ?? null, values.nextInvoiceNumber],
    ["paymentTermsDays", existing?.paymentTermsDays ?? null, values.paymentTermsDays],
    ["defaultNotesInvoice", existing?.defaultNotesInvoice ?? null, defaultNotesInvoice],
    ["defaultInvoiceFooter", existing?.defaultInvoiceFooter ?? null, defaultInvoiceFooter],
    ["defaultHourlyRateCents", existing?.defaultHourlyRateCents ?? null, defaultHourlyRateCents],
    [
      "lateFeeEnabled",
      toComparable(existing?.lateFeeEnabled ?? null),
      toComparable(lateFee.lateFeeEnabled)
    ],
    ["lateFeeType", existing?.lateFeeType ?? null, lateFee.lateFeeType],
    [
      "lateFeePercentage",
      toComparablePercentage(existing?.lateFeePercentage ?? null),
      toComparablePercentage(lateFee.lateFeePercentage)
    ],
    ["lateFeeAmountCents", existing?.lateFeeAmountCents ?? null, lateFee.lateFeeAmountCents],
    ["lateFeeGraceDays", existing?.lateFeeGraceDays ?? null, lateFee.lateFeeGraceDays],
    ["lateFeeMaxCents", existing?.lateFeeMaxCents ?? null, lateFee.lateFeeMaxCents]
  ])

  return {
    values: writeValues,
    changedFields
  }
}

type LateFeeColumns = {
  lateFeeEnabled: boolean
  lateFeeType: "percentage" | "fixed" | null
  lateFeePercentage: string | null
  lateFeeAmountCents: number | null
  lateFeeGraceDays: number
  lateFeeMaxCents: number | null
}

// The type is written only when the amount beside it is filled, which is what
// `chk_settings_late_fee_shape` demands, and it survives the switch being turned off: an operator
// who disables the policy for a month should find their terms still there when they turn it back on.
function toLateFeeColumns(values: InvoicingSettingsValues): LateFeeColumns {
  const graceAndCap = {
    lateFeeEnabled: values.lateFeeEnabled,
    lateFeeGraceDays: values.lateFeeGraceDays,
    lateFeeMaxCents: parseAmountToCents(values.lateFeeMax)
  }

  if (values.lateFeeType === "percentage" && values.lateFeePercentage !== "") {
    return {
      ...graceAndCap,
      lateFeeType: "percentage",
      lateFeePercentage: values.lateFeePercentage,
      lateFeeAmountCents: null
    }
  }

  const lateFeeAmountCents = parseAmountToCents(values.lateFeeAmount)

  if (values.lateFeeType === "fixed" && lateFeeAmountCents !== null) {
    return { ...graceAndCap, lateFeeType: "fixed", lateFeePercentage: null, lateFeeAmountCents }
  }

  return { ...graceAndCap, lateFeeType: null, lateFeePercentage: null, lateFeeAmountCents: null }
}

// `getChangedFields` compares strings and numbers, and the two late-fee columns it cannot take
// directly are folded to that shape here rather than widening its signature for one caller.
function toComparable(value: boolean | null): string | null {
  return value === null ? null : String(value)
}

// `numeric` round-trips as a padded string, so "5" written and "5.00" read back are the same
// percentage and must not register as a change on every save.
function toComparablePercentage(value: string | null): number | null {
  return value === null ? null : Number(value)
}

function getChangedFields(
  comparisons: Array<
    [field: string, previous: string | number | null, next: string | number | null]
  >
): string[] {
  return comparisons.flatMap(([field, previous, next]) => (previous !== next ? [field] : []))
}

async function upsertInvoicingSettings(
  writePlan: InvoicingSettingsWritePlan,
  existing: PersistedInvoicingSettings | null
): Promise<PersistedInvoicingSettings> {
  if (existing) {
    if (writePlan.changedFields.length === 0) return existing

    const [updatedSettings] = await database
      .update(settings)
      .set(writePlan.values)
      .where(eq(settings.id, existing.id))
      .returning(invoicingSettingsReturnColumns)

    if (!updatedSettings) throw new Error("Invoicing settings update returned no row")

    return updatedSettings
  }

  const [createdSettings] = await database
    .insert(settings)
    .values(writePlan.values)
    .returning(invoicingSettingsReturnColumns)

  if (!createdSettings) throw new Error("Invoicing settings insert returned no row")

  return createdSettings
}

async function writeInvoicingSettingsAudit(
  context: InvoicingSettingsWriteContext,
  settingsId: string,
  writePlan: InvoicingSettingsWritePlan
): Promise<void> {
  await writeAudit("settings.invoicing.updated", {
    actorUserId: context.userId,
    actorRole: context.role,
    targetEntityType: "settings",
    targetEntityId: settingsId,
    metadata: {
      changedFields: writePlan.changedFields
    },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}

function handleInvoicingSettingsError(
  error: unknown,
  action: string,
  userId: string | null
): { error: string } {
  if (error instanceof ExpectedInvoicingSettingsError) return { error: error.message }

  logger.error({ action, userId, err: error }, "Invoicing settings action failed")

  return { error: t("settings.invoicing.errors.updateFailed") }
}

class ExpectedInvoicingSettingsError extends Error {}
