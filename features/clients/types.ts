import { type ClientFormValues, type ClientListQuery } from "./schemas"
import { type ClientBillingPoint, type ClientsSummary, type ClientHealth } from "./services"

export type ClientListItem = {
  id: string
  name: string
  email: string
  // The storage key, not a URL: `resolveStorageUrl` runs in the browser and needs the raw key, and
  // the client image lives in the public bucket where that helper is the correct reader.
  imageStorageKey: string | null
  currency: string
  outstandingBalanceCents: number
  invoiceCount: number
  health: ClientHealth
  createdAt: Date
  deletedAt: Date | null
}

export type ClientContact = {
  id: string
  clientId: string
  name: string
  email: string
  phone: string
  role: string
  isPrimary: boolean
  createdAt: Date
}

export type ClientFilterOptions = {
  currencies: string[]
}

export type ClientAddress = {
  line1: string
  line2: string
  city: string
  state: string
  postalCode: string
  country: string
}

export type ClientRelatedResourceCounts = {
  projects: number
  invoices: number
  recurringInvoices: number
}

export type ClientDetail = {
  id: string
  name: string
  email: string
  phone: string
  website: string
  taxId: string
  currency: string
  address: ClientAddress
  // The one encrypted column that is deliberately allowed to leave the server. `security.md` lists
  // `clients.notes` alongside the SMTP, Stripe and IBAN secrets, and the settings read models blank
  // those out on purpose (`settings/payment/queries.ts`), so this looks like the same violation and
  // is not: notes are the owner's own working record, written and read by them in the workspace,
  // and a read model that withheld them would leave the field permanently uneditable. What the
  // encryption buys here is confidentiality at rest, not from the authenticated owner. It is still
  // excluded from audit diffing — see `mutations.ts`'s `auditFields`.
  notes: string
  imageStorageKey: string | null
  // The portal URL, or null when this client has no portal. The token itself never reaches the read
  // model — the path is the only form of it the workspace needs, and it is what the copy control
  // hands out. Null covers both "never enabled" and "revoked": for a client those are one state
  // (ADR-0029).
  portalPath: string | null
  outstandingBalanceCents: number
  health: ClientHealth
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
  relatedResources: ClientRelatedResourceCounts
  billingTrend: ClientBillingPoint[]
}

export type ClientFormData = ClientFormValues & {
  id: string
}

export type ClientDefaults = {
  defaultCurrency: string
  defaultLocale: string
}

export type ClientListPageData = {
  clients: ClientListItem[]
  rowCount: number
  summary: ClientsSummary
  query: ClientListQuery
  filterOptions: ClientFilterOptions
  defaults: ClientDefaults
}
