import { formatDay } from "@/lib/utils"

// The `client.*`, `business.*` and `payment.*` halves of every document's merge data, which are
// identical across invoices, proposals, contracts and credit notes because they describe the same
// two parties and the same bank details whatever document they appear on.
//
// Extracted only once a third builder needed them (`code-style.md`'s abstraction threshold): with
// two it was a coincidence, with four it is a contract. Each feature still owns its own
// document-specific values, which genuinely differ — an invoice has an amount due, a proposal has a
// validity date, and neither belongs here.
//
// Every builder must spread all of the groups its type whitelists in
// `services/mergeVariables.ts`. A token whose key is missing renders as its raw `{{...}}` source in
// the finished document rather than as blank, so a missing group is visible on a document a client
// receives.

export type MergeClient = {
  name: string
  email: string
  phone: string | null
  website: string | null
  taxId: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
  currency: string | null
}

export type MergeBusiness = {
  name: string | null
  email: string | null
  phone: string | null
  website: string | null
  taxId: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
}

// `iban` is decrypted by the server-side caller before it reaches here, which is why this takes a
// plain string: a pure service never touches the encryption helpers (ADR-0005, ADR-0007).
export type MergePayment = {
  iban: string | null
  bankName: string | null
  instructions: string | null
  termsDays: number | null
}

export function buildClientMergeValues(client: MergeClient | null): Record<string, string> {
  return {
    "client.name": mergeText(client?.name),
    "client.email": mergeText(client?.email),
    "client.phone": mergeText(client?.phone),
    "client.website": mergeText(client?.website),
    "client.taxId": mergeText(client?.taxId),
    "client.addressLine1": mergeText(client?.addressLine1),
    "client.addressLine2": mergeText(client?.addressLine2),
    "client.city": mergeText(client?.city),
    "client.state": mergeText(client?.state),
    "client.postalCode": mergeText(client?.postalCode),
    "client.country": mergeText(client?.country),
    "client.currency": mergeText(client?.currency)
  }
}

export function buildBusinessMergeValues(business: MergeBusiness): Record<string, string> {
  return {
    "business.name": mergeText(business.name),
    "business.email": mergeText(business.email),
    "business.phone": mergeText(business.phone),
    "business.website": mergeText(business.website),
    "business.taxId": mergeText(business.taxId),
    "business.addressLine1": mergeText(business.addressLine1),
    "business.addressLine2": mergeText(business.addressLine2),
    "business.city": mergeText(business.city),
    "business.state": mergeText(business.state),
    "business.postalCode": mergeText(business.postalCode),
    "business.country": mergeText(business.country)
  }
}

export function buildPaymentMergeValues(payment: MergePayment): Record<string, string> {
  return {
    "payment.iban": mergeText(payment.iban),
    "payment.bankName": mergeText(payment.bankName),
    "payment.instructions": mergeText(payment.instructions),
    "payment.termsDays": payment.termsDays === null ? "" : String(payment.termsDays)
  }
}

export function mergeText(value: string | null | undefined): string {
  return value ?? ""
}

export function mergeDay(value: Date | null, locale: string): string {
  return value ? formatDay(value, locale) : ""
}
