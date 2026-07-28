"use server"

import { revalidatePath } from "next/cache"

import { headers } from "next/headers"

import { randomBytes } from "node:crypto"

import { and, eq, inArray, isNull, sql } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { auth } from "@/lib/auth"
import { getCurrentRole, type Role } from "@/lib/auth/session"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { getIpAddress } from "@/lib/utils"

import { enqueueJob } from "@/lib/jobs"

import { database } from "@/database"
import { lineItems, projects, proposals, settings, taxRates } from "@/database/schema"

import {
  emitProposalCreated,
  emitProposalDeleted,
  emitProposalSent,
  emitProposalUpdated
} from "./events"
import { getProposalForEdit } from "./queries"
import {
  createProposalSchema,
  proposalIdSchema,
  updateProposalSchema,
  type CreateProposalValues,
  type ProposalDiscountKind,
  type UpdateProposalValues
} from "./schemas"
import {
  calculateProposalLineTotals,
  calculateProposalTotal,
  calculateProposalValidUntil,
  canTransitionProposalStatus,
  formatProposalNumber,
  isProposalEditable,
  type ProposalDiscount,
  type ProposalLineItemInput
} from "./services"
import { type ProposalFormData } from "./types"

export type ProposalMutationResult = { data: { proposal: ProposalFormData } } | { error: string }

export type SendProposalResult = { data: { id: string } } | { error: string }

export type DeleteProposalResult = { data: { id: string } } | { error: string }

type ProposalWriteContext = {
  userId: string
  role: Role
  ipAddress: string | null
  userAgent: string | null
}

type ProposalWriteGate = { context: ProposalWriteContext } | { error: string }

type ProposalAuditEvent =
  | "proposal.created"
  | "proposal.updated"
  | "proposal.sent"
  | "proposal.deleted"

type ProposalDiscountColumns = {
  discountType: "percentage" | "fixed" | null
  discountPercentage: string | null
  discountAmountCents: number | null
}

type DiscountValues = {
  discountKind: ProposalDiscountKind
  discountPercentage: number | null
  discountAmount: number | null
}

type ProposalWriteValues = CreateProposalValues | UpdateProposalValues

const AUDIT_FIELDS = ["currency", "templateId", "validUntil", "notes", "discountKind"] as const

export async function createProposal(input: unknown): Promise<ProposalMutationResult> {
  const gate = await requireProposalWrite()

  if ("error" in gate) return gate

  const parsed = createProposalSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const project = await database.query.projects.findFirst({
      where: and(eq(projects.id, parsed.data.projectId), isNull(projects.deletedAt)),
      columns: { id: true }
    })

    if (!project) throw new ExpectedProposalError(t("proposals.errors.projectNotFound"))

    const taxPercentages = await getTaxPercentages(parsed.data)
    const totals = calculateProposalTotal(
      toLineItemInputs(parsed.data, taxPercentages),
      toDiscount(parsed.data)
    )

    const proposalId = await database.transaction(async (transaction) => {
      const number = await claimProposalNumber(transaction)

      const [created] = await transaction
        .insert(proposals)
        .values({
          projectId: project.id,
          templateId: parsed.data.templateId,
          number,
          status: "draft",
          currency: parsed.data.currency,
          ...toDiscountColumns(parsed.data),
          subtotalCents: totals.subtotalCents,
          discountAmountTotalCents: totals.discountAmountTotalCents,
          taxAmountCents: totals.taxAmountCents,
          totalCents: totals.totalCents,
          validUntil: parsed.data.validUntil,
          notes: emptyToNull(parsed.data.notes),
          // Minted here rather than at send so `proposals.public_token` can stay NOT NULL and
          // uniquely indexed. Nothing reads it back until `issuedAt` is set — see the read model in
          // queries.ts, which withholds the client path for an unissued proposal.
          publicToken: randomBytes(32).toString("base64url")
        })
        .returning({ id: proposals.id })

      if (!created) throw new Error("Proposal insert returned no row")

      await writeProposalLineItems(transaction, created.id, parsed.data, taxPercentages)

      return created.id
    })

    await writeProposalAudit(context, "proposal.created", proposalId, {
      projectId: project.id,
      totalCents: totals.totalCents,
      lineItemCount: parsed.data.lineItems.length
    })
    await emitProposalCreated({ proposalId, projectId: project.id, userId: context.userId })

    revalidateProposalPaths(project.id, proposalId)

    return await loadProposalResult(proposalId)
  } catch (error) {
    return handleProposalActionError(error, { action: "createProposal", userId: context.userId })
  }
}

export async function updateProposal(input: unknown): Promise<ProposalMutationResult> {
  const gate = await requireProposalWrite()

  if ("error" in gate) return gate

  const parsed = updateProposalSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await database.query.proposals.findFirst({
      where: and(eq(proposals.id, parsed.data.id), isNull(proposals.deletedAt))
    })

    if (!existing) throw new ExpectedProposalError(t("proposals.errors.notFound"))

    if (!isProposalEditable(existing.status)) {
      throw new ExpectedProposalError(t("proposals.errors.notDraft"))
    }

    const taxPercentages = await getTaxPercentages(parsed.data)
    const totals = calculateProposalTotal(
      toLineItemInputs(parsed.data, taxPercentages),
      toDiscount(parsed.data)
    )

    await database.transaction(async (transaction) => {
      const [updated] = await transaction
        .update(proposals)
        .set({
          templateId: parsed.data.templateId,
          currency: parsed.data.currency,
          ...toDiscountColumns(parsed.data),
          subtotalCents: totals.subtotalCents,
          discountAmountTotalCents: totals.discountAmountTotalCents,
          taxAmountCents: totals.taxAmountCents,
          totalCents: totals.totalCents,
          validUntil: parsed.data.validUntil,
          notes: emptyToNull(parsed.data.notes)
        })
        .where(
          and(
            eq(proposals.id, parsed.data.id),
            eq(proposals.status, "draft"),
            isNull(proposals.deletedAt)
          )
        )
        .returning({ id: proposals.id })

      if (!updated) throw new ExpectedProposalError(t("proposals.errors.notDraft"))

      // Hard delete rather than soft: `uq_line_items_proposal_position` does not exclude
      // soft-deleted rows, so a retained row would collide with the replacement at the same
      // position. A draft has never been shown to a client, so there is no history to preserve.
      await transaction.delete(lineItems).where(eq(lineItems.proposalId, parsed.data.id))

      await writeProposalLineItems(transaction, parsed.data.id, parsed.data, taxPercentages)
    })

    const changedFields = getChangedProposalFields(existing, parsed.data)

    await writeProposalAudit(context, "proposal.updated", existing.id, {
      projectId: existing.projectId,
      changedFields,
      totalCents: totals.totalCents
    })
    await emitProposalUpdated({
      proposalId: existing.id,
      projectId: existing.projectId,
      userId: context.userId,
      changedFields
    })

    revalidateProposalPaths(existing.projectId, existing.id)

    return await loadProposalResult(existing.id)
  } catch (error) {
    return handleProposalActionError(error, {
      action: "updateProposal",
      userId: context.userId,
      proposalId: parsed.data.id
    })
  }
}

export async function sendProposal(input: unknown): Promise<SendProposalResult> {
  const gate = await requireProposalSend()

  if ("error" in gate) return gate

  const parsed = proposalIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await database.query.proposals.findFirst({
      where: and(eq(proposals.id, parsed.data.id), isNull(proposals.deletedAt))
    })

    if (!existing) throw new ExpectedProposalError(t("proposals.errors.notFound"))

    const transition = canTransitionProposalStatus(existing.status, "sent")

    if (!transition.allowed)
      throw new ExpectedProposalError(t("proposals.errors.invalidTransition"))

    const lineItemCount = await countProposalLineItems(existing.id)

    if (lineItemCount === 0) {
      throw new ExpectedProposalError(t("proposals.validation.lineItemsRequired"))
    }

    const issuedAt = new Date()
    const validityDays = (await getProposalValidityDays()) ?? 0

    const [sent] = await database
      .update(proposals)
      .set({
        status: transition.nextStatus,
        issuedAt,
        // `lockedAt` stays null here on purpose: SCHEMA.md defines it as the moment an *accepted*
        // proposal became immutable, which the public acceptance route owns. Draft-only editing is
        // enforced from `status`, so nothing in this stage depends on it.
        validUntil: existing.validUntil ?? calculateProposalValidUntil(issuedAt, validityDays)
      })
      .where(
        and(
          eq(proposals.id, parsed.data.id),
          eq(proposals.status, "draft"),
          isNull(proposals.deletedAt)
        )
      )
      .returning({ id: proposals.id, projectId: proposals.projectId })

    if (!sent) throw new ExpectedProposalError(t("proposals.errors.invalidTransition"))

    // Never records `publicToken`: the audit trail is readable by anyone with database access, and
    // the token is a bearer credential for the public route (`security.md`).
    await writeProposalAudit(context, "proposal.sent", sent.id, {
      projectId: sent.projectId,
      issuedAt: issuedAt.toISOString(),
      lineItemCount
    })
    await emitProposalSent({
      proposalId: sent.id,
      projectId: sent.projectId,
      userId: context.userId
    })
    await enqueueJob("proposal.pdf.render", { proposalId: sent.id })

    revalidateProposalPaths(sent.projectId, sent.id)

    return { data: { id: sent.id } }
  } catch (error) {
    return handleProposalActionError(error, {
      action: "sendProposal",
      userId: context.userId,
      proposalId: parsed.data.id,
      fallbackMessage: t("proposals.errors.sendFailed")
    })
  }
}

export async function softDeleteProposal(input: unknown): Promise<DeleteProposalResult> {
  const gate = await requireProposalDelete()

  if ("error" in gate) return gate

  const parsed = proposalIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const [deleted] = await database
      .update(proposals)
      .set({ deletedAt: new Date() })
      .where(and(eq(proposals.id, parsed.data.id), isNull(proposals.deletedAt)))
      .returning({ id: proposals.id, projectId: proposals.projectId, status: proposals.status })

    if (!deleted) throw new ExpectedProposalError(t("proposals.errors.notFound"))

    await writeProposalAudit(context, "proposal.deleted", deleted.id, {
      projectId: deleted.projectId,
      status: deleted.status,
      softDeleted: true
    })
    await emitProposalDeleted({
      proposalId: deleted.id,
      projectId: deleted.projectId,
      userId: context.userId
    })

    revalidateProposalPaths(deleted.projectId, deleted.id)

    return { data: { id: deleted.id } }
  } catch (error) {
    return handleProposalActionError(error, {
      action: "softDeleteProposal",
      userId: context.userId,
      proposalId: parsed.data.id
    })
  }
}

type Transaction = Parameters<Parameters<typeof database.transaction>[0]>[0]

// A single atomic increment rather than read-then-write: two concurrent creates that both read the
// same `next_proposal_number` would mint the same number and one would fail the unique index on
// `proposals.number`. The returned value is the counter *after* the bump, so the number this call
// owns is one below it.
async function claimProposalNumber(transaction: Transaction): Promise<string> {
  const [row] = await transaction
    .update(settings)
    .set({ nextProposalNumber: sql`${settings.nextProposalNumber} + 1` })
    .returning({
      nextNumber: settings.nextProposalNumber,
      prefix: settings.proposalPrefix,
      paddingWidth: settings.numberPaddingWidth
    })

  if (!row) throw new ExpectedProposalError(t("proposals.errors.updateFailed"))

  return formatProposalNumber({
    prefix: row.prefix,
    nextNumber: row.nextNumber - 1,
    paddingWidth: row.paddingWidth
  })
}

async function writeProposalLineItems(
  transaction: Transaction,
  proposalId: string,
  values: ProposalWriteValues,
  taxPercentages: Map<string, number>
): Promise<void> {
  const lineTotals = calculateProposalLineTotals(
    toLineItemInputs(values, taxPercentages),
    toDiscount(values)
  )

  await transaction.insert(lineItems).values(
    values.lineItems.map((item, index) => ({
      proposalId,
      taxRateId: item.taxRateId,
      position: index,
      description: item.description,
      unit: emptyToNull(item.unit),
      quantity: String(item.quantity),
      unitPriceCents: item.unitPrice,
      ...toDiscountColumns(item),
      // The percentage is copied onto the line, never joined at read time: editing the `tax_rates`
      // row later must not move the totals of a proposal the client has already seen (ADR-0017).
      taxPercentageSnapshot: String(getTaxPercentage(item.taxRateId, taxPercentages)),
      subtotalCents: lineTotals[index]?.subtotalCents ?? 0,
      taxAmountCents: lineTotals[index]?.taxAmountCents ?? 0,
      totalCents: lineTotals[index]?.totalCents ?? 0
    }))
  )
}

async function getTaxPercentages(values: ProposalWriteValues): Promise<Map<string, number>> {
  const ids = [
    ...new Set(
      values.lineItems
        .map((item) => item.taxRateId)
        .filter((id): id is string => typeof id === "string")
    )
  ]

  if (ids.length === 0) return new Map()

  const rows = await database
    .select({ id: taxRates.id, percentage: taxRates.percentage })
    .from(taxRates)
    .where(and(inArray(taxRates.id, ids), isNull(taxRates.deletedAt)))

  if (rows.length !== ids.length) {
    throw new ExpectedProposalError(t("proposals.validation.taxRateInvalid"))
  }

  return new Map(rows.map((row) => [row.id, Number(row.percentage)]))
}

async function getProposalValidityDays(): Promise<number | null> {
  const row = await database.query.settings.findFirst({
    columns: { proposalValidityDays: true }
  })

  return row?.proposalValidityDays ?? null
}

async function countProposalLineItems(proposalId: string): Promise<number> {
  const rows = await database
    .select({ id: lineItems.id })
    .from(lineItems)
    .where(and(eq(lineItems.proposalId, proposalId), isNull(lineItems.deletedAt)))

  return rows.length
}

async function loadProposalResult(proposalId: string): Promise<ProposalMutationResult> {
  const proposal = await getProposalForEdit({ id: proposalId })

  if (!proposal) throw new ExpectedProposalError(t("proposals.errors.notFound"))

  return { data: { proposal } }
}

// Three named gates over one implementation: an assistant may draft and revise a proposal, but
// issuing it to a client and destroying it are owner-only. The names are what `doctor.config.ts`
// registers as server auth functions, so each call site stays greppable to its privilege level.
function requireProposalWrite(): Promise<ProposalWriteGate> {
  return requireProposalRole(["owner", "assistant"])
}

function requireProposalSend(): Promise<ProposalWriteGate> {
  return requireProposalRole(["owner"])
}

function requireProposalDelete(): Promise<ProposalWriteGate> {
  return requireProposalRole(["owner"])
}

async function requireProposalRole(allowed: Role[]): Promise<ProposalWriteGate> {
  const gate = await getProposalActionContext()

  if ("error" in gate) return gate

  if (!allowed.includes(gate.context.role)) return { error: t("errors.forbidden") }

  return gate
}

async function getProposalActionContext(): Promise<ProposalWriteGate> {
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

async function writeProposalAudit(
  context: ProposalWriteContext,
  event: ProposalAuditEvent,
  proposalId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await writeAudit(event, {
    actorUserId: context.userId,
    actorRole: context.role,
    targetEntityType: "proposal",
    targetEntityId: proposalId,
    metadata,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
}

function toLineItemInputs(
  values: ProposalWriteValues,
  taxPercentages: Map<string, number>
): ProposalLineItemInput[] {
  return values.lineItems.map((item) => ({
    quantity: item.quantity,
    unitPriceCents: item.unitPrice,
    discount: toDiscount(item),
    taxPercentage: getTaxPercentage(item.taxRateId, taxPercentages)
  }))
}

function toDiscount(values: DiscountValues): ProposalDiscount | null {
  if (values.discountKind === "percentage" && values.discountPercentage !== null) {
    return { type: "percentage", percentage: values.discountPercentage }
  }

  if (values.discountKind === "fixed" && values.discountAmount !== null) {
    return { type: "fixed", amountCents: values.discountAmount }
  }

  return null
}

function toDiscountColumns(values: DiscountValues): ProposalDiscountColumns {
  const discount = toDiscount(values)

  if (!discount) return { discountType: null, discountPercentage: null, discountAmountCents: null }

  if (discount.type === "percentage") {
    return {
      discountType: "percentage",
      discountPercentage: String(discount.percentage),
      discountAmountCents: null
    }
  }

  return {
    discountType: "fixed",
    discountPercentage: null,
    discountAmountCents: discount.amountCents
  }
}

function getTaxPercentage(taxRateId: string | null, taxPercentages: Map<string, number>): number {
  return taxRateId === null ? 0 : (taxPercentages.get(taxRateId) ?? 0)
}

function getChangedProposalFields(
  existing: typeof proposals.$inferSelect,
  next: ProposalWriteValues
): string[] {
  const existingValues = {
    currency: existing.currency,
    templateId: existing.templateId,
    validUntil: existing.validUntil,
    notes: existing.notes,
    discountKind: existing.discountType ?? "none"
  }

  const nextValues = {
    currency: next.currency,
    templateId: next.templateId,
    validUntil: next.validUntil,
    notes: emptyToNull(next.notes),
    discountKind: next.discountKind
  }

  return AUDIT_FIELDS.filter((field) => !isSameValue(existingValues[field], nextValues[field]))
}

function isSameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()

  if (a instanceof Date || b instanceof Date) return false

  return (a ?? null) === (b ?? null)
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}

function revalidateProposalPaths(projectId: string, proposalId: string): void {
  revalidatePath(`/projects/${projectId}/proposals/${proposalId}`)
  revalidatePath(`/projects/${projectId}/proposals`)
  revalidatePath(`/projects/${projectId}`)
}

type ProposalActionErrorContext = {
  action: string
  userId: string | null
  proposalId?: string
  fallbackMessage?: string
}

function handleProposalActionError(
  error: unknown,
  { action, userId, proposalId, fallbackMessage }: ProposalActionErrorContext
): { error: string } {
  if (error instanceof ExpectedProposalError) return { error: error.message }

  logger.error({ action, userId, proposalId, err: error }, "Proposal action failed")

  return { error: fallbackMessage ?? t("proposals.errors.updateFailed") }
}

function isRole(value: string | null | undefined): value is Role {
  return value === "owner" || value === "accountant" || value === "assistant"
}

class ExpectedProposalError extends Error {}
