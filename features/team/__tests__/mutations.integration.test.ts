import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, emailLogs } from "@/database/schema"

import { makeOrganization, makeSettings, makeUser } from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  acceptInvitation: vi.fn(),
  cancelInvitation: vi.fn(),
  createInvitation: vi.fn(),
  deleteUserSessions: vi.fn(),
  emit: vi.fn(),
  getCurrentRole: vi.fn(),
  getSession: vi.fn(),
  headers: vi.fn(),
  listMembers: vi.fn(),
  loggerError: vi.fn(),
  removeMember: vi.fn(),
  revalidatePath: vi.fn(),
  sendTransactionalEmail: vi.fn(),
  updateMemberRole: vi.fn()
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}))

vi.mock("next/headers", () => ({
  headers: mocks.headers
}))

// Better Auth is stubbed at the module boundary, which is the point of these tests: they assert the
// orchestration Remit owns — the gate, the owner invariant, the audit row, the emitted event, the
// fallback link — against a real database, not the plugin's own behaviour.
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      acceptInvitation: mocks.acceptInvitation,
      cancelInvitation: mocks.cancelInvitation,
      createInvitation: mocks.createInvitation,
      getSession: mocks.getSession,
      listMembers: mocks.listMembers,
      removeMember: mocks.removeMember,
      updateMemberRole: mocks.updateMemberRole
    },
    $context: Promise.resolve({
      internalAdapter: { deleteUserSessions: mocks.deleteUserSessions }
    })
  }
}))

vi.mock("@/lib/auth/session", () => ({
  getCurrentRole: mocks.getCurrentRole
}))

vi.mock("@/lib/events", () => ({
  emit: mocks.emit
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    fatal: vi.fn(),
    warn: vi.fn()
  }
}))

vi.mock("@/features/email/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/email/server")>()),
  sendTransactionalEmail: mocks.sendTransactionalEmail
}))

const ownerId = "00000000-0000-4000-8000-000000000401"
const ownerEmail = "owner-team@example.com"
const memberUserId = "00000000-0000-4000-8000-000000000402"
const memberId = "00000000-0000-4000-8000-000000000403"
const ownerMemberId = "00000000-0000-4000-8000-000000000404"
const invitationId = "00000000-0000-4000-8000-000000000405"
const organizationId = "00000000-0000-4000-8000-000000000406"

const smtpSettings = {
  emailProvider: "smtp" as const,
  smtpHost: "smtp.example.com",
  smtpPort: 587,
  smtpUser: "mailer@example.com",
  smtpPass: "secret",
  emailFromAddress: "billing@example.com"
}

type MemberFixture = {
  id: string
  userId: string
  role: string
  name: string
  email: string
}

function asMember({ id, userId, role, name, email }: MemberFixture) {
  return {
    id,
    userId,
    organizationId,
    role,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    user: { id: userId, name, email }
  }
}

describe("team mutations", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeOrganization({ id: organizationId, name: "Studio Remit" })
    await makeUser({ id: ownerId, email: ownerEmail, name: "Ada Owner" })
    await makeUser({ id: memberUserId, email: "assistant@example.com", name: "Bo Assistant" })

    mocks.headers.mockResolvedValue(
      new Headers({
        "user-agent": "Vitest",
        "x-forwarded-for": "203.0.113.40, 198.51.100.2"
      })
    )
    mocks.getSession.mockResolvedValue({
      user: { id: ownerId, email: ownerEmail, name: "Ada Owner" }
    })
    mocks.getCurrentRole.mockResolvedValue("owner")
    mocks.listMembers.mockResolvedValue({
      members: [
        asMember({
          id: ownerMemberId,
          userId: ownerId,
          role: "owner",
          name: "Ada Owner",
          email: ownerEmail
        }),
        asMember({
          id: memberId,
          userId: memberUserId,
          role: "assistant",
          name: "Bo Assistant",
          email: "assistant@example.com"
        })
      ],
      total: 2
    })
  })

  test("refuses every team write when the session is not the owner", async () => {
    const { changeTeamMemberRole, inviteTeamMember, removeTeamMember } =
      await import("../mutations")

    mocks.getCurrentRole.mockResolvedValue("assistant")

    const results = await Promise.all([
      inviteTeamMember({ email: "new@example.com", role: "accountant" }),
      changeTeamMemberRole({ memberId, role: "accountant" }),
      removeTeamMember({ memberId })
    ])

    expect(results.every((result) => "error" in result)).toBe(true)
    expect(mocks.createInvitation).not.toHaveBeenCalled()
    expect(mocks.updateMemberRole).not.toHaveBeenCalled()
    expect(mocks.removeMember).not.toHaveBeenCalled()
  })

  test("returns a shareable link and sends no email when delivery is not configured", async () => {
    const { inviteTeamMember } = await import("../mutations")

    await makeSettings({ businessName: "Studio Remit" })
    mocks.createInvitation.mockResolvedValue({
      id: invitationId,
      organizationId,
      email: "new@example.com",
      role: "accountant",
      expiresAt: new Date("2026-08-13T12:00:00.000Z")
    })

    const result = await inviteTeamMember({ email: "New@Example.com", role: "accountant" })
    const emailRows = await database.select().from(emailLogs)

    expect(result).toEqual({
      data: {
        invitation: expect.objectContaining({
          email: "new@example.com",
          role: "accountant",
          shareLink: `http://localhost:3000/invite/${invitationId}`
        }),
        emailDelivered: false
      }
    })
    expect(mocks.sendTransactionalEmail).not.toHaveBeenCalled()
    expect(emailRows).toHaveLength(0)
  })

  test("sends the invitation email and records it when delivery is configured", async () => {
    const { inviteTeamMember } = await import("../mutations")

    await makeSettings({ businessName: "Studio Remit", ...smtpSettings })
    mocks.createInvitation.mockResolvedValue({
      id: invitationId,
      organizationId,
      email: "new@example.com",
      role: "assistant",
      expiresAt: new Date("2026-08-13T12:00:00.000Z")
    })
    mocks.sendTransactionalEmail.mockResolvedValue(undefined)

    const result = await inviteTeamMember({ email: "new@example.com", role: "assistant" })
    const [emailRow] = await database.select().from(emailLogs)

    expect(result).toEqual({
      data: {
        invitation: expect.objectContaining({ shareLink: null }),
        emailDelivered: true
      }
    })
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "new@example.com" })
    )
    expect(emailRow).toEqual(
      expect.objectContaining({
        recipientEmail: "new@example.com",
        status: "sent",
        documentType: null
      })
    )
  })

  test("falls back to the shareable link when a configured provider rejects the message", async () => {
    const { inviteTeamMember } = await import("../mutations")

    await makeSettings({ businessName: "Studio Remit", ...smtpSettings })
    mocks.createInvitation.mockResolvedValue({
      id: invitationId,
      organizationId,
      email: "new@example.com",
      role: "accountant",
      expiresAt: new Date("2026-08-13T12:00:00.000Z")
    })
    mocks.sendTransactionalEmail.mockRejectedValue(new Error("smtp refused"))

    const result = await inviteTeamMember({ email: "new@example.com", role: "accountant" })
    const [emailRow] = await database.select().from(emailLogs)

    expect(result).toEqual({
      data: {
        invitation: expect.objectContaining({
          shareLink: `http://localhost:3000/invite/${invitationId}`
        }),
        emailDelivered: false
      }
    })
    expect(emailRow?.status).toBe("failed")
  })

  test("audits an invitation without ever recording the invitation id", async () => {
    const { inviteTeamMember } = await import("../mutations")

    await makeSettings({ businessName: "Studio Remit" })
    mocks.createInvitation.mockResolvedValue({
      id: invitationId,
      organizationId,
      email: "new@example.com",
      role: "accountant",
      expiresAt: new Date("2026-08-13T12:00:00.000Z")
    })

    await inviteTeamMember({ email: "new@example.com", role: "accountant" })
    const [auditRow] = await database.select().from(auditLogs)

    expect(auditRow).toEqual(
      expect.objectContaining({
        event: "team.member.invited",
        actorUserId: ownerId,
        actorRole: "owner",
        targetEntityType: "team_invitation",
        targetEntityId: null,
        ipAddress: "203.0.113.40",
        userAgent: "Vitest"
      })
    )
    expect(JSON.stringify(auditRow?.metadata)).not.toContain(invitationId)
    expect(mocks.emit).toHaveBeenCalledWith("member.invited", {
      email: "new@example.com",
      role: "accountant",
      userId: ownerId
    })
  })

  test("changes a member role and records the transition it made", async () => {
    const { changeTeamMemberRole } = await import("../mutations")

    mocks.updateMemberRole.mockResolvedValue({
      id: memberId,
      userId: memberUserId,
      organizationId,
      role: "accountant"
    })

    const result = await changeTeamMemberRole({ memberId, role: "accountant" })
    const [auditRow] = await database.select().from(auditLogs)

    expect(result).toEqual({
      data: { member: expect.objectContaining({ id: memberId, role: "accountant" }) }
    })
    expect(mocks.updateMemberRole).toHaveBeenCalledWith(
      expect.objectContaining({ body: { memberId, role: "accountant" } })
    )
    expect(auditRow).toEqual(
      expect.objectContaining({
        event: "team.member.role_changed",
        targetEntityType: "team_member",
        targetEntityId: memberUserId,
        metadata: { from: "assistant", to: "accountant" }
      })
    )
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings/team")
  })

  test("refuses to demote the owner, leaving the instance with one", async () => {
    const { changeTeamMemberRole } = await import("../mutations")

    const result = await changeTeamMemberRole({ memberId: ownerMemberId, role: "accountant" })
    const auditRows = await database.select().from(auditLogs)

    expect(result).toEqual({ error: "The owner role cannot be changed or removed" })
    expect(mocks.updateMemberRole).not.toHaveBeenCalled()
    expect(auditRows).toHaveLength(0)
  })

  test("refuses to remove the owner", async () => {
    const { removeTeamMember } = await import("../mutations")

    const result = await removeTeamMember({ memberId: ownerMemberId })

    expect(result).toEqual({ error: "The owner role cannot be changed or removed" })
    expect(mocks.removeMember).not.toHaveBeenCalled()
  })

  test("refuses to remove the acting member", async () => {
    const { removeTeamMember } = await import("../mutations")

    mocks.listMembers.mockResolvedValue({
      members: [
        asMember({
          id: memberId,
          userId: ownerId,
          role: "assistant",
          name: "Ada Owner",
          email: ownerEmail
        })
      ],
      total: 1
    })

    const result = await removeTeamMember({ memberId })

    expect(result).toEqual({ error: "You cannot remove yourself" })
    expect(mocks.removeMember).not.toHaveBeenCalled()
  })

  test("removes a member and revokes every session they still hold", async () => {
    const { removeTeamMember } = await import("../mutations")

    mocks.removeMember.mockResolvedValue({ member: { id: memberId } })
    mocks.deleteUserSessions.mockResolvedValue(undefined)

    const result = await removeTeamMember({ memberId })
    const [auditRow] = await database.select().from(auditLogs)

    expect(result).toEqual({ data: { memberId, sessionsRevoked: true } })
    expect(mocks.deleteUserSessions).toHaveBeenCalledWith(memberUserId)
    expect(auditRow).toEqual(
      expect.objectContaining({
        event: "team.member.removed",
        targetEntityId: memberUserId,
        metadata: { role: "assistant", sessionsRevoked: true }
      })
    )
    expect(mocks.emit).toHaveBeenCalledWith("member.removed", {
      memberId,
      userId: memberUserId,
      removedByUserId: ownerId
    })
  })

  test("still completes the removal when session revocation fails, and says so", async () => {
    const { removeTeamMember } = await import("../mutations")

    mocks.removeMember.mockResolvedValue({ member: { id: memberId } })
    mocks.deleteUserSessions.mockRejectedValue(new Error("adapter down"))

    const result = await removeTeamMember({ memberId })

    expect(result).toEqual({ data: { memberId, sessionsRevoked: false } })
    expect(mocks.loggerError).toHaveBeenCalled()
  })

  test("cancels an invitation without recording its id in the audit trail", async () => {
    const { cancelTeamInvitation } = await import("../mutations")

    mocks.cancelInvitation.mockResolvedValue({
      id: invitationId,
      email: "new@example.com",
      role: "accountant",
      status: "canceled"
    })

    const result = await cancelTeamInvitation({ invitationId })
    const [auditRow] = await database.select().from(auditLogs)

    expect(result).toEqual({ data: { invitationId } })
    expect(auditRow).toEqual(
      expect.objectContaining({
        event: "team.invitation.canceled",
        targetEntityType: "team_invitation",
        targetEntityId: null,
        metadata: { email: "new@example.com", role: "accountant" }
      })
    )
    expect(JSON.stringify(auditRow)).not.toContain(invitationId)
  })

  test("maps a duplicate invitation to a message the owner can act on", async () => {
    const { inviteTeamMember } = await import("../mutations")

    mocks.createInvitation.mockRejectedValue({
      body: { code: "USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION" }
    })

    const result = await inviteTeamMember({ email: "assistant@example.com", role: "accountant" })

    expect(result).toEqual({ error: "That email address is already a member" })
    expect(mocks.loggerError).not.toHaveBeenCalled()
  })

  test("records the acceptance against the invitee once Better Auth admits them", async () => {
    const { acceptTeamInvitation } = await import("../mutations")

    mocks.getSession.mockResolvedValue({
      user: { id: memberUserId, email: "assistant@example.com", name: "Bo Assistant" }
    })
    mocks.acceptInvitation.mockResolvedValue({
      invitation: { id: invitationId, status: "accepted" },
      member: { id: memberId, userId: memberUserId, role: "accountant" }
    })

    const result = await acceptTeamInvitation({ invitationId })
    const [auditRow] = await database.select().from(auditLogs)

    expect(result).toEqual({ data: { accepted: true } })
    expect(auditRow).toEqual(
      expect.objectContaining({
        event: "team.invitation.accepted",
        actorUserId: memberUserId,
        actorRole: "accountant",
        targetEntityId: memberUserId
      })
    )
    expect(mocks.emit).toHaveBeenCalledWith("member.accepted", {
      memberId,
      userId: memberUserId,
      role: "accountant"
    })
  })

  test("refuses acceptance without a session", async () => {
    const { acceptTeamInvitation } = await import("../mutations")

    mocks.getSession.mockResolvedValue(null)

    const result = await acceptTeamInvitation({ invitationId })

    expect(result).toEqual({ error: "You must be signed in to do that" })
    expect(mocks.acceptInvitation).not.toHaveBeenCalled()
  })
})
