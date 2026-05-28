import { expect, test } from "vitest"

import { groupEncryptedColumns } from "../columns"
import { resolveRotationProgress } from "../progress"

test("groups encrypted columns by table for table-scoped transactions", () => {
  const grouped = groupEncryptedColumns([
    { table: "settings", column: "smtp_pass" },
    { table: "clients", column: "notes" },
    { table: "settings", column: "payment_iban" }
  ])

  expect(grouped).toEqual([
    { table: "clients", columns: ["notes"] },
    { table: "settings", columns: ["payment_iban", "smtp_pass"] }
  ])
})

test("resumes from table completion markers in the latest rotation audit trail", () => {
  const startedAt = new Date("2026-05-26T10:00:00.000Z")
  const progress = resolveRotationProgress([
    {
      event: "instance.key_rotation.started",
      createdAt: startedAt,
      metadata: { operationId: "older" }
    },
    {
      event: "instance.key_rotation.completed",
      createdAt: new Date("2026-05-26T10:01:00.000Z"),
      metadata: { operationId: "older" }
    },
    {
      event: "instance.key_rotation.started",
      createdAt: new Date("2026-05-26T11:00:00.000Z"),
      metadata: { operationId: "current" }
    },
    {
      event: "instance.key_rotation.table_completed",
      createdAt: new Date("2026-05-26T11:02:00.000Z"),
      metadata: { operationId: "current", table: "clients" }
    },
    {
      event: "instance.key_rotation.aborted",
      createdAt: new Date("2026-05-26T11:03:00.000Z"),
      metadata: { operationId: "current", reason: "interrupted" }
    }
  ])

  expect(progress.ok).toBe(true)
  if (progress.ok) {
    expect(progress.operationId).toBe("current")
    expect([...progress.completedTables]).toEqual(["clients"])
  }
})

test("refuses resume when the latest rotation already completed", () => {
  const progress = resolveRotationProgress([
    {
      event: "instance.key_rotation.started",
      createdAt: new Date("2026-05-26T10:00:00.000Z"),
      metadata: { operationId: "complete" }
    },
    {
      event: "instance.key_rotation.completed",
      createdAt: new Date("2026-05-26T10:01:00.000Z"),
      metadata: { operationId: "complete" }
    }
  ])

  expect(progress.ok).toBe(false)
})
