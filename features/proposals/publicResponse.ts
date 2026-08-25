import { revalidatePath } from "next/cache"

import { randomInt } from "node:crypto"

import { compare, hash } from "bcryptjs"

import { and, desc, eq, isNull } from "drizzle-orm"

import { t } from "@/lib/i18n/server"

import { writeAudit } from "@/lib/audit"

import { logger } from "@/lib/logger"

import { database } from "@/database"
import { emailLogs, proposalOtps, proposals } from "@/database/schema"

import { sendTransactionalEmail } from "@/features/email/server"

import { emitProposalAccepted, emitProposalRejected } from "./events"
import { getProposalResponseTarget } from "./publicQueries"
import {
  proposalOtpRequestSchema,
  proposalOtpVerifySchema,
  type ProposalAction,
  type ProposalStatus
} from "./schemas"
import {
  canTransitionProposalStatus,
  evaluateProposalOtp,
  getProposalOtpExpiry,
  hasExhaustedProposalOtpAttempts,
  matchesProposalRecipient,
  matchProposalRespondent,
  PROPOSAL_OTP_LENGTH,
  PROPOSAL_OTP_TTL_MINUTES,
  type ProposalOtpRejection,
  type ProposalRespondent
} from "./services"
import { type ProposalResponseTarget } from "./types"

// The anonymous write path behind `/p/[token]`, deliberately NOT a `"use server"` module. Server
// actions are callable by id from any client, which would let a caller reach these writes without
// passing through the rate limits declared in the two `otp/*/route.ts` handlers. Plain server-only
// functions can only be reached through those routes. Exported via `server.ts`.

export type PublicRequestContext = {
  token: string
  ipAddress: string | null
  userAgent: string | null
}

export type ProposalOtpRequestResult = { data: { expiresInMinutes: number } } | { error: string }

export type ProposalResponseResult = { data: { status: ProposalStatus } } | { error: string }

type ProposalOtpRow = typeof proposalOtps.$inferSelect

type ProposalResponseAuditEvent =
  | "proposal.otp.requested"
  | "proposal.accepted"
  | "proposal.rejected"

const BCRYPT_COST = 10

// `chk_proposals_response` requires a non-null `responded_ip` on every accepted or rejected
// proposal. `getIpAddress` yields null when no proxy header is present, so the absence is recorded
// explicitly rather than failing a client's response over a deployment detail.
const UNKNOWN_IP = "unknown"

export async function requestProposalOtp(
  input: unknown,
  context: PublicRequestContext
): Promise<ProposalOtpRequestResult> {
  const parsed = proposalOtpRequestSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const target = await getProposalResponseTarget(context.token)

  if (!target) return { error: t("proposals.public.errors.unavailable") }

  const transition = canTransitionProposalStatus(target.status, toNextStatus(parsed.data.action))

  if (!transition.allowed) return { error: t("proposals.public.errors.alreadyResponded") }

  // A non-matching address gets the identical success payload and no email. Returning an error
  // instead would turn the endpoint into an oracle for "who is this proposal addressed to", and
  // sending to the submitted address would turn it into an open relay for anyone holding the link.
  // The set matched against is this client's own address and its live contacts, and nothing else:
  // a contact of another client, or one that has been soft-deleted, is not an identity here.
  const respondent = matchProposalRespondent(parsed.data.email, target.respondents)

  if (!respondent) {
    await writeProposalResponseAudit("proposal.otp.requested", target, context, {
      action: parsed.data.action,
      delivered: false,
      reason: "recipient_mismatch"
    })

    return { data: { expiresInMinutes: PROPOSAL_OTP_TTL_MINUTES } }
  }

  const issuedAt = new Date()
  const code = generateOtpCode()
  const codeHash = await hash(code, BCRYPT_COST)

  let otpId: string

  try {
    otpId = await issueProposalOtp({
      target,
      respondent,
      action: parsed.data.action,
      codeHash,
      issuedAt
    })
  } catch (error) {
    logger.error(
      { action: "requestProposalOtp", proposalId: target.id, err: error },
      "Proposal OTP issue failed"
    )

    return { error: t("proposals.public.errors.requestFailed") }
  }

  const delivery = await deliverProposalOtp(target, respondent, parsed.data.action, code)

  if ("error" in delivery) {
    await invalidateProposalOtp(otpId, new Date())

    return delivery
  }

  await writeProposalResponseAudit("proposal.otp.requested", target, context, {
    action: parsed.data.action,
    delivered: true
  })

  return { data: { expiresInMinutes: PROPOSAL_OTP_TTL_MINUTES } }
}

export async function verifyProposalOtp(
  input: unknown,
  context: PublicRequestContext
): Promise<ProposalResponseResult> {
  const parsed = proposalOtpVerifySchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const target = await getProposalResponseTarget(context.token)

  if (!target) return { error: t("proposals.public.errors.unavailable") }

  const transition = canTransitionProposalStatus(target.status, toNextStatus(parsed.data.action))

  if (!transition.allowed) return { error: t("proposals.public.errors.alreadyResponded") }

  const otp = await findLatestProposalOtp(target.id, parsed.data.action)

  if (!otp || !matchesProposalRecipient(parsed.data.email, otp.email)) {
    return { error: t("proposals.public.errors.codeInvalid") }
  }

  const usability = evaluateProposalOtp(otp, new Date())

  if (!usability.usable) return { error: toOtpRejectionMessage(usability.reason) }

  const codeMatches = await compare(parsed.data.code, otp.codeHash)

  if (!codeMatches) return await countFailedProposalOtpAttempt(otp)

  const respondedAt = new Date()

  try {
    await recordProposalResponse({
      target,
      otpId: otp.id,
      action: parsed.data.action,
      nextStatus: transition.nextStatus,
      rejectionReason: parsed.data.rejectionReason,
      respondedAt,
      respondedIp: context.ipAddress ?? UNKNOWN_IP
    })
  } catch (error) {
    if (error instanceof ExpectedResponseError) return { error: error.message }

    logger.error(
      { action: "verifyProposalOtp", proposalId: target.id, err: error },
      "Proposal response write failed"
    )

    return { error: t("proposals.public.errors.responseFailed") }
  }

  await writeProposalResponseAudit(
    parsed.data.action === "accept" ? "proposal.accepted" : "proposal.rejected",
    target,
    context,
    {
      action: parsed.data.action,
      respondentEmail: otp.email,
      otpId: otp.id,
      respondedAt: respondedAt.toISOString()
    }
  )

  if (parsed.data.action === "accept") {
    await emitProposalAccepted({ proposalId: target.id, projectId: target.projectId })
  } else {
    await emitProposalRejected({ proposalId: target.id, projectId: target.projectId })
  }

  revalidateProposalResponsePaths(target.projectId, target.id)

  return { data: { status: transition.nextStatus } }
}

type RecordProposalResponseInput = {
  target: ProposalResponseTarget
  otpId: string
  action: ProposalAction
  nextStatus: ProposalStatus
  rejectionReason: string
  respondedAt: Date
  respondedIp: string
}

// One transaction so a code can be spent exactly once. Both writes are guarded on the state they
// expect — the OTP on still being unconsumed, the proposal on still being `sent` — so two requests
// racing with the same valid code leave one winner and roll the loser back whole.
async function recordProposalResponse({
  target,
  otpId,
  action,
  nextStatus,
  rejectionReason,
  respondedAt,
  respondedIp
}: RecordProposalResponseInput): Promise<void> {
  await database.transaction(async (transaction) => {
    const [used] = await transaction
      .update(proposalOtps)
      .set({ usedAt: respondedAt })
      .where(
        and(
          eq(proposalOtps.id, otpId),
          isNull(proposalOtps.usedAt),
          isNull(proposalOtps.invalidatedAt)
        )
      )
      .returning({ id: proposalOtps.id })

    if (!used) throw new ExpectedResponseError(t("proposals.public.errors.codeInvalid"))

    const [responded] = await transaction
      .update(proposals)
      .set({
        status: nextStatus,
        respondedAt,
        respondedIp,
        rejectionReason: action === "reject" ? rejectionReason : null,
        // Acceptance is the moment the document stops being an offer and becomes the record of a
        // deal. `lockedAt` is what the rest of the app reads to refuse further edits or sends; a
        // decline leaves it null because a rejected proposal is already terminal by status alone.
        lockedAt: action === "accept" ? respondedAt : null
      })
      .where(
        and(eq(proposals.id, target.id), eq(proposals.status, "sent"), isNull(proposals.deletedAt))
      )
      .returning({ id: proposals.id })

    if (!responded) throw new ExpectedResponseError(t("proposals.public.errors.alreadyResponded"))
  })
}

type IssueProposalOtpInput = {
  target: ProposalResponseTarget
  respondent: ProposalRespondent
  action: ProposalAction
  codeHash: string
  issuedAt: Date
}

async function issueProposalOtp({
  target,
  respondent,
  action,
  codeHash,
  issuedAt
}: IssueProposalOtpInput): Promise<string> {
  return database.transaction(async (transaction) => {
    // Supersede every outstanding code for this proposal rather than letting them accumulate: a
    // client who asks twice must not leave the first code live, or the attempt ceiling applies per
    // code instead of per proposal and a guesser gains a fresh five with every request.
    await transaction
      .update(proposalOtps)
      .set({ invalidatedAt: issuedAt })
      .where(
        and(
          eq(proposalOtps.proposalId, target.id),
          isNull(proposalOtps.usedAt),
          isNull(proposalOtps.invalidatedAt)
        )
      )

    const [created] = await transaction
      .insert(proposalOtps)
      .values({
        proposalId: target.id,
        action,
        codeHash,
        // The address the code is actually mailed to, which is what `verifyProposalOtp` compares
        // against: the identity is decided once, at request time, and the verify step can no longer
        // be answered by a different member of the respondent set.
        email: respondent.email,
        expiresAt: getProposalOtpExpiry(issuedAt)
      })
      .returning({ id: proposalOtps.id })

    if (!created) throw new Error("Proposal OTP insert returned no row")

    return created.id
  })
}

async function deliverProposalOtp(
  target: ProposalResponseTarget,
  respondent: ProposalRespondent,
  action: ProposalAction,
  code: string
): Promise<{ data: { delivered: true } } | { error: string }> {
  const subject = t("proposals.public.email.subject", { action, number: target.number })
  const text = t("proposals.public.email.body", {
    action,
    code,
    issuer: target.issuerName,
    minutes: PROPOSAL_OTP_TTL_MINUTES,
    name: respondent.name,
    number: target.number
  })

  const [log] = await database
    .insert(emailLogs)
    .values({
      documentType: "proposal",
      documentId: target.id,
      recipientEmail: respondent.email,
      recipientName: respondent.name,
      subject,
      status: "pending"
    })
    .returning({ id: emailLogs.id })

  let providerMessageId: string | null = null

  try {
    providerMessageId = await sendTransactionalEmail({ to: respondent.email, subject, text })
  } catch (error) {
    logger.error(
      { action: "deliverProposalOtp", proposalId: target.id, err: error },
      "Proposal OTP email delivery failed"
    )

    // The provider's own message is recorded, never the code that failed to reach the client.
    if (log) {
      await database
        .update(emailLogs)
        .set({ status: "failed", errorMessage: toDeliveryErrorMessage(error) })
        .where(eq(emailLogs.id, log.id))
    }

    return { error: t("proposals.public.errors.emailFailed") }
  }

  if (log) {
    await database
      .update(emailLogs)
      .set({ status: "sent", sentAt: new Date(), providerMessageId })
      .where(eq(emailLogs.id, log.id))
  }

  return { data: { delivered: true } }
}

async function findLatestProposalOtp(
  proposalId: string,
  action: ProposalAction
): Promise<ProposalOtpRow | null> {
  // Unfiltered by consumption on purpose: a used, expired or burnt-out code has to reach
  // `evaluateProposalOtp` so the client is told which of those happened instead of being sent back
  // around a loop with a generic "wrong code".
  const row = await database.query.proposalOtps.findFirst({
    where: and(eq(proposalOtps.proposalId, proposalId), eq(proposalOtps.action, action)),
    orderBy: desc(proposalOtps.createdAt)
  })

  return row ?? null
}

async function countFailedProposalOtpAttempt(otp: ProposalOtpRow): Promise<ProposalResponseResult> {
  const attempts = otp.attempts + 1
  const exhausted = hasExhaustedProposalOtpAttempts(attempts)

  await database
    .update(proposalOtps)
    .set({ attempts, invalidatedAt: exhausted ? new Date() : null })
    .where(eq(proposalOtps.id, otp.id))

  if (exhausted) return { error: t("proposals.public.errors.codeAttemptsExhausted") }

  return { error: t("proposals.public.errors.codeInvalid") }
}

async function invalidateProposalOtp(otpId: string, invalidatedAt: Date): Promise<void> {
  await database.update(proposalOtps).set({ invalidatedAt }).where(eq(proposalOtps.id, otpId))
}

async function writeProposalResponseAudit(
  event: ProposalResponseAuditEvent,
  target: ProposalResponseTarget,
  context: PublicRequestContext,
  metadata: Record<string, unknown>
): Promise<void> {
  // `actorUserId` is null because nobody is signed in, and `context.token` is never recorded: the
  // audit table is readable by anyone with database access and the token is a bearer credential
  // for this route (`security.md`).
  await writeAudit(event, {
    actorUserId: null,
    targetEntityType: "proposal",
    targetEntityId: target.id,
    metadata: { projectId: target.projectId, ...metadata },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
}

function generateOtpCode(): string {
  return String(randomInt(0, 10 ** PROPOSAL_OTP_LENGTH)).padStart(PROPOSAL_OTP_LENGTH, "0")
}

function toNextStatus(action: ProposalAction): ProposalStatus {
  return action === "accept" ? "accepted" : "rejected"
}

function toOtpRejectionMessage(reason: ProposalOtpRejection): string {
  switch (reason) {
    case "consumed":
      return t("proposals.public.errors.codeConsumed")
    case "expired":
      return t("proposals.public.errors.codeExpired")
    case "attempts_exhausted":
      return t("proposals.public.errors.codeAttemptsExhausted")
  }
}

function toDeliveryErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown"
}

function revalidateProposalResponsePaths(projectId: string | null, proposalId: string): void {
  revalidatePath(`/proposals/${proposalId}`)
  revalidatePath("/proposals")

  if (!projectId) return

  revalidatePath(`/projects/${projectId}/proposals/${proposalId}`)
  revalidatePath(`/projects/${projectId}/proposals`)
  revalidatePath(`/projects/${projectId}`)
}

class ExpectedResponseError extends Error {}
