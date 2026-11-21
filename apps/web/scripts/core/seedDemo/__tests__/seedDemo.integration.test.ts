import { count } from "drizzle-orm"

import { expect, test } from "vitest"

import * as schema from "@/database/schema"
import {
  clients,
  contractSignatures,
  members,
  organizations,
  settings,
  taxRates,
  users
} from "@/database/schema"

import { database } from "@/tests/integration/database"

import { runSeedDemo } from "../runSeedDemo"

const ownerUserId = "11111111-1111-4111-8111-111111111111"
const organizationId = "22222222-2222-4222-8222-222222222222"

test("makes no database writes when dry-run is used", async () => {
  await createOwner()

  const result = await runSeedDemo(database, schema, {
    countOverrides: {},
    dryRun: true,
    help: false,
    reseed: false,
    seed: 42,
    size: "small",
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
    countOverrides: {},
    dryRun: false,
    help: false,
    reseed: false,
    seed: 42,
    size: "small",
    yes: true
  })

  await expect(
    runSeedDemo(database, schema, {
      countOverrides: {},
      dryRun: false,
      help: false,
      reseed: false,
      seed: 42,
      size: "small",
      yes: true
    })
  ).rejects.toThrow(/clients \(6\)/)

  expect(await tableCount(clients)).toBe(6)
  expect(await tableCount(settings)).toBe(1)
})

test("replaces domain data with reseed even when a contract has been signed", async () => {
  await createOwner()

  await runSeedDemo(database, schema, {
    countOverrides: {},
    dryRun: false,
    help: false,
    reseed: false,
    seed: 42,
    size: "small",
    yes: true
  })

  const contract = await database.query.contracts.findFirst()

  if (!contract) throw new Error("Expected the first seed run to create a contract")

  await database.insert(contractSignatures).values({
    contractId: contract.id,
    signerName: "Signer",
    signerEmail: "signer@example.test",
    consentText: "I agree",
    ipAddress: "203.0.113.10",
    userAgent: "vitest"
  })

  const result = await runSeedDemo(database, schema, {
    countOverrides: {},
    dryRun: false,
    help: false,
    reseed: true,
    seed: 42,
    size: "small",
    yes: true
  })

  expect(result.wrote).toBe(true)
  expect(await tableCount(contractSignatures)).toBe(0)
  expect(await tableCount(clients)).toBe(6)
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
  table: typeof clients | typeof contractSignatures | typeof settings | typeof taxRates
): Promise<number> {
  const [row] = await database.select({ value: count() }).from(table)

  return row?.value ?? 0
}
