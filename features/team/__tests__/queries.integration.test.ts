import { beforeEach, describe, expect, test, vi } from "vitest"

import {
  makeInvitation,
  makeMember,
  makeOrganization,
  makeSettings,
  makeUser
} from "@/tests/factories"

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  headers: vi.fn(),
  listInvitations: vi.fn(),
  listMembers: vi.fn()
}))

vi.mock("next/headers", () => ({
  headers: mocks.headers
}))

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      listInvitations: mocks.listInvitations,
      listMembers: mocks.listMembers
    }
  }
}))

vi.mock("@/lib/auth/session", () => ({
  getSession: mocks.getSession
}))

const ownerId = "00000000-0000-4000-8000-000000000501"
const inviteeId = "00000000-0000-4000-8000-000000000502"
const organizationId = "00000000-0000-4000-8000-000000000503"

describe("getInvitationPreview", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeOrganization({ id: organizationId, name: "Studio Remit" })
    await makeUser({ id: ownerId, email: "owner-team-queries@example.com" })

    mocks.headers.mockResolvedValue(new Headers())
    mocks.getSession.mockResolvedValue(null)
  })

  test("describes a pending invitation to an anonymous visitor", async () => {
    const { getInvitationPreview } = await import("../queries")

    const invitation = await makeInvitation({
      organizationId,
      inviterId: ownerId,
      email: "invitee@example.com",
      role: "accountant"
    })

    const preview = await getInvitationPreview({ invitationId: invitation.id })

    expect(preview).toEqual({
      invitationId: invitation.id,
      organizationName: "Studio Remit",
      email: "invitee@example.com",
      role: "accountant",
      sessionEmail: null,
      isAlreadyMember: false,
      hasAccount: false
    })
  })

  test("offers sign-in rather than sign-up when the invited address already has an account", async () => {
    const { getInvitationPreview } = await import("../queries")

    // The removed-then-reinvited case: Better Auth's removeMember drops the membership and leaves
    // the user row, so a fresh invitation to the same address reaches somebody who cannot register.
    await makeUser({ id: inviteeId, email: "returning@example.com" })
    const invitation = await makeInvitation({
      organizationId,
      inviterId: ownerId,
      email: "returning@example.com"
    })

    const preview = await getInvitationPreview({ invitationId: invitation.id })

    expect(preview).toEqual(
      expect.objectContaining({ hasAccount: true, sessionEmail: null, isAlreadyMember: false })
    )
  })

  test("hides an invitation whose expiry has passed", async () => {
    const { getInvitationPreview } = await import("../queries")

    const invitation = await makeInvitation({
      organizationId,
      inviterId: ownerId,
      expiresAt: new Date(Date.now() - 1000)
    })

    expect(await getInvitationPreview({ invitationId: invitation.id })).toBeNull()
  })

  test("hides an invitation that was already accepted or canceled", async () => {
    const { getInvitationPreview } = await import("../queries")

    const accepted = await makeInvitation({
      organizationId,
      inviterId: ownerId,
      status: "accepted"
    })
    const canceled = await makeInvitation({
      organizationId,
      inviterId: ownerId,
      status: "canceled"
    })

    expect(await getInvitationPreview({ invitationId: accepted.id })).toBeNull()
    expect(await getInvitationPreview({ invitationId: canceled.id })).toBeNull()
  })

  test("hides an invitation whose role Remit does not recognize", async () => {
    const { getInvitationPreview } = await import("../queries")

    const invitation = await makeInvitation({
      organizationId,
      inviterId: ownerId,
      role: "admin"
    })

    expect(await getInvitationPreview({ invitationId: invitation.id })).toBeNull()
  })

  test("returns null rather than querying when the id is not a uuid", async () => {
    const { getInvitationPreview } = await import("../queries")

    expect(await getInvitationPreview({ invitationId: "not-a-uuid" })).toBeNull()
    expect(await getInvitationPreview({})).toBeNull()
  })

  test("reports that the signed-in visitor is already a member", async () => {
    const { getInvitationPreview } = await import("../queries")

    await makeUser({ id: inviteeId, email: "invitee@example.com" })
    await makeMember({ userId: inviteeId, organizationId, role: "assistant" })
    const invitation = await makeInvitation({
      organizationId,
      inviterId: ownerId,
      email: "invitee@example.com"
    })

    mocks.getSession.mockResolvedValue({
      user: { id: inviteeId, email: "invitee@example.com" }
    })

    const preview = await getInvitationPreview({ invitationId: invitation.id })

    expect(preview).toEqual(
      expect.objectContaining({ sessionEmail: "invitee@example.com", isAlreadyMember: true })
    )
  })
})

describe("getTeamPageData", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeOrganization({ id: organizationId, name: "Studio Remit" })
    await makeUser({ id: ownerId, email: "owner-team-page@example.com", name: "Ada Owner" })

    mocks.headers.mockResolvedValue(new Headers())
    mocks.getSession.mockResolvedValue({
      user: { id: ownerId, email: "owner-team-page@example.com" }
    })
  })

  test("attaches a shareable link to every pending invitation when email is unconfigured", async () => {
    const { getTeamPageData } = await import("../queries")

    await makeSettings({
      businessName: "Studio Remit",
      defaultLocale: "pt",
      defaultTimezone: "UTC"
    })
    mocks.listMembers.mockResolvedValue({
      members: [
        {
          id: "00000000-0000-4000-8000-000000000504",
          userId: ownerId,
          organizationId,
          role: "owner",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          user: { id: ownerId, name: "Ada Owner", email: "owner-team-page@example.com" }
        }
      ],
      total: 1
    })
    mocks.listInvitations.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000505",
        email: "pending@example.com",
        role: "accountant",
        status: "pending",
        expiresAt: new Date(Date.now() + 60_000)
      },
      {
        id: "00000000-0000-4000-8000-000000000506",
        email: "stale@example.com",
        role: "accountant",
        status: "pending",
        expiresAt: new Date(Date.now() - 60_000)
      }
    ])

    const pageData = await getTeamPageData()

    expect(pageData.emailConfigured).toBe(false)
    expect(pageData.locale).toBe("pt")
    expect(pageData.members).toEqual([
      expect.objectContaining({ role: "owner", isCurrentUser: true })
    ])
    expect(pageData.invitations).toEqual([
      expect.objectContaining({
        email: "pending@example.com",
        shareLink: "http://localhost:3000/invite/00000000-0000-4000-8000-000000000505"
      })
    ])
  })
})
