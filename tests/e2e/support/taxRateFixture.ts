import { randomUUID } from "node:crypto"

import { loadAppContext } from "./appContext"

type SeededTaxRate = {
  name: string
  percentage: number
}

const PERCENTAGE = 20

// Seeded rather than created through /settings/tax-rates: a tax rate is a precondition of the
// proposal this flow is about, not a step in it, and driving the settings form first would make a
// failure there read as a failure of the money path.
export async function seedTaxRate(): Promise<SeededTaxRate> {
  const { database, schema } = await loadAppContext()

  const name = `E2E VAT ${randomUUID().slice(0, 8)}`

  // Never the default rate: `uq_tax_rates_default` allows one live default per instance, so a
  // fixture claiming it would collide with the instance's own.
  await database.insert(schema.taxRates).values({
    name,
    percentage: String(PERCENTAGE),
    isDefault: false
  })

  return { name, percentage: PERCENTAGE }
}
