"use server"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { and, eq, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole, type Role } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

import { database } from "@/database"
import { taxRates } from "@/database/schema"

import { toTaxRateListItem } from "./queries"
import {
  createTaxRateSchema,
  taxRateIdSchema,
  type TaxRateListItem,
  updateTaxRateSchema
} from "./schemas"

type TaxRateWriteResult = { data: { taxRate: TaxRateListItem } } | { error: string }

type DeleteTaxRateResult = { data: { id: string } } | { error: string }

type TaxRatesWriteContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

type TaxRatesWriteGate = { context: TaxRatesWriteContext } | { error: string }

type TaxRateAuditEvent =
  | "settings.taxRates.created"
  | "settings.taxRates.updated"
  | "settings.taxRates.defaultChanged"
  | "settings.taxRates.deleted"

const taxRatesPath = "/settings/tax-rates"

const taxRateReturnColumns = {
  id: taxRates.id,
  name: taxRates.name,
  percentage: taxRates.percentage,
  isDefault: taxRates.isDefault
} as const

export async function createTaxRate(input: unknown): Promise<TaxRateWriteResult> {
  const gate = await requireTaxRatesWrite()

  if ("error" in gate) return gate

  const parsed = createTaxRateSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const [createdTaxRate] = await database
      .insert(taxRates)
      .values({
        name: parsed.data.name,
        percentage: toTaxRatePercentageValue(parsed.data.percentage)
      })
      .returning(taxRateReturnColumns)

    if (!createdTaxRate) throw new Error("Tax rate insert returned no row")

    await writeTaxRateAudit(context, "settings.taxRates.created", createdTaxRate.id, {
      changedFields: ["name", "percentage"]
    })

    revalidatePath(taxRatesPath)

    return { data: { taxRate: toTaxRateListItem(createdTaxRate) } }
  } catch (error) {
    return handleTaxRateActionError(error, "createTaxRate", context.userId)
  }
}

export async function updateTaxRate(input: unknown): Promise<TaxRateWriteResult> {
  const gate = await requireTaxRatesWrite()

  if ("error" in gate) return gate

  const parsed = updateTaxRateSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const [updatedTaxRate] = await database
      .update(taxRates)
      .set({
        name: parsed.data.name,
        percentage: toTaxRatePercentageValue(parsed.data.percentage)
      })
      .where(and(eq(taxRates.id, parsed.data.id), isNull(taxRates.deletedAt)))
      .returning(taxRateReturnColumns)

    if (!updatedTaxRate) throw new ExpectedTaxRateError(t("settings.taxRates.errors.notFound"))

    await writeTaxRateAudit(context, "settings.taxRates.updated", updatedTaxRate.id, {
      changedFields: ["name", "percentage"]
    })

    revalidatePath(taxRatesPath)

    return { data: { taxRate: toTaxRateListItem(updatedTaxRate) } }
  } catch (error) {
    return handleTaxRateActionError(error, "updateTaxRate", context.userId)
  }
}

export async function setDefaultTaxRate(input: unknown): Promise<TaxRateWriteResult> {
  const gate = await requireTaxRatesWrite()

  if ("error" in gate) return gate

  const parsed = taxRateIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    // Clearing first is required, not tidiness: `uq_tax_rates_default` is a partial unique index
    // over `is_default = true AND deleted_at IS NULL`, so promoting a second rate before demoting
    // the incumbent violates it. The transaction is what keeps the momentary no-default state from
    // ever being observable, and what puts both statements behind one rollback if the id turns out
    // not to exist.
    const defaultTaxRate = await database.transaction(async (transaction) => {
      await transaction
        .update(taxRates)
        .set({ isDefault: false })
        .where(and(eq(taxRates.isDefault, true), isNull(taxRates.deletedAt)))

      const [updatedTaxRate] = await transaction
        .update(taxRates)
        .set({ isDefault: true })
        .where(and(eq(taxRates.id, parsed.data.id), isNull(taxRates.deletedAt)))
        .returning(taxRateReturnColumns)

      if (!updatedTaxRate) throw new ExpectedTaxRateError(t("settings.taxRates.errors.notFound"))

      return updatedTaxRate
    })

    await writeTaxRateAudit(context, "settings.taxRates.defaultChanged", defaultTaxRate.id, {
      changedFields: ["isDefault"]
    })

    revalidatePath(taxRatesPath)

    return { data: { taxRate: toTaxRateListItem(defaultTaxRate) } }
  } catch (error) {
    return handleTaxRateActionError(error, "setDefaultTaxRate", context.userId)
  }
}

export async function deleteTaxRate(input: unknown): Promise<DeleteTaxRateResult> {
  const gate = await requireTaxRatesWrite()

  if ("error" in gate) return gate

  const parsed = taxRateIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const [deletedTaxRate] = await database
      .update(taxRates)
      .set({ deletedAt: new Date(), isDefault: false })
      .where(and(eq(taxRates.id, parsed.data.id), isNull(taxRates.deletedAt)))
      .returning({ id: taxRates.id })

    if (!deletedTaxRate) throw new ExpectedTaxRateError(t("settings.taxRates.errors.notFound"))

    await writeTaxRateAudit(context, "settings.taxRates.deleted", deletedTaxRate.id, {
      changedFields: ["deletedAt", "isDefault"]
    })

    revalidatePath(taxRatesPath)

    return { data: { id: deletedTaxRate.id } }
  } catch (error) {
    return handleTaxRateActionError(error, "deleteTaxRate", context.userId)
  }
}

async function requireTaxRatesWrite(): Promise<TaxRatesWriteGate> {
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

async function writeTaxRateAudit(
  context: TaxRatesWriteContext,
  event: TaxRateAuditEvent,
  taxRateId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await writeAudit(event, {
    actorUserId: context.userId,
    actorRole: context.role,
    targetEntityType: "tax_rate",
    targetEntityId: taxRateId,
    metadata,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
}

function toTaxRatePercentageValue(percentage: number): string {
  return percentage.toFixed(2)
}

function handleTaxRateActionError(
  error: unknown,
  action: string,
  userId: string | null
): { error: string } {
  if (error instanceof ExpectedTaxRateError) return { error: error.message }

  if (isTaxRateDefaultConstraintError(error)) {
    return { error: t("settings.taxRates.errors.defaultConflict") }
  }

  logger.error({ action, userId, err: error }, "Tax rate action failed")

  return { error: t("settings.taxRates.errors.updateFailed") }
}

function isTaxRateDefaultConstraintError(error: unknown): boolean {
  const databaseError = getDatabaseError(error)
  const constraintName =
    getErrorStringProperty(databaseError, "constraint_name") ??
    getErrorStringProperty(databaseError, "constraint")

  return (
    getErrorStringProperty(databaseError, "code") === "23505" &&
    constraintName === "uq_tax_rates_default"
  )
}

function getDatabaseError(error: unknown): unknown {
  if (typeof error !== "object" || error === null || !("cause" in error)) return error

  return error.cause
}

function getErrorStringProperty(error: unknown, property: string): string | null {
  if (typeof error !== "object" || error === null) return null

  const value = (error as Record<string, unknown>)[property]

  return typeof value === "string" ? value : null
}

class ExpectedTaxRateError extends Error {}
