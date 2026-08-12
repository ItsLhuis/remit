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

import { env } from "@/lib/config/env"

import { database } from "@/database"
import { organizations } from "@/database/schema"

import { getProfileEmailConfigured } from "@/features/settings/server"

import { sendInvitationEmail } from "./invitationEmail"
import {
  changeTeamMemberRoleSchema,
  inviteTeamMemberSchema,
  removeTeamMemberSchema,
  teamInvitationIdSchema
} from "./schemas"
import {
  buildInvitationLink,
  decideRemoval,
  decideRoleChange,
  toTeamRole,
  type TeamMembershipDecision
} from "./services/teamMembership"
import { type TeamInvitationListItem, type TeamMemberListItem } from "./types"

type RequestHeaders = Awaited<ReturnType<typeof headers>>

type TeamWriteContext = {
  userId: string
  userName: string
  role: Role
  requestHeaders: RequestHeaders
  ipAddress: string | null
  userAgent: string | null
}

type TeamWriteGate = { context: TeamWriteContext } | { error: string }

type TeamAuditEvent =
  | "team.member.invited"
  | "team.member.role_changed"
  | "team.member.removed"
  | "team.invitation.canceled"
  | "team.invitation.accepted"

type InviteTeamMemberResult =
  | { data: { invitation: TeamInvitationListItem; emailDelivered: boolean } }
  | { error: string }

type ChangeTeamMemberRoleResult = { data: { member: TeamMemberListItem } } | { error: string }

type RemoveTeamMemberResult =
  | { data: { memberId: string; sessionsRevoked: boolean } }
  | { error: string }

type CancelTeamInvitationResult = { data: { invitationId: string } } | { error: string }

type AcceptTeamInvitationResult = { data: { accepted: true } } | { error: string }

const teamPath = "/settings/team"

export async function inviteTeamMember(input: unknown): Promise<InviteTeamMemberResult> {
  const gate = await requireTeamWrite()

  if ("error" in gate) return gate

  const parsed = inviteTeamMemberSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate
  const { email, role } = parsed.data

  try {
    const invitation = await auth.api.createInvitation({
      headers: context.requestHeaders,
      body: { email, role }
    })

    const link = buildInvitationLink(env.NEXT_PUBLIC_APP_URL, invitation.id)

    // Delivery is attempted here rather than through the plugin's `sendInvitationEmail` hook so the
    // outcome is part of this action's return value: the owner has to be told to share the link by
    // hand whenever the mail never left, and the hook runs detached from the request with no way to
    // report that back. An unconfigured instance skips the attempt entirely (Stage 3 optional).
    const emailDelivered = (await getProfileEmailConfigured())
      ? await sendInvitationEmail({
          to: email,
          role,
          organizationName: await getOrganizationName(invitation.organizationId),
          inviterName: context.userName,
          link
        })
      : false

    await writeTeamAudit(context, "team.member.invited", null, { email, role, emailDelivered })

    await emit("member.invited", { email, role, userId: context.userId })

    revalidatePath(teamPath)

    return {
      data: {
        invitation: {
          id: invitation.id,
          email,
          role,
          expiresAt: invitation.expiresAt,
          shareLink: emailDelivered ? null : link
        },
        emailDelivered
      }
    }
  } catch (error) {
    return handleTeamActionError(error, "inviteTeamMember", context.userId)
  }
}

export async function changeTeamMemberRole(input: unknown): Promise<ChangeTeamMemberRoleResult> {
  const gate = await requireTeamWrite()

  if ("error" in gate) return gate

  const parsed = changeTeamMemberRoleSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate
  const { memberId, role } = parsed.data

  try {
    const target = await findTeamMember(context.requestHeaders, memberId)

    if (!target) return { error: t("settings.team.errors.memberNotFound") }

    const decision = decideRoleChange(target.role, role)

    if (!decision.allowed) return { error: toDecisionError(decision) }

    const updated = await auth.api.updateMemberRole({
      headers: context.requestHeaders,
      body: { memberId, role }
    })

    await writeTeamAudit(context, "team.member.role_changed", updated.userId, {
      from: target.role,
      to: role
    })

    revalidatePath(teamPath)

    return {
      data: { member: { ...target, role, isCurrentUser: target.userId === context.userId } }
    }
  } catch (error) {
    return handleTeamActionError(error, "changeTeamMemberRole", context.userId)
  }
}

export async function removeTeamMember(input: unknown): Promise<RemoveTeamMemberResult> {
  const gate = await requireTeamWrite()

  if ("error" in gate) return gate

  const parsed = removeTeamMemberSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate
  const { memberId } = parsed.data

  try {
    const target = await findTeamMember(context.requestHeaders, memberId)

    if (!target) return { error: t("settings.team.errors.memberNotFound") }

    const decision = decideRemoval(target.role, target.userId === context.userId)

    if (!decision.allowed) return { error: toDecisionError(decision) }

    await auth.api.removeMember({
      headers: context.requestHeaders,
      body: { memberIdOrEmail: memberId }
    })

    const sessionsRevoked = await revokeMemberSessions(target.userId)

    await writeTeamAudit(context, "team.member.removed", target.userId, {
      role: target.role,
      sessionsRevoked
    })

    await emit("member.removed", {
      memberId,
      userId: target.userId,
      removedByUserId: context.userId
    })

    revalidatePath(teamPath)

    return { data: { memberId, sessionsRevoked } }
  } catch (error) {
    return handleTeamActionError(error, "removeTeamMember", context.userId)
  }
}

export async function cancelTeamInvitation(input: unknown): Promise<CancelTeamInvitationResult> {
  const gate = await requireTeamWrite()

  if ("error" in gate) return gate

  const parsed = teamInvitationIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context } = gate

  try {
    const invitation = await auth.api.cancelInvitation({
      headers: context.requestHeaders,
      body: { invitationId: parsed.data.invitationId }
    })

    if (!invitation) return { error: t("settings.team.errors.invitationNotFound") }

    await writeTeamAudit(context, "team.invitation.canceled", null, {
      email: invitation.email,
      role: invitation.role
    })

    await emit("invitation.canceled", {
      email: invitation.email,
      role: invitation.role,
      userId: context.userId
    })

    revalidatePath(teamPath)

    return { data: { invitationId: parsed.data.invitationId } }
  } catch (error) {
    return handleTeamActionError(error, "cancelTeamInvitation", context.userId)
  }
}

// The invitee's own action, so the gate is a session rather than `requireTeamWrite` — the caller is
// by definition not a member yet. Better Auth is what authorizes it: `acceptInvitation` refuses an
// invitation whose email is not the session's, which is the check that makes holding the link
// insufficient on its own.
export async function acceptTeamInvitation(input: unknown): Promise<AcceptTeamInvitationResult> {
  const parsed = teamInvitationIdSchema.safeParse(input)

  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) return { error: t("errors.unauthorized") }

  try {
    const { member } = await auth.api.acceptInvitation({
      headers: requestHeaders,
      body: { invitationId: parsed.data.invitationId }
    })

    if (!member) return { error: t("settings.team.errors.invitationNotFound") }

    await writeAudit("team.invitation.accepted", {
      actorUserId: session.user.id,
      actorRole: toTeamRole(member.role),
      targetEntityType: "team_member",
      targetEntityId: session.user.id,
      metadata: { role: member.role },
      ipAddress: getIpAddress(requestHeaders),
      userAgent: requestHeaders.get("user-agent")
    })

    await emit("member.accepted", {
      memberId: member.id,
      userId: session.user.id,
      role: member.role
    })

    revalidatePath(teamPath)

    return { data: { accepted: true } }
  } catch (error) {
    return handleTeamActionError(error, "acceptTeamInvitation", session.user.id)
  }
}

async function requireTeamWrite(): Promise<TeamWriteGate> {
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })

  if (!session) return { error: t("errors.unauthorized") }

  const role = await getCurrentRole({ headers: requestHeaders, userId: session.user.id })

  if (role !== "owner") return { error: t("errors.forbidden") }

  return {
    context: {
      userId: session.user.id,
      userName: session.user.name,
      role,
      requestHeaders,
      ipAddress: getIpAddress(requestHeaders),
      userAgent: requestHeaders.get("user-agent")
    }
  }
}

type TeamMemberTarget = Omit<TeamMemberListItem, "isCurrentUser">

async function findTeamMember(
  requestHeaders: RequestHeaders,
  memberId: string
): Promise<TeamMemberTarget | null> {
  const { members } = await auth.api.listMembers({ headers: requestHeaders })
  const member = members.find((candidate) => candidate.id === memberId)

  if (!member) return null

  const role = toTeamRole(member.role)

  if (!role) return null

  return {
    id: member.id,
    userId: member.userId,
    name: member.user.name,
    email: member.user.email,
    role,
    joinedAt: member.createdAt
  }
}

// Better Auth exposes no endpoint that revokes another user's sessions without the admin plugin, so
// this goes through its internal adapter instead of deleting `sessions` rows directly — the adapter
// is what also clears secondary storage and runs the session delete hooks. A failure is logged and
// reported rather than thrown: the membership is already gone by this point, so every authorization
// gate refuses the removed user regardless, and undoing the removal would be worse than a session
// that lives out its remaining cookie-cache window with no role attached.
async function revokeMemberSessions(userId: string): Promise<boolean> {
  try {
    const context = await auth.$context

    await context.internalAdapter.deleteUserSessions(userId)

    return true
  } catch (error) {
    logger.error(
      { action: "removeTeamMember", userId, err: error },
      "Removed member session revocation failed"
    )

    return false
  }
}

async function getOrganizationName(organizationId: string): Promise<string> {
  const organization = await database.query.organizations.findFirst({
    columns: { name: true },
    where: eq(organizations.id, organizationId)
  })

  return organization?.name ?? "Remit"
}

async function writeTeamAudit(
  context: TeamWriteContext,
  event: TeamAuditEvent,
  targetUserId: string | null,
  metadata: Record<string, unknown>
): Promise<void> {
  await writeAudit(event, {
    actorUserId: context.userId,
    actorRole: context.role,
    // Never the invitation id: it is the bearer credential for `/invite/[invitationId]`, and
    // `audit_logs` is readable by anyone with database access. Invitation events therefore identify
    // themselves by the invited email in `metadata` and carry no target id at all.
    targetEntityType: targetUserId ? "team_member" : "team_invitation",
    targetEntityId: targetUserId,
    metadata,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent
  })
}

function toDecisionError(decision: Extract<TeamMembershipDecision, { allowed: false }>): string {
  switch (decision.reason) {
    case "ownerImmutable":
      return t("settings.team.errors.ownerImmutable")
    case "selfRemoval":
      return t("settings.team.errors.selfRemoval")
    case "roleUnchanged":
      return t("settings.team.errors.roleUnchanged")
  }
}

function handleTeamActionError(
  error: unknown,
  action: string,
  userId: string | null
): { error: string } {
  const code = getApiErrorCode(error)

  switch (code) {
    case "USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION":
      return { error: t("settings.team.errors.alreadyMember") }
    case "USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION":
      return { error: t("settings.team.errors.alreadyInvited") }
    case "INVITATION_NOT_FOUND":
      return { error: t("settings.team.errors.invitationNotFound") }
    case "YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION":
      return { error: t("settings.team.errors.notInvitee") }
    case "MEMBER_NOT_FOUND":
      return { error: t("settings.team.errors.memberNotFound") }
    case "YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER":
    case "YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER":
      return { error: t("settings.team.errors.ownerImmutable") }
    default:
      logger.error({ action, userId, code, err: error }, "Team action failed")

      return { error: t("settings.team.errors.actionFailed") }
  }
}

// Better Auth reports the failure through `APIError.body.code`; anything without one is a bug or an
// infrastructure fault rather than a case a user can act on, so it collapses to one value that the
// switch above logs and reports generically.
function getApiErrorCode(error: unknown): string {
  if (typeof error !== "object" || error === null || !("body" in error)) return "unknown"

  const body = (error as { body: unknown }).body

  if (typeof body !== "object" || body === null || !("code" in body)) return "unknown"

  const code = (body as { code: unknown }).code

  return typeof code === "string" ? code : "unknown"
}
