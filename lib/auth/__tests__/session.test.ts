import { beforeEach, describe, expect, test, vi } from "vitest"

const USER_ID = "00000000-0000-0000-0000-000000000001"
const ORGANIZATION_ID = "00000000-0000-0000-0000-000000000002"
const SESSION_TOKEN = "session-token"
const MEMBERS_USER_ID = "members.userId"

const requestHeaders = new Headers()

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getActiveMemberRole: vi.fn(),
  setActiveOrganization: vi.fn(),
  headers: vi.fn(),
  notFound: vi.fn(),
  redirect: vi.fn(),
  findMember: vi.fn(),
  eq: vi.fn()
}))

vi.mock("next/headers", () => ({
  headers: mocks.headers
}))

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect
}))

vi.mock("drizzle-orm", () => ({
  eq: mocks.eq
}))

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mocks.getSession,
      getActiveMemberRole: mocks.getActiveMemberRole,
      setActiveOrganization: mocks.setActiveOrganization
    }
  }
}))

vi.mock("@/database", () => ({
  database: {
    query: {
      members: {
        findFirst: mocks.findMember
      }
    }
  }
}))

vi.mock("@/database/schema", () => ({
  members: {
    userId: MEMBERS_USER_ID
  }
}))

describe("requireRole", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.headers.mockResolvedValue(requestHeaders)
    mocks.getSession.mockResolvedValue({
      session: {
        token: SESSION_TOKEN
      },
      user: {
        id: USER_ID
      }
    })
    mocks.getActiveMemberRole.mockResolvedValue({ role: "owner" })
    mocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND")
    })
    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`NEXT_REDIRECT:${path}`)
    })
    mocks.findMember.mockResolvedValue({
      organizationId: ORGANIZATION_ID,
      role: "owner"
    })
    mocks.setActiveOrganization.mockResolvedValue(undefined)
    mocks.eq.mockImplementation((field: string, value: string) => ({ field, value }))
  })

  test("uses the active organization role when Better Auth has one", async () => {
    const { requireRole } = await import("../session")

    await expect(requireRole("owner")).resolves.toMatchObject({ role: "owner" })

    expect(mocks.getActiveMemberRole).toHaveBeenCalledWith({ headers: requestHeaders })
    expect(mocks.findMember).not.toHaveBeenCalled()
    expect(mocks.setActiveOrganization).not.toHaveBeenCalled()
  })

  test("accepts any matching role from a required role list", async () => {
    mocks.getActiveMemberRole.mockResolvedValueOnce({ role: "accountant" })

    const { requireRole } = await import("../session")

    await expect(requireRole(["owner", "accountant"])).resolves.toMatchObject({
      role: "accountant"
    })

    expect(mocks.notFound).not.toHaveBeenCalled()
  })

  test("redirects anonymous users to login", async () => {
    mocks.getSession.mockResolvedValueOnce(null)

    const { requireRole } = await import("../session")

    await expect(requireRole("owner")).rejects.toThrow("NEXT_REDIRECT:/login")

    expect(mocks.redirect).toHaveBeenCalledWith("/login")
    expect(mocks.getActiveMemberRole).not.toHaveBeenCalled()
    expect(mocks.findMember).not.toHaveBeenCalled()
  })

  test("returns not found when the current role is not allowed", async () => {
    mocks.getActiveMemberRole.mockResolvedValueOnce({ role: "assistant" })

    const { requireRole } = await import("../session")

    await expect(requireRole("owner")).rejects.toThrow("NEXT_NOT_FOUND")

    expect(mocks.notFound).toHaveBeenCalled()
  })

  test("returns not found when Better Auth returns an unknown role", async () => {
    mocks.getActiveMemberRole.mockResolvedValueOnce({ role: "viewer" })

    const { requireRole } = await import("../session")

    await expect(requireRole("owner")).rejects.toThrow("NEXT_NOT_FOUND")

    expect(mocks.notFound).toHaveBeenCalled()
  })

  test("falls back to the single-instance member and repairs the active organization", async () => {
    mocks.getActiveMemberRole.mockRejectedValueOnce(new Error("No active organization"))

    const { requireRole } = await import("../session")

    await expect(requireRole("owner")).resolves.toMatchObject({ role: "owner" })

    expect(mocks.findMember).toHaveBeenCalledWith({
      columns: {
        role: true,
        organizationId: true
      },
      where: expect.anything()
    })
    expect(mocks.eq).toHaveBeenCalledWith(MEMBERS_USER_ID, USER_ID)
    expect(mocks.setActiveOrganization).toHaveBeenCalledWith({
      headers: requestHeaders,
      body: {
        organizationId: ORGANIZATION_ID
      }
    })
  })

  test("returns not found when the fallback member cannot be found", async () => {
    mocks.getActiveMemberRole.mockRejectedValueOnce(new Error("No active organization"))
    mocks.findMember.mockResolvedValueOnce(null)

    const { requireRole } = await import("../session")

    await expect(requireRole("owner")).rejects.toThrow("NEXT_NOT_FOUND")

    expect(mocks.setActiveOrganization).not.toHaveBeenCalled()
    expect(mocks.notFound).toHaveBeenCalled()
  })

  test("does not mask other Better Auth role errors", async () => {
    mocks.getActiveMemberRole.mockRejectedValueOnce(new Error("Database unavailable"))

    const { requireRole } = await import("../session")

    await expect(requireRole("owner")).rejects.toThrow("Database unavailable")

    expect(mocks.findMember).not.toHaveBeenCalled()
  })
})
