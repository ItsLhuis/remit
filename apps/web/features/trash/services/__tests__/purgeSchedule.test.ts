import { describe, expect, test } from "vitest"

import { isPurgeDue, resolvePurgeSchedule, type NamingDocument } from "../purgeSchedule"

const POLICY = { trashDays: 30, financialDays: 90 }
const DELETED_AT = new Date("2026-05-01T12:00:00.000Z")

function document(overrides: Partial<NamingDocument> = {}): NamingDocument {
  return { window: "financial", deletedAt: DELETED_AT, countersigned: false, ...overrides }
}

describe("ordinary records", () => {
  test("dates the purge from the window the record belongs to", () => {
    const schedule = resolvePurgeSchedule(
      { kind: "record", window: "financial", deletedAt: DELETED_AT },
      POLICY
    )

    expect(schedule).toEqual({
      status: "scheduled",
      dueAt: new Date("2026-07-30T12:00:00.000Z"),
      heldByDocuments: false
    })
  })

  test("is never scheduled while its window is unset", () => {
    const schedule = resolvePurgeSchedule(
      { kind: "record", window: "trash", deletedAt: DELETED_AT },
      { trashDays: null, financialDays: 90 }
    )

    expect(schedule).toEqual({ status: "windowUnset" })
  })
})

describe("contracts", () => {
  test("a countersigned contract is never purged whatever the window", () => {
    const schedule = resolvePurgeSchedule(
      { kind: "contract", deletedAt: DELETED_AT, countersigned: true },
      POLICY
    )

    expect(schedule).toEqual({ status: "never", reason: "countersigned" })
  })

  test("an unsigned contract follows the financial window", () => {
    const schedule = resolvePurgeSchedule(
      { kind: "contract", deletedAt: DELETED_AT, countersigned: false },
      POLICY
    )

    expect(schedule).toEqual({
      status: "scheduled",
      dueAt: new Date("2026-07-30T12:00:00.000Z"),
      heldByDocuments: false
    })
  })
})

describe("clients", () => {
  test("a client no document names follows its own window", () => {
    const schedule = resolvePurgeSchedule(
      { kind: "client", deletedAt: DELETED_AT, namingDocuments: [] },
      POLICY
    )

    expect(schedule).toEqual({
      status: "scheduled",
      dueAt: new Date("2026-05-31T12:00:00.000Z"),
      heldByDocuments: false
    })
  })

  test("documents naming a client hold it to the latest of their windows", () => {
    const schedule = resolvePurgeSchedule(
      {
        kind: "client",
        deletedAt: DELETED_AT,
        namingDocuments: [
          document({ window: "trash" }),
          document({ deletedAt: new Date("2026-05-10T12:00:00.000Z") })
        ]
      },
      POLICY
    )

    expect(schedule).toEqual({
      status: "scheduled",
      dueAt: new Date("2026-08-08T12:00:00.000Z"),
      heldByDocuments: true
    })
  })

  test("a client deleted after its documents keeps its own later date", () => {
    const schedule = resolvePurgeSchedule(
      {
        kind: "client",
        deletedAt: new Date("2026-09-01T12:00:00.000Z"),
        namingDocuments: [document({ window: "trash" })]
      },
      POLICY
    )

    expect(schedule).toEqual({
      status: "scheduled",
      dueAt: new Date("2026-10-01T12:00:00.000Z"),
      heldByDocuments: false
    })
  })

  test("a live document holds the client until it is deleted too", () => {
    const schedule = resolvePurgeSchedule(
      {
        kind: "client",
        deletedAt: DELETED_AT,
        namingDocuments: [document({ deletedAt: null }), document({ deletedAt: null }), document()]
      },
      POLICY
    )

    expect(schedule).toEqual({ status: "heldByLiveDocuments", documentCount: 2 })
  })

  test("a countersigned contract naming the client keeps it forever, live or deleted", () => {
    const schedule = resolvePurgeSchedule(
      {
        kind: "client",
        deletedAt: DELETED_AT,
        namingDocuments: [document({ deletedAt: null }), document({ countersigned: true })]
      },
      POLICY
    )

    expect(schedule).toEqual({ status: "never", reason: "countersignedContractNamesClient" })
  })

  test("a naming document under an unset window leaves the client unscheduled", () => {
    const schedule = resolvePurgeSchedule(
      { kind: "client", deletedAt: DELETED_AT, namingDocuments: [document()] },
      { trashDays: 30, financialDays: null }
    )

    expect(schedule).toEqual({ status: "windowUnset" })
  })

  test("an unset client window leaves it unscheduled even with no documents", () => {
    const schedule = resolvePurgeSchedule(
      { kind: "client", deletedAt: DELETED_AT, namingDocuments: [] },
      { trashDays: null, financialDays: 90 }
    )

    expect(schedule).toEqual({ status: "windowUnset" })
  })
})

describe("due", () => {
  test("a scheduled record is due once its date has passed", () => {
    const schedule = resolvePurgeSchedule(
      { kind: "record", window: "trash", deletedAt: DELETED_AT },
      POLICY
    )

    expect(isPurgeDue(schedule, new Date("2026-05-31T12:00:00.000Z"))).toBe(true)
    expect(isPurgeDue(schedule, new Date("2026-05-31T11:59:59.999Z"))).toBe(false)
  })

  test("nothing but a scheduled record is ever due", () => {
    const now = new Date("2030-01-01T00:00:00.000Z")

    expect(isPurgeDue({ status: "windowUnset" }, now)).toBe(false)
    expect(isPurgeDue({ status: "heldByLiveDocuments", documentCount: 1 }, now)).toBe(false)
    expect(isPurgeDue({ status: "never", reason: "countersigned" }, now)).toBe(false)
  })
})
