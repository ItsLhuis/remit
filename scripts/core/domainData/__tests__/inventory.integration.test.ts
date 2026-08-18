import { getTableName, is } from "drizzle-orm"
import { PgTable } from "drizzle-orm/pg-core"

import { expect, test } from "vitest"

import * as schema from "@/database/schema"

import { DOMAIN_DATA_INVENTORY } from "../inventory"

// An integration test rather than a unit one only because `@/database/schema` validates the
// environment at import time (`lib/config/env.ts` exits the process on a miss), which the unit
// project deliberately does not provide. Nothing here touches the database.

function schemaTableNames(): string[] {
  return Object.values(schema)
    .filter((value) => is(value, PgTable))
    .map((table) => getTableName(table))
    .sort()
}

test("classifies every table exported from the schema barrel", () => {
  const classified = DOMAIN_DATA_INVENTORY.map((entry) => entry.table).sort()

  expect(classified).toEqual(schemaTableNames())
})

test("names each table exactly once", () => {
  const tables = DOMAIN_DATA_INVENTORY.map((entry) => entry.table)

  expect(new Set(tables).size).toBe(tables.length)
})

test("points each entry at the schema export for the table it names", () => {
  for (const entry of DOMAIN_DATA_INVENTORY) {
    expect(getTableName(schema[entry.key])).toBe(entry.table)
  }
})

test("deletes every seeded table on a reseed so a fresh seed cannot collide", () => {
  const seededButKept = DOMAIN_DATA_INVENTORY.filter(
    (entry) => entry.seed === "seed" && entry.reseed === "keep"
  ).map((entry) => entry.table)

  expect(seededButKept).toEqual(["settings"])
})

test("keeps the tables a reset must never touch", () => {
  const kept = DOMAIN_DATA_INVENTORY.filter((entry) => entry.reset === "keep").map(
    (entry) => entry.table
  )

  // Better Auth-owned tables plus the instance configuration a reset exists to preserve. Adding a
  // table here is a decision to keep operator data across a reset; removing one deletes it.
  expect(kept.sort()).toEqual(
    [
      "accounts",
      "audit_logs",
      "invitations",
      "members",
      "organizations",
      "sessions",
      "settings",
      "tax_rates",
      "templates",
      "two_factors",
      "users",
      "verifications"
    ].sort()
  )
})

test("orders children before the parents they reference", () => {
  const order: string[] = DOMAIN_DATA_INVENTORY.map((entry) => entry.table)
  const positionOf = (table: string) => order.indexOf(table)

  expect(positionOf("line_items")).toBeLessThan(positionOf("invoices"))
  expect(positionOf("payments")).toBeLessThan(positionOf("invoices"))
  expect(positionOf("credit_notes")).toBeLessThan(positionOf("invoices"))
  expect(positionOf("contract_signatures")).toBeLessThan(positionOf("contracts"))
  expect(positionOf("proposal_otps")).toBeLessThan(positionOf("proposals"))
  expect(positionOf("invoices")).toBeLessThan(positionOf("projects"))
  expect(positionOf("tasks")).toBeLessThan(positionOf("projects"))
  expect(positionOf("time_entries")).toBeLessThan(positionOf("projects"))
  expect(positionOf("expenses")).toBeLessThan(positionOf("projects"))
  expect(positionOf("projects")).toBeLessThan(positionOf("clients"))
  expect(positionOf("clients")).toBeLessThan(positionOf("uploads"))
})
