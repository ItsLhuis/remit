import { headers } from "next/headers"

import { and, eq } from "drizzle-orm"

import { auth } from "@/lib/auth"
import { getSession } from "@/lib/auth/session"

import { env } from "@/lib/config/env"

import { database } from "@/database"
import { invitations, members, organizations, users } from "@/database/schema"

import { getProfileEmailConfigured } from "@/features/settings/server"

import { teamInvitationIdSchema } from "./schemas"
import {
  buildInvitationLink,
  isInvitationPending,
  sortTeamMembers,
  toAssignableRole,
  toTeamRole
} from "./services/teamMembership"
import { type InvitationPreview, type TeamPageData } from "./types"

export async function getTeamPageData(): Promise<TeamPageData> {
  const requestHeaders = await headers()

  const [session, memberList, invitationList, emailConfigured, instanceSettings] =
    await Promise.all([
      getSession(requestHeaders),
      auth.api.listMembers({ headers: requestHeaders }),
      auth.api.listInvitations({ headers: requestHeaders }),
      getProfileEmailConfigured(),
      database.query.settings.findFirst({
        columns: { defaultLocale: true, defaultTimezone: true }
      })
    ])

  const now = new Date()
  const currentUserId = session?.user.id ?? null

  const teamMembers = memberList.members.flatMap((member) => {
    const role = toTeamRole(member.role)

    if (!role) return []

    return [
      {
        id: member.id,
        userId: member.userId,
        name: member.user.name,
        email: member.user.email,
        role,
        joinedAt: member.createdAt,
        isCurrentUser: member.userId === currentUserId
      }
    ]
  })

  const pendingInvitations = invitationList.flatMap((invitation) => {
    const role = toAssignableRole(invitation.role)

    if (!role || !isInvitationPending(invitation, now)) return []

    return [
      {
        id: invitation.id,
        email: invitation.email,
        role,
        expiresAt: invitation.expiresAt,
        shareLink: emailConfigured
          ? null
          : buildInvitationLink(env.NEXT_PUBLIC_APP_URL, invitation.id)
      }
    ]
  })

  return {
    members: sortTeamMembers(teamMembers),
    invitations: pendingInvitations,
    emailConfigured,
    locale: instanceSettings?.defaultLocale ?? "en",
    timeZone: instanceSettings?.defaultTimezone ?? "UTC"
  }
}

// Read-only and deliberately not `auth.api.getInvitation`, which rejects an anonymous caller: the
// whole point of this read is to render the acceptance page to somebody who has no account yet.
// `.agents/rules/auth.md` permits reading a Better Auth-owned table when no API covers the case;
// every write in this feature still goes through the organization APIs.
export async function getInvitationPreview(input: unknown): Promise<InvitationPreview | null> {
  const parsed = teamInvitationIdSchema.safeParse(input)

  if (!parsed.success) return null

  const [invitation] = await database
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      status: invitations.status,
      expiresAt: invitations.expiresAt,
      organizationId: invitations.organizationId,
      organizationName: organizations.name
    })
    .from(invitations)
    .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
    .where(eq(invitations.id, parsed.data.invitationId))
    .limit(1)

  if (!invitation) return null

  const role = toAssignableRole(invitation.role)

  if (!role || !isInvitationPending(invitation, new Date())) return null

  const [session, invitedUser] = await Promise.all([
    getSession(),
    // Both sides are lowercase: Better Auth normalizes the address on sign-up and on invite, and
    // `inviteTeamMemberSchema` does the same before it ever reaches the API.
    database.query.users.findFirst({
      columns: { id: true },
      where: eq(users.email, invitation.email)
    })
  ])

  const isAlreadyMember = session
    ? Boolean(
        await database.query.members.findFirst({
          columns: { id: true },
          where: and(
            eq(members.userId, session.user.id),
            eq(members.organizationId, invitation.organizationId)
          )
        })
      )
    : false

  return {
    invitationId: invitation.id,
    organizationName: invitation.organizationName,
    email: invitation.email,
    role,
    sessionEmail: session?.user.email ?? null,
    isAlreadyMember,
    hasAccount: Boolean(invitedUser)
  }
}
