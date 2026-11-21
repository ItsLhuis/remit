import { expect, test } from "vitest"

import { taxRates } from "@/database/schema"

import { database } from "@/tests/integration/database"

test("excludes soft-deleted tax rates from the settings list", async () => {
  await database.insert(taxRates).values([
    {
      name: "IVA 23%",
      percentage: "23.00",
      isDefault: true
    },
    {
      name: "Reduced",
      percentage: "6.00"
    },
    {
      name: "Deleted",
      percentage: "13.00",
      deletedAt: new Date("2026-06-01T10:00:00.000Z")
    }
  ])

  const { getTaxRates } = await import("../queries")

  const result = await getTaxRates()

  expect(result).toEqual([
    expect.objectContaining({ name: "IVA 23%", percentage: 23, isDefault: true }),
    expect.objectContaining({ name: "Reduced", percentage: 6, isDefault: false })
  ])
})
