import { randomUUID } from "node:crypto"

import { eq } from "drizzle-orm"

import { expect, test } from "vitest"

import { auditLogs } from "@/database/schema"

import { database } from "@/tests/integration/database"

import { writeAudit } from "../index"

// The `audit_logs_no_update` and `audit_logs_no_delete` triggers from `0001_insert_only_guards.sql`.
// Nothing in `database/schema/auditLogs.ts` can declare them, so this suite is what notices a
// migration history without them.
async function makeAuditEntry(): Promise<string> {
  const event = `probe.${randomUUID()}`

  await writeAudit(event, { metadata: { probe: true } })

  const [entry] = await database
    .select({ id: auditLogs.id })
    .from(auditLogs)
    .where(eq(auditLogs.event, event))

  if (!entry) throw new Error("makeAuditEntry: insert failed")

  return entry.id
}

// Drizzle wraps a driver failure and puts the SQL in `message`, so the trigger's own RAISE text
// survives one level down on `cause`. Walking the whole chain keeps the assertions working whichever
// layer surfaces it.
function describeError(error: unknown): string {
  const messages: string[] = []

  for (let current: unknown = error; current instanceof Error; current = current.cause) {
    messages.push(current.message)
  }

  return messages.join(" | ")
}

async function captureRejection(operation: Promise<unknown>): Promise<string> {
  try {
    await operation
  } catch (error) {
    return describeError(error)
  }

  throw new Error("Expected the statement to be rejected by the guard")
}

test("stores an audit entry when it is inserted", async () => {
  const entryId = await makeAuditEntry()

  const [row] = await database
    .select({ metadata: auditLogs.metadata })
    .from(auditLogs)
    .where(eq(auditLogs.id, entryId))

  expect(row?.metadata).toEqual({ probe: true })
})

test("rejects the statement when an audit entry is updated", async () => {
  const entryId = await makeAuditEntry()

  const failure = await captureRejection(
    database.update(auditLogs).set({ event: "probe.rewritten" }).where(eq(auditLogs.id, entryId))
  )

  expect(failure).toMatch(/audit_logs is insert-only: UPDATE operations are not permitted/)
})

test("rejects the statement when an audit entry is deleted", async () => {
  const entryId = await makeAuditEntry()

  const failure = await captureRejection(
    database.delete(auditLogs).where(eq(auditLogs.id, entryId))
  )

  expect(failure).toMatch(/audit_logs is insert-only: DELETE operations are not permitted/)
})
