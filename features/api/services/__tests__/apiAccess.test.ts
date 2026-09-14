import { describe, expect, test } from "vitest"

import { evaluateApiTokenAccess, scopeForResource, type ApiTokenAccessInput } from "../apiAccess"

const now = new Date("2026-09-11T12:00:00.000Z")

function makeInput(overrides: Partial<ApiTokenAccessInput> = {}): ApiTokenAccessInput {
  return {
    resource: "invoices",
    scopes: ["invoices:read"],
    creatorRole: "owner",
    revokedAt: null,
    expiresAt: null,
    now,
    ...overrides
  }
}

describe("API token access", () => {
  test("allows a live token on a resource it is scoped to, carrying its creator's role", () => {
    const access = evaluateApiTokenAccess(makeInput({ creatorRole: "accountant" }))

    expect(access).toEqual({ allowed: true, role: "accountant" })
  })

  test("refuses a token on a resource it holds no scope for", () => {
    const access = evaluateApiTokenAccess(makeInput({ resource: "clients" }))

    expect(access).toEqual({ allowed: false, reason: "scope_missing" })
  })

  test("refuses a revoked token even when it is otherwise in scope", () => {
    const access = evaluateApiTokenAccess(makeInput({ revokedAt: new Date("2026-09-10") }))

    expect(access).toEqual({ allowed: false, reason: "revoked" })
  })

  test("refuses a token from the instant it expires", () => {
    const access = evaluateApiTokenAccess(makeInput({ expiresAt: now }))

    expect(access).toEqual({ allowed: false, reason: "expired" })
  })

  test("still allows a token one millisecond before it expires", () => {
    const access = evaluateApiTokenAccess(makeInput({ expiresAt: new Date(now.getTime() + 1) }))

    expect(access.allowed).toBe(true)
  })

  test("refuses every token of a creator who no longer holds a membership", () => {
    const access = evaluateApiTokenAccess(makeInput({ creatorRole: null }))

    expect(access).toEqual({ allowed: false, reason: "no_creator" })
  })

  test("refuses a creator whose stored role is not one Remit recognises", () => {
    const access = evaluateApiTokenAccess(makeInput({ creatorRole: "admin" }))

    expect(access).toEqual({ allowed: false, reason: "no_creator" })
  })

  test("allows any live token onto the scope-free document route", () => {
    const access = evaluateApiTokenAccess(makeInput({ resource: null, scopes: ["clients:read"] }))

    expect(access).toEqual({ allowed: true, role: "owner" })
  })

  test("refuses a revoked token on the scope-free document route", () => {
    const access = evaluateApiTokenAccess(
      makeInput({ resource: null, revokedAt: new Date("2026-09-10") })
    )

    expect(access.allowed).toBe(false)
  })

  test("names the read scope after its resource", () => {
    expect(scopeForResource("time_entries")).toBe("time_entries:read")
  })
})
