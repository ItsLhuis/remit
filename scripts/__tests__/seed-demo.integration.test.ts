import { expect, test } from "vitest"

import { count } from "drizzle-orm"

import * as schema from "@/database/schema"
import { clients, members, organizations, settings, taxRates, users } from "@/database/schema"

import { database } from "@/tests/integration/database"

import { runSeedDemo } from "../seed-demo"

const ownerUserId = "11111111-1111-4111-8111-111111111111"
const organizationId = "22222222-2222-4222-8222-222222222222"

test("makes no database writes when dry-run is used", async () => {
  await createOwner()

  const result = await runSeedDemo(database, schema, {
    dryRun: true,
    help: false,
    reseed: false,
    seed: 42,
    yes: true
  })

  expect(result.wrote).toBe(false)
  expect(await tableCount(clients)).toBe(0)
  expect(await tableCount(settings)).toBe(0)
  expect(await tableCount(taxRates)).toBe(0)
})

test("refuses to seed over existing domain rows without reseed", async () => {
  await createOwner()

  await runSeedDemo(database, schema, {
    dryRun: false,
    help: false,
    reseed: false,
    seed: 42,
    yes: true
  })

  await expect(
    runSeedDemo(database, schema, {
      dryRun: false,
      help: false,
      reseed: false,
      seed: 42,
      yes: true
    })
  ).rejects.toThrow(/clients \(6\)/)

  expect(await tableCount(clients)).toBe(6)
  expect(await tableCount(settings)).toBe(1)
})

async function createOwner(): Promise<void> {
  await database.insert(users).values({
    id: ownerUserId,
    name: "Owner User",
    email: "owner@example.test",
    emailVerified: true,
    twoFactorEnabled: true,
    mustChangePassword: false
  })

  await database.insert(organizations).values({
    id: organizationId,
    name: "Owner Organization",
    slug: "owner-organization"
  })

  await database.insert(members).values({
    userId: ownerUserId,
    organizationId,
    role: "owner"
  })
}

async function tableCount(
  table: typeof clients | typeof settings | typeof taxRates
): Promise<number> {
  const [row] = await database.select({ value: count() }).from(table)

  return row?.value ?? 0
}
