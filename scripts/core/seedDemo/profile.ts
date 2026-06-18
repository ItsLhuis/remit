import { faker } from "@faker-js/faker"

import { MAX_DEMO_SEED_INVOICES, MAX_DEMO_SEED_PROJECTS } from "./inventory"
import { type DemoSeedCountOverrides, type DemoSeedSize } from "./types"

const CUSTOM_PROJECTS_PER_CLIENT = 4
const CUSTOM_INVOICES_PER_PROJECT = 5

export type DemoSeedSizeProfile = {
  clientCount: number
  projectCount: number
  tasksPerProject: number
  timeEntriesPerProject: number
  leadCount: number
  proposalCount: number
  invoiceCount: number
  creditNoteCount: number
  contractCount: number
  recurringInvoiceCount: number
}

export const demoSeedSizeProfiles: Record<DemoSeedSize, DemoSeedSizeProfile> = {
  small: {
    clientCount: 6,
    projectCount: 11,
    tasksPerProject: 2,
    timeEntriesPerProject: 2,
    leadCount: 6,
    proposalCount: 5,
    invoiceCount: 6,
    creditNoteCount: 1,
    contractCount: 2,
    recurringInvoiceCount: 2
  },
  medium: {
    clientCount: 12,
    projectCount: 22,
    tasksPerProject: 2,
    timeEntriesPerProject: 2,
    leadCount: 12,
    proposalCount: 10,
    invoiceCount: 12,
    creditNoteCount: 2,
    contractCount: 4,
    recurringInvoiceCount: 4
  },
  large: {
    clientCount: 24,
    projectCount: 44,
    tasksPerProject: 2,
    timeEntriesPerProject: 2,
    leadCount: 24,
    proposalCount: 20,
    invoiceCount: 24,
    creditNoteCount: 4,
    contractCount: 8,
    recurringInvoiceCount: 8
  }
}

export type MarketProfile = {
  country: string
  currency: string
  locale: string
  city: string
  state: string | null
  postalCodeFormat: "us" | "pt" | "gb" | "de" | "fr"
  phonePrefix: string
  taxId: string
}

export const marketProfiles: MarketProfile[] = [
  {
    country: "US",
    currency: "USD",
    locale: "en-US",
    city: "San Francisco",
    state: "CA",
    postalCodeFormat: "us",
    phonePrefix: "+1 415",
    taxId: "US"
  },
  {
    country: "PT",
    currency: "EUR",
    locale: "pt-PT",
    city: "Lisbon",
    state: null,
    postalCodeFormat: "pt",
    phonePrefix: "+351 21",
    taxId: "PT"
  },
  {
    country: "GB",
    currency: "GBP",
    locale: "en-GB",
    city: "London",
    state: null,
    postalCodeFormat: "gb",
    phonePrefix: "+44 20",
    taxId: "GB"
  },
  {
    country: "DE",
    currency: "EUR",
    locale: "de-DE",
    city: "Berlin",
    state: null,
    postalCodeFormat: "de",
    phonePrefix: "+49 30",
    taxId: "DE"
  },
  {
    country: "FR",
    currency: "EUR",
    locale: "fr-FR",
    city: "Paris",
    state: null,
    postalCodeFormat: "fr",
    phonePrefix: "+33 1",
    taxId: "FR"
  },
  {
    country: "US",
    currency: "USD",
    locale: "en-US",
    city: "New York",
    state: "NY",
    postalCodeFormat: "us",
    phonePrefix: "+1 212",
    taxId: "US"
  }
]

export function buildSeedSizeProfile(
  size: DemoSeedSize,
  countOverrides: DemoSeedCountOverrides
): DemoSeedSizeProfile {
  const base = demoSeedSizeProfiles[size]
  const clientCount = countOverrides.clients ?? base.clientCount
  const projectCount =
    countOverrides.projects ??
    (countOverrides.clients
      ? Math.min(clientCount * CUSTOM_PROJECTS_PER_CLIENT, MAX_DEMO_SEED_PROJECTS)
      : base.projectCount)
  const invoiceCount =
    countOverrides.invoices ??
    (countOverrides.clients || countOverrides.projects
      ? Math.min(projectCount * CUSTOM_INVOICES_PER_PROJECT, MAX_DEMO_SEED_INVOICES)
      : base.invoiceCount)

  return {
    clientCount,
    projectCount,
    tasksPerProject: base.tasksPerProject,
    timeEntriesPerProject: base.timeEntriesPerProject,
    leadCount: Math.max(base.leadCount, clientCount),
    proposalCount: Math.min(
      Math.max(base.proposalCount, Math.ceil(projectCount * 0.45)),
      projectCount
    ),
    invoiceCount,
    creditNoteCount: Math.min(
      Math.max(base.creditNoteCount, Math.ceil(invoiceCount / 6)),
      invoiceCount
    ),
    contractCount: Math.min(Math.max(base.contractCount, Math.ceil(clientCount / 3)), projectCount),
    recurringInvoiceCount: Math.min(
      Math.max(base.recurringInvoiceCount, Math.ceil(clientCount / 3)),
      clientCount
    )
  }
}

export function hasSeedCountOverrides(countOverrides: DemoSeedCountOverrides): boolean {
  return Object.values(countOverrides).some((value) => value !== undefined)
}

export function marketProfileAt(index: number): MarketProfile {
  const market = marketProfiles[index % marketProfiles.length]

  if (!market) {
    throw new Error("Demo seed market profile inventory is empty.")
  }

  return market
}

export function postalCodeForMarket(format: MarketProfile["postalCodeFormat"]): string {
  switch (format) {
    case "us":
      return faker.location.zipCode("#####")
    case "pt":
      return `${faker.string.numeric(4)}-${faker.string.numeric(3)}`
    case "gb":
      return `${faker.string.alpha({ length: 1, casing: "upper" })}${faker.string.numeric(1)} ${faker.string.numeric(1)}${faker.string.alpha({ length: 2, casing: "upper" })}`
    case "de":
    case "fr":
      return faker.string.numeric(5)
  }
}
