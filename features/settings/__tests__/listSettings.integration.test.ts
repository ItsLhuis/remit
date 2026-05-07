import { describe, expect, test } from "vitest"

import { settings } from "@/database/schema"

import { database } from "@/tests/integration/database"

describe("settings table", () => {
  test("inserts a row with defaults and retrieves it", async () => {
    await database.insert(settings).values({})

    const rows = await database.select().from(settings)

    expect(rows).toHaveLength(1)
    expect(rows[0].defaultCurrency).toBe("EUR")
    expect(rows[0].invoicePrefix).toBe("INV-")
    expect(rows[0].nextInvoiceNumber).toBe(1)
  })

  test("begins each test with an empty table (truncation hook is working)", async () => {
    const rows = await database.select().from(settings)

    expect(rows).toHaveLength(0)
  })
})
