import { beforeEach, describe, expect, test, vi } from "vitest"

import { eq, isNotNull, isNull } from "drizzle-orm"

import { auditLogs, taxRates } from "@/database/schema"

import { database } from "@/tests/integration/database"
import { makeUser } from "@/tests/factories"

const mocks = vi.hoisted(() => ({
  getCurrentRole: vi.fn(),
  getSession: vi.fn(),
  headers: vi.fn(),
  loggerError: vi.fn(),
  revalidatePath: vi.fn()
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}))

vi.mock("next/headers", () => ({
  headers: mocks.headers
}))

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mocks.getSession
    }
  }
}))

vi.mock("@/lib/auth/session", () => ({
  getCurrentRole: mocks.getCurrentRole
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    fatal: vi.fn(),
    warn: vi.fn()
  }
}))

const ownerId = "00000000-0000-4000-8000-000000000301"
const ownerEmail = "owner-tax-rates@example.com"

const validTaxRate = {
  name: "IVA 23%",
  percentage: 23
}

describe("tax rate mutations", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })

    mocks.headers.mockResolvedValue(
      new Headers({
        "user-agent": "Vitest",
        "x-forwarded-for": "203.0.113.40, 198.51.100.2"
      })
    )
    mocks.getSession.mockResolvedValue({
      user: { id: ownerId, email: ownerEmail }
    })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("creates a tax rate for future document line items", async () => {
    const { createTaxRate } = await import("../mutations")

    const result = await createTaxRate(validTaxRate)
    const [taxRateRow] = await database.select().from(taxRates)
    const auditRows = await database.select().from(auditLogs)

    expect(result).toEqual({
      data: {
        taxRate: expect.objectContaining({
          name: "IVA 23%",
          percentage: 23,
          isDefault: false
        })
      }
    })
    expect(taxRateRow).toEqual(
      expect.objectContaining({
        name: "IVA 23%",
        percentage: "23.00",
        isDefault: false,
        deletedAt: null
      })
    )
    expect(auditRows[0]?.event).toBe("settings.taxRates.created")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings/tax-rates")
  })

  test("edits an active tax rate without changing its default state", async () => {
    const { updateTaxRate } = await import("../mutations")

    const [existingTaxRate] = await database
      .insert(taxRates)
      .values({
        name: "IVA 23%",
        percentage: "23.00",
        isDefault: true
      })
      .returning({ id: taxRates.id })

    const result = await updateTaxRate({
      id: existingTaxRate?.id,
      name: "Standard VAT",
      percentage: 21.5
    })
    const [taxRateRow] = await database.select().from(taxRates)

    expect(result).toEqual({
      data: {
        taxRate: expect.objectContaining({
          id: existingTaxRate?.id,
          name: "Standard VAT",
          percentage: 21.5,
          isDefault: true
        })
      }
    })
    expect(taxRateRow).toEqual(
      expect.objectContaining({
        name: "Standard VAT",
        percentage: "21.50",
        isDefault: true
      })
    )
  })

  test("transactionally swaps the active default tax rate", async () => {
    const { setDefaultTaxRate } = await import("../mutations")

    const [oldDefault] = await database
      .insert(taxRates)
      .values({
        name: "IVA 23%",
        percentage: "23.00",
        isDefault: true
      })
      .returning({ id: taxRates.id })
    const [newDefault] = await database
      .insert(taxRates)
      .values({
        name: "Reduced",
        percentage: "6.00"
      })
      .returning({ id: taxRates.id })

    const result = await setDefaultTaxRate({ id: newDefault?.id })
    const taxRateRows = await database.select().from(taxRates)
    const activeDefaultRows = await database
      .select()
      .from(taxRates)
      .where(eq(taxRates.isDefault, true))

    expect(result).toEqual({
      data: {
        taxRate: expect.objectContaining({
          id: newDefault?.id,
          isDefault: true
        })
      }
    })
    expect(taxRateRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: oldDefault?.id, isDefault: false }),
        expect.objectContaining({ id: newDefault?.id, isDefault: true })
      ])
    )
    expect(activeDefaultRows).toHaveLength(1)
  })

  test("soft deletes a tax rate and leaves the database row in place", async () => {
    const { deleteTaxRate } = await import("../mutations")

    const [existingTaxRate] = await database
      .insert(taxRates)
      .values({
        name: "IVA 23%",
        percentage: "23.00",
        isDefault: true
      })
      .returning({ id: taxRates.id })

    const result = await deleteTaxRate({ id: existingTaxRate?.id })
    const deletedRows = await database.select().from(taxRates).where(isNotNull(taxRates.deletedAt))
    const activeRows = await database.select().from(taxRates).where(isNull(taxRates.deletedAt))

    expect(result).toEqual({ data: { id: existingTaxRate?.id } })
    expect(deletedRows).toEqual([
      expect.objectContaining({
        id: existingTaxRate?.id,
        isDefault: false
      })
    ])
    expect(activeRows).toHaveLength(0)
  })

  test("rejects simultaneous active default tax rates at the database constraint", async () => {
    await database.insert(taxRates).values({
      name: "IVA 23%",
      percentage: "23.00",
      isDefault: true
    })

    await expect(
      database.insert(taxRates).values({
        name: "Reduced",
        percentage: "6.00",
        isDefault: true
      })
    ).rejects.toMatchObject({
      cause: {
        code: "23505",
        constraint_name: "uq_tax_rates_default"
      }
    })
  })
})
