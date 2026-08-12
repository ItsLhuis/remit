import { describe, expect, test } from "vitest"

import {
  buildInvitationLink,
  decideRemoval,
  decideRoleChange,
  isInvitationPending,
  sortTeamMembers,
  toAssignableRole,
  toTeamRole
} from "../teamMembership"

describe("role narrowing", () => {
  test("accepts each of the three roles Remit defines", () => {
    expect(toTeamRole("owner")).toBe("owner")
    expect(toTeamRole("accountant")).toBe("accountant")
    expect(toTeamRole("assistant")).toBe("assistant")
  })

  test("returns null for a role the members column could hold but Remit does not define", () => {
    expect(toTeamRole("admin")).toBeNull()
    expect(toTeamRole("member")).toBeNull()
  })

  test("refuses owner when narrowing to an assignable role", () => {
    expect(toAssignableRole("owner")).toBeNull()
    expect(toAssignableRole("assistant")).toBe("assistant")
  })
})

describe("owner invariant", () => {
  test("refuses a role change that would demote the only owner", () => {
    const decision = decideRoleChange("owner", "accountant")

    expect(decision).toEqual({ allowed: false, reason: "ownerImmutable" })
  })

  test("refuses removing the owner", () => {
    const decision = decideRemoval("owner", false)

    expect(decision).toEqual({ allowed: false, reason: "ownerImmutable" })
  })

  test("refuses removing yourself", () => {
    const decision = decideRemoval("accountant", true)

    expect(decision).toEqual({ allowed: false, reason: "selfRemoval" })
  })

  test("refuses a role change that would leave the role untouched", () => {
    const decision = decideRoleChange("assistant", "assistant")

    expect(decision).toEqual({ allowed: false, reason: "roleUnchanged" })
  })

  test("allows swapping between the two assignable roles", () => {
    expect(decideRoleChange("accountant", "assistant")).toEqual({ allowed: true })
    expect(decideRoleChange("assistant", "accountant")).toEqual({ allowed: true })
  })

  test("allows removing another member who is not the owner", () => {
    expect(decideRemoval("accountant", false)).toEqual({ allowed: true })
  })
})

describe("invitation state", () => {
  const now = new Date("2026-08-11T12:00:00.000Z")

  test("treats a pending invitation with a future expiry as usable", () => {
    const pending = isInvitationPending(
      { status: "pending", expiresAt: new Date("2026-08-12T12:00:00.000Z") },
      now
    )

    expect(pending).toBe(true)
  })

  test("treats an expired invitation as unusable even while its status still says pending", () => {
    const pending = isInvitationPending(
      { status: "pending", expiresAt: new Date("2026-08-11T11:59:59.000Z") },
      now
    )

    expect(pending).toBe(false)
  })

  test("treats an accepted or canceled invitation as unusable", () => {
    const future = new Date("2026-08-12T12:00:00.000Z")

    expect(isInvitationPending({ status: "accepted", expiresAt: future }, now)).toBe(false)
    expect(isInvitationPending({ status: "canceled", expiresAt: future }, now)).toBe(false)
  })

  test("builds an invitation link against the instance base url", () => {
    const link = buildInvitationLink("https://remit.example.com", "abc-123")

    expect(link).toBe("https://remit.example.com/invite/abc-123")
  })
})

describe("member ordering", () => {
  test("lists the owner first and orders the remaining roles by rank then name", () => {
    const sorted = sortTeamMembers([
      { role: "assistant", name: "Zoe" },
      { role: "accountant", name: "Bruno" },
      { role: "owner", name: "Ana" },
      { role: "accountant", name: "Alice" }
    ])

    expect(sorted.map((member) => member.name)).toEqual(["Ana", "Alice", "Bruno", "Zoe"])
  })
})
