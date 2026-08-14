"use server"

import { revalidatePath } from "next/cache"

import { randomBytes } from "node:crypto"

import { and, eq, inArray, isNull, sql } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { enqueueJob } from "@/lib/jobs"

import { database } from "@/database"
import { clients, contracts, projects, settings, templates } from "@/database/schema"

import { getAcceptedProposalForContract } from "@/features/proposals/server"

import { blocksSchema, type Blocks } from "@/features/templates"

import {
  emitContractCreated,
  emitContractDeleted,
  emitContractSent,
  emitContractTerminated,
  emitContractUpdated
} from "./events"
import {
  handleContractActionError,
  requireContractDelete,
  requireContractSend,
  requireContractTerminate,
  requireContractWrite,
  writeContractAudit,
  ExpectedContractError
} from "./mutationContext"
import { getContractForEdit } from "./queries"
import {
  contractIdSchema,
  createContractFromProposalSchema,
  createContractSchema,
  terminateContractSchema,
  updateContractSchema,
  type UpdateContractValues
} from "./schemas"
import {
  buildContractBlocksFromProposal,
  canTransitionContractStatus,
  formatContractNumber,
  hasContractContent,
  isContractEditable
} from "./services"
import { type ContractFormData } from "./types"

export type ContractMutationResult = { data: { contract: ContractFormData } } | { error: string }

export type SendContractResult = { data: { id: string } } | { error: string }

export type TerminateContractResult = { data: { id: string } } | { error: string }

export type DeleteContractResult = { data: { id: string } } | { error: string }

type ContractParentIds = {
  projectId: string | null
  clientId: string | null
}

const AUDIT_FIELDS = [
  "title",
  "projectId",
  "clientId",
  "templateId",
  "effectiveFrom",
  "effectiveUntil",
  "blocks"
] as const

export async function createContract(input: unknown): Promise<ContractMutationResult> {
  const gate = await requireContractWrite()

  if ("error" in gate) return gate

  const parsed = createContractSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    await assertContractParentsExist(parsed.data)

    const contractId = await database.transaction(async (transaction) => {
      const number = await claimContractNumber(transaction)

      const [created] = await transaction
        .insert(contracts)
        .values({
          projectId: parsed.data.projectId,
          clientId: parsed.data.clientId,
          templateId: parsed.data.templateId,
          number,
          title: parsed.data.title,
          status: "draft",
          blocks: parsed.data.blocks,
          effectiveFrom: parsed.data.effectiveFrom,
          effectiveUntil: parsed.data.effectiveUntil,
          // Minted here rather than at send so `contracts.public_token` can stay NOT NULL and
          // uniquely indexed, and so a failed send can never consume a contract number. Nothing
          // reads the token back until `issuedAt` is set - the public signing route is what finally
          // resolves it.
          publicToken: randomBytes(32).toString("base64url")
        })
        .returning({ id: contracts.id })

      if (!created) throw new Error("Contract insert returned no row")

      return created.id
    })

    await writeContractAudit(context, "contract.created", contractId, {
      projectId: parsed.data.projectId,
      clientId: parsed.data.clientId,
      blockCount: parsed.data.blocks.length
    })
    await emitContractCreated({
      contractId,
      projectId: parsed.data.projectId,
      clientId: parsed.data.clientId,
      userId: context.userId
    })

    revalidateContractPaths({
      id: contractId,
      projectId: parsed.data.projectId,
      clientId: parsed.data.clientId
    })

    return await loadContractResult(contractId)
  } catch (error) {
    return handleContractActionError(error, {
      action: "createContract",
      userId: context.userId,
      fallbackMessage: t("contracts.errors.createFailed")
    })
  }
}

export async function createContractFromProposal(input: unknown): Promise<ContractMutationResult> {
  const gate = await requireContractWrite()

  if ("error" in gate) return gate

  const parsed = createContractFromProposalSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const proposal = await getAcceptedProposalForContract({ id: parsed.data.proposalId })

    if (!proposal)
      throw new ExpectedContractError(await getConversionRejection(parsed.data.proposalId))

    const template = await database.query.templates.findFirst({
      where: and(
        eq(templates.type, "contract"),
        eq(templates.isDefault, true),
        isNull(templates.deletedAt)
      ),
      columns: { id: true, blocks: true }
    })

    const templateBlocks = blocksSchema.safeParse(template?.blocks ?? [])
    const blocks = buildContractBlocksFromProposal({
      templateBlocks: templateBlocks.success ? templateBlocks.data : null,
      proposalBlocks: proposal.blocks
    })

    const contractId = await database.transaction(async (transaction) => {
      const number = await claimContractNumber(transaction)

      const [created] = await transaction
        .insert(contracts)
        .values({
          projectId: proposal.projectId,
          proposalId: proposal.id,
          templateId: template?.id ?? null,
          number,
          title: parsed.data.title,
          status: "draft",
          blocks,
          publicToken: randomBytes(32).toString("base64url")
        })
        .returning({ id: contracts.id })

      if (!created) throw new Error("Contract insert returned no row")

      return created.id
    })

    await writeContractAudit(context, "contract.created", contractId, {
      proposalId: proposal.id,
      projectId: proposal.projectId,
      blockCount: blocks.length
    })
    await emitContractCreated({
      contractId,
      projectId: proposal.projectId,
      clientId: null,
      userId: context.userId
    })

    revalidateContractPaths({ id: contractId, projectId: proposal.projectId, clientId: null })
    revalidatePath(`/projects/${proposal.projectId}/proposals/${proposal.id}`)

    return await loadContractResult(contractId)
  } catch (error) {
    return handleContractActionError(error, {
      action: "createContractFromProposal",
      userId: context.userId,
      fallbackMessage: toConversionErrorMessage(error)
    })
  }
}

export async function updateContract(input: unknown): Promise<ContractMutationResult> {
  const gate = await requireContractWrite()

  if ("error" in gate) return gate

  const parsed = updateContractSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await database.query.contracts.findFirst({
      where: and(eq(contracts.id, parsed.data.id), isNull(contracts.deletedAt))
    })

    if (!existing) throw new ExpectedContractError(t("contracts.errors.notFound"))

    if (!isContractEditable(existing.status)) {
      throw new ExpectedContractError(t("contracts.errors.notDraft"))
    }

    await assertContractParentsExist(parsed.data)

    // The status is re-checked in the WHERE rather than trusted from the read above: a concurrent
    // send between the two statements would otherwise let an issued contract be rewritten.
    const [updated] = await database
      .update(contracts)
      .set({
        title: parsed.data.title,
        projectId: parsed.data.projectId,
        clientId: parsed.data.clientId,
        templateId: parsed.data.templateId,
        blocks: parsed.data.blocks,
        effectiveFrom: parsed.data.effectiveFrom,
        effectiveUntil: parsed.data.effectiveUntil
      })
      .where(
        and(
          eq(contracts.id, parsed.data.id),
          eq(contracts.status, "draft"),
          isNull(contracts.deletedAt)
        )
      )
      .returning({ id: contracts.id })

    if (!updated) throw new ExpectedContractError(t("contracts.errors.notDraft"))

    const changedFields = getChangedContractFields(existing, parsed.data)

    await writeContractAudit(context, "contract.updated", existing.id, {
      projectId: parsed.data.projectId,
      clientId: parsed.data.clientId,
      changedFields
    })
    await emitContractUpdated({
      contractId: existing.id,
      userId: context.userId,
      changedFields
    })

    revalidateContractPaths({
      id: existing.id,
      projectId: parsed.data.projectId,
      clientId: parsed.data.clientId
    })

    return await loadContractResult(existing.id)
  } catch (error) {
    return handleContractActionError(error, {
      action: "updateContract",
      userId: context.userId,
      contractId: parsed.data.id
    })
  }
}

export async function sendContract(input: unknown): Promise<SendContractResult> {
  const gate = await requireContractSend()

  if ("error" in gate) return gate

  const parsed = contractIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await database.query.contracts.findFirst({
      where: and(eq(contracts.id, parsed.data.id), isNull(contracts.deletedAt))
    })

    if (!existing) throw new ExpectedContractError(t("contracts.errors.notFound"))

    const transition = canTransitionContractStatus(existing.status, "sent")

    if (!transition.allowed)
      throw new ExpectedContractError(t("contracts.errors.invalidTransition"))

    // Re-validated at the send boundary rather than trusted from the draft write: `blocks` is a
    // jsonb column, so a row written by any other path (a restore, a script) reaches here unchecked,
    // and an unparseable snapshot must not become an issued document.
    const snapshot = blocksSchema.safeParse(existing.blocks)

    if (!snapshot.success || !hasContractContent(snapshot.data)) {
      throw new ExpectedContractError(t("contracts.validation.blocksRequired"))
    }

    const issuedAt = new Date()

    const [sent] = await database
      .update(contracts)
      .set({ status: transition.nextStatus, issuedAt })
      .where(
        and(
          eq(contracts.id, parsed.data.id),
          eq(contracts.status, "draft"),
          isNull(contracts.deletedAt)
        )
      )
      .returning({
        id: contracts.id,
        projectId: contracts.projectId,
        clientId: contracts.clientId
      })

    if (!sent) throw new ExpectedContractError(t("contracts.errors.invalidTransition"))

    // Never records `publicToken`: the audit trail is readable by anyone with database access, and
    // the token is a bearer credential for the public signing route (`security.md`).
    await writeContractAudit(context, "contract.sent", sent.id, {
      projectId: sent.projectId,
      clientId: sent.clientId,
      issuedAt: issuedAt.toISOString(),
      blockCount: snapshot.data.length
    })
    await emitContractSent({ contractId: sent.id, userId: context.userId })
    // `email: true` chains the client's copy behind the render, so the mail always has a PDF to
    // attach (see the ordering note in `lib/jobs/types.ts`).
    await enqueueJob("contract.pdf.render", { contractId: sent.id, email: true })

    revalidateContractPaths(sent)

    return { data: { id: sent.id } }
  } catch (error) {
    return handleContractActionError(error, {
      action: "sendContract",
      userId: context.userId,
      contractId: parsed.data.id,
      fallbackMessage: t("contracts.errors.sendFailed")
    })
  }
}

export async function terminateContract(input: unknown): Promise<TerminateContractResult> {
  const gate = await requireContractTerminate()

  if ("error" in gate) return gate

  const parsed = terminateContractSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const existing = await database.query.contracts.findFirst({
      where: and(eq(contracts.id, parsed.data.id), isNull(contracts.deletedAt)),
      columns: { id: true, status: true }
    })

    if (!existing) throw new ExpectedContractError(t("contracts.errors.notFound"))

    const transition = canTransitionContractStatus(existing.status, "terminated")

    if (!transition.allowed)
      throw new ExpectedContractError(t("contracts.errors.invalidTransition"))

    const terminatedAt = new Date()

    // `chk_contracts_dates` is untouched: termination writes no effective_* value, so a contract
    // keeps the window it was issued with and the record shows when that window was cut short.
    const [terminated] = await database
      .update(contracts)
      .set({
        status: transition.nextStatus,
        terminatedAt,
        terminationReason: parsed.data.terminationReason
      })
      .where(
        and(
          eq(contracts.id, parsed.data.id),
          inArray(contracts.status, ["sent", "signed"]),
          isNull(contracts.deletedAt)
        )
      )
      .returning({
        id: contracts.id,
        projectId: contracts.projectId,
        clientId: contracts.clientId
      })

    if (!terminated) throw new ExpectedContractError(t("contracts.errors.invalidTransition"))

    // The reason is business content, not a secret, so it is recorded in full.
    await writeContractAudit(context, "contract.terminated", terminated.id, {
      previousStatus: existing.status,
      terminatedAt: terminatedAt.toISOString(),
      terminationReason: parsed.data.terminationReason
    })
    await emitContractTerminated({ contractId: terminated.id, userId: context.userId })

    revalidateContractPaths(terminated)

    return { data: { id: terminated.id } }
  } catch (error) {
    return handleContractActionError(error, {
      action: "terminateContract",
      userId: context.userId,
      contractId: parsed.data.id,
      fallbackMessage: t("contracts.errors.terminateFailed")
    })
  }
}

export async function softDeleteContract(input: unknown): Promise<DeleteContractResult> {
  const gate = await requireContractDelete()

  if ("error" in gate) return gate

  const parsed = contractIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const [deleted] = await database
      .update(contracts)
      .set({ deletedAt: new Date() })
      .where(and(eq(contracts.id, parsed.data.id), isNull(contracts.deletedAt)))
      .returning({
        id: contracts.id,
        projectId: contracts.projectId,
        clientId: contracts.clientId,
        status: contracts.status
      })

    if (!deleted) throw new ExpectedContractError(t("contracts.errors.notFound"))

    await writeContractAudit(context, "contract.deleted", deleted.id, {
      projectId: deleted.projectId,
      clientId: deleted.clientId,
      status: deleted.status,
      softDeleted: true
    })
    await emitContractDeleted({ contractId: deleted.id, userId: context.userId })

    revalidateContractPaths(deleted)

    return { data: { id: deleted.id } }
  } catch (error) {
    return handleContractActionError(error, {
      action: "softDeleteContract",
      userId: context.userId,
      contractId: parsed.data.id,
      fallbackMessage: t("contracts.errors.deleteFailed")
    })
  }
}

type Transaction = Parameters<Parameters<typeof database.transaction>[0]>[0]

// A single atomic increment rather than read-then-write: two concurrent creates that both read the
// same `next_contract_number` would mint the same number and one would fail the unique index on
// `contracts.number`. The returned value is the counter *after* the bump, so the number this call
// owns is one below it.
async function claimContractNumber(transaction: Transaction): Promise<string> {
  const [row] = await transaction
    .update(settings)
    .set({ nextContractNumber: sql`${settings.nextContractNumber} + 1` })
    .returning({
      nextNumber: settings.nextContractNumber,
      prefix: settings.contractPrefix,
      paddingWidth: settings.numberPaddingWidth
    })

  if (!row) throw new ExpectedContractError(t("contracts.errors.updateFailed"))

  return formatContractNumber({
    prefix: row.prefix,
    nextNumber: row.nextNumber - 1,
    paddingWidth: row.paddingWidth
  })
}

// `getAcceptedProposalForContract` collapses every non-convertible reason into null, and "already
// has a contract" is the one a user can act on, so it is told apart here rather than reported as a
// proposal that cannot be converted at all.
async function getConversionRejection(proposalId: string): Promise<string> {
  const existing = await database
    .select({ id: contracts.id })
    .from(contracts)
    .where(and(eq(contracts.proposalId, proposalId), isNull(contracts.deletedAt)))
    .limit(1)

  return existing.length > 0
    ? t("contracts.errors.proposalAlreadyConverted")
    : t("contracts.errors.proposalNotConvertible")
}

// The schema already guarantees at least one parent id is present; this checks the ids point at
// records that still exist, so a stale form never writes a contract whose parent link is dead on
// arrival. `chk_contracts_parent` remains the backstop, not the first line of defence.
async function assertContractParentsExist(values: ContractParentIds): Promise<void> {
  const [project, client] = await Promise.all([
    values.projectId
      ? database.query.projects.findFirst({
          where: and(eq(projects.id, values.projectId), isNull(projects.deletedAt)),
          columns: { id: true }
        })
      : Promise.resolve(undefined),
    values.clientId
      ? database.query.clients.findFirst({
          where: and(eq(clients.id, values.clientId), isNull(clients.deletedAt)),
          columns: { id: true }
        })
      : Promise.resolve(undefined)
  ])

  if (values.projectId && !project) {
    throw new ExpectedContractError(t("contracts.errors.parentNotFound"))
  }

  if (values.clientId && !client) {
    throw new ExpectedContractError(t("contracts.errors.parentNotFound"))
  }
}

async function loadContractResult(contractId: string): Promise<ContractMutationResult> {
  const contract = await getContractForEdit({ id: contractId })

  if (!contract) throw new ExpectedContractError(t("contracts.errors.notFound"))

  return { data: { contract } }
}

function getChangedContractFields(
  existing: typeof contracts.$inferSelect,
  next: UpdateContractValues
): string[] {
  const existingValues = {
    title: existing.title,
    projectId: existing.projectId,
    clientId: existing.clientId,
    templateId: existing.templateId,
    effectiveFrom: existing.effectiveFrom,
    effectiveUntil: existing.effectiveUntil,
    blocks: existing.blocks
  }

  const nextValues = {
    title: next.title,
    projectId: next.projectId,
    clientId: next.clientId,
    templateId: next.templateId,
    effectiveFrom: next.effectiveFrom,
    effectiveUntil: next.effectiveUntil,
    blocks: next.blocks
  }

  return AUDIT_FIELDS.filter((field) =>
    field === "blocks"
      ? !isSameBlocks(existingValues.blocks, nextValues.blocks)
      : !isSameValue(existingValues[field], nextValues[field])
  )
}

// Serialized comparison rather than a deep walk: the block tree is arbitrarily nested and the only
// question here is whether the audit entry should name `blocks` as changed, so an ordering-sensitive
// string compare is both sufficient and cheap. A reordered-but-equivalent tree is a real edit.
function isSameBlocks(existing: unknown, next: Blocks): boolean {
  return JSON.stringify(existing) === JSON.stringify(next)
}

function isSameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()

  if (a instanceof Date || b instanceof Date) return false

  return (a ?? null) === (b ?? null)
}

// A contract is reachable from the top-level list, its own detail route, and whichever parent
// records it names, so all of them go stale on a write. The parent paths are conditional because a
// contract has a project, a client, or one of each - never necessarily both.
function revalidateContractPaths(contract: { id: string } & ContractParentIds): void {
  revalidatePath("/contracts")
  revalidatePath(`/contracts/${contract.id}`)

  if (contract.projectId) revalidatePath(`/projects/${contract.projectId}`)
  if (contract.clientId) revalidatePath(`/clients/${contract.clientId}`)
}

// The partial unique index `contracts_proposal_id_unique_idx` is what actually serializes two
// concurrent conversions of one proposal; the loser surfaces here as a driver error rather than an
// ExpectedContractError, and its transaction has already rolled back, so no number was consumed.
function toConversionErrorMessage(error: unknown): string {
  const isUniqueViolation =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"

  return isUniqueViolation
    ? t("contracts.errors.proposalAlreadyConverted")
    : t("contracts.errors.createFailed")
}
