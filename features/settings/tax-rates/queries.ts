import { asc, desc, isNull } from "drizzle-orm"

import { database } from "@/database"
import { taxRates } from "@/database/schema"

import { type TaxRateListItem } from "./schemas"

type TaxRateRow = {
  id: string
  name: string
  percentage: string
  isDefault: boolean
}

const taxRateListColumns = {
  id: taxRates.id,
  name: taxRates.name,
  percentage: taxRates.percentage,
  isDefault: taxRates.isDefault
}

export async function getTaxRates(): Promise<TaxRateListItem[]> {
  const rows = await database
    .select(taxRateListColumns)
    .from(taxRates)
    .where(isNull(taxRates.deletedAt))
    .orderBy(desc(taxRates.isDefault), asc(taxRates.name))

  return rows.map(toTaxRateListItem)
}

type TaxRateDefaults = {
  defaultLocale: string
}

export async function getTaxRateDefaults(): Promise<TaxRateDefaults> {
  const row = await database.query.settings.findFirst({
    columns: { defaultLocale: true }
  })

  return { defaultLocale: row?.defaultLocale ?? "en" }
}

export function toTaxRateListItem(row: TaxRateRow): TaxRateListItem {
  return {
    id: row.id,
    name: row.name,
    percentage: Number(row.percentage),
    isDefault: row.isDefault
  }
}
