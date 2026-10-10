import { randomUUID } from "node:crypto"

import { eq } from "drizzle-orm"

import { afterAll, expect, test } from "vitest"

import { getRateLimitConnection } from "@/lib/rateLimit/connection"
import { toTripKeys } from "@/lib/rateLimit/tripWindow"

import { auditLogs } from "@/database/schema"

import { database } from "@/tests/integration/database"

import { writeRateLimitTripAudit } from "../index"

afterAll(async () => {
  const connection = await getRateLimitConnection()

  connection.disconnect()
})

async function tripEntries() {
  return database
    .select({ metadata: auditLogs.metadata })
    .from(auditLogs)
    .where(eq(auditLogs.event, "auth.rate_limit.tripped"))
}

test("a flood from one address writes one entry per window, and the next says how big it was", async () => {
  const trip = { key: `flood:${randomUUID()}`, windowMs: 60_000 }

  for (let index = 0; index < 30; index += 1) {
    await writeRateLimitTripAudit(trip, { ipAddress: "203.0.113.9", metadata: { route: "/x" } })
  }

  const afterFlood = await tripEntries()

  // Closes the window the way its expiry would, without the test waiting a minute for it.
  const connection = await getRateLimitConnection()

  await connection.del(toTripKeys(trip.key)[0])

  await writeRateLimitTripAudit(trip, { ipAddress: "203.0.113.9", metadata: { route: "/x" } })

  const afterNextWindow = await tripEntries()

  expect(afterFlood).toEqual([{ metadata: { route: "/x", suppressedSincePreviousEntry: 0 } }])
  expect(afterNextWindow).toHaveLength(2)
  expect(afterNextWindow).toContainEqual({
    metadata: { route: "/x", suppressedSincePreviousEntry: 29 }
  })
})
