"use server"

import { revalidatePath } from "next/cache"

import { randomBytes } from "node:crypto"

import { and, eq, inArray, isNull, sql } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { enqueueJob } from "@/lib/jobs"

import { database } from "@/database"
import { clients, lineItems, projects, proposals, settings, taxRates } from "@/database/schema"

import {
  emitProposalCreated,
  emitProposalDeleted,
  emitProposalSent,
  emitProposalUpdated
} from "./events"
import {
  handleProposalActionError,
  requireProposalDelete,
  requireProposalSend,
  requireProposalWrite,
  writeProposalAudit,
  ExpectedProposalError
} from "./mutationContext"
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

type ProposalScope = {
  projectId: string | null
  clientId: string | null
}

const AUDIT_FIELDS = [
  "projectId",
  "clientId",
  "currency",
  "templateId",
  "validUntil",
  "notes",
  "discountKind"
] as const

export async function createProposal(input: unknown): Promise<ProposalMutationResult> {
  const gate = await requireProposalWrite()

  if ("error" in gate) return gate

  const parsed = createProposalSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const scope = await resolveProposalScope(parsed.data)

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
          projectId: scope.projectId,
          clientId: scope.clientId,
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
      projectId: scope.projectId,
      clientId: scope.clientId,
      totalCents: totals.totalCents,
      lineItemCount: parsed.data.lineItems.length
    })
    await emitProposalCreated({
      proposalId,
      projectId: scope.projectId,
      clientId: scope.clientId,
      userId: context.userId
    })

    revalidateProposalPaths(scope, proposalId)

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

    const scope = await resolveProposalScope(parsed.data)

    const taxPercentages = await getTaxPercentages(parsed.data)
    const totals = calculateProposalTotal(
      toLineItemInputs(parsed.data, taxPercentages),
      toDiscount(parsed.data)
    )

    await database.transaction(async (transaction) => {
      const [updated] = await transaction
        .update(proposals)
        .set({
          projectId: scope.projectId,
          clientId: scope.clientId,
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

    const changedFields = getChangedProposalFields(existing, parsed.data, scope)

    await writeProposalAudit(context, "proposal.updated", existing.id, {
      projectId: scope.projectId,
      clientId: scope.clientId,
      changedFields,
      totalCents: totals.totalCents
    })
    await emitProposalUpdated({
      proposalId: existing.id,
      projectId: scope.projectId,
      clientId: scope.clientId,
      userId: context.userId,
      changedFields
    })

    // Both the old and the new parent, because an edit may have moved the proposal between them and
    // the page it left has to stop listing it.
    revalidateProposalPaths(
      { projectId: existing.projectId, clientId: existing.clientId },
      existing.id
    )
    revalidateProposalPaths(scope, existing.id)

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
        // enforced from `status`, so no read path depends on it being set here.
        validUntil: existing.validUntil ?? calculateProposalValidUntil(issuedAt, validityDays)
      })
      .where(
        and(
          eq(proposals.id, parsed.data.id),
          eq(proposals.status, "draft"),
          isNull(proposals.deletedAt)
        )
      )
      .returning({
        id: proposals.id,
        projectId: proposals.projectId,
        clientId: proposals.clientId
      })

    if (!sent) throw new ExpectedProposalError(t("proposals.errors.invalidTransition"))

    // Never records `publicToken`: the audit trail is readable by anyone with database access, and
    // the token is a bearer credential for the public route (`security.md`).
    await writeProposalAudit(context, "proposal.sent", sent.id, {
      projectId: sent.projectId,
      clientId: sent.clientId,
      issuedAt: issuedAt.toISOString(),
      lineItemCount
    })
    await emitProposalSent({
      proposalId: sent.id,
      projectId: sent.projectId,
      clientId: sent.clientId,
      userId: context.userId
    })
    // `email: true` chains the client's copy behind the render, so the mail always has a PDF to
    // attach (see the ordering note in `lib/jobs/types.ts`).
    await enqueueJob("proposal.pdf.render", { proposalId: sent.id, email: true })

    revalidateProposalPaths(sent, sent.id)

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
      .returning({
        id: proposals.id,
        projectId: proposals.projectId,
        clientId: proposals.clientId,
        status: proposals.status
      })

    if (!deleted) throw new ExpectedProposalError(t("proposals.errors.notFound"))

    await writeProposalAudit(context, "proposal.deleted", deleted.id, {
      projectId: deleted.projectId,
      clientId: deleted.clientId,
      status: deleted.status,
      softDeleted: true
    })
    await emitProposalDeleted({
      proposalId: deleted.id,
      projectId: deleted.projectId,
      clientId: deleted.clientId,
      userId: context.userId
    })

    revalidateProposalPaths(deleted, deleted.id)

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

// A proposal hangs off a project or off a client, and when it names both the client has to be the
// project's own: `fk_proposals_project_client` refuses any other pairing, and a raw foreign-key
// error is not something a user may ever see. The project's client is copied onto the row rather
// than left to a join, for the reason `invoices.client_id` gives — the invoice outlives the project.
async function resolveProposalScope(values: ProposalWriteValues): Promise<ProposalScope> {
  const project = values.projectId
    ? await database.query.projects.findFirst({
        where: and(eq(projects.id, values.projectId), isNull(projects.deletedAt)),
        columns: { id: true, clientId: true }
      })
    : null

  if (values.projectId && !project) {
    throw new ExpectedProposalError(t("proposals.errors.projectNotFound"))
  }

  const client = values.clientId
    ? await database.query.clients.findFirst({
        where: and(eq(clients.id, values.clientId), isNull(clients.deletedAt)),
        columns: { id: true }
      })
    : null

  if (values.clientId && !client) {
    throw new ExpectedProposalError(t("proposals.errors.clientNotFound"))
  }

  if (project && client && project.clientId !== client.id) {
    throw new ExpectedProposalError(t("proposals.errors.clientProjectMismatch"))
  }

  return {
    projectId: project?.id ?? null,
    clientId: project?.clientId ?? client?.id ?? null
  }
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
  next: ProposalWriteValues,
  scope: ProposalScope
): string[] {
  const existingValues = {
    projectId: existing.projectId,
    clientId: existing.clientId,
    currency: existing.currency,
    templateId: existing.templateId,
    validUntil: existing.validUntil,
    notes: existing.notes,
    discountKind: existing.discountType ?? "none"
  }

  const nextValues = {
    projectId: scope.projectId,
    clientId: scope.clientId,
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

function revalidateProposalPaths(scope: ProposalScope, proposalId: string): void {
  revalidatePath(`/proposals/${proposalId}`)
  revalidatePath("/proposals")

  if (scope.projectId) {
    revalidatePath(`/projects/${scope.projectId}/proposals/${proposalId}`)
    revalidatePath(`/projects/${scope.projectId}/proposals`)
    revalidatePath(`/projects/${scope.projectId}`)
  }

  if (scope.clientId) revalidatePath(`/clients/${scope.clientId}`)
}
