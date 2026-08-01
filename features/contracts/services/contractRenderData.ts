import { formatDay } from "@/lib/utils"

import { type TemplateRenderData } from "@/features/templates"

// The merge values a contract document renders with, assembled from the contract row and the
// records it points at. It mirrors `MERGE_VARIABLES.contract` in
// `features/templates/services/mergeVariables.ts` exactly: every variable that type whitelists gets
// a key here, because a token whose key is missing renders as the raw `{{...}}` source instead of
// blank. The two lists have to be edited together.

export type ContractRenderContract = {
  number: string
  title: string
  effectiveFrom: Date | null
  effectiveUntil: Date | null
  issuedAt: Date | null
  terminationReason: string | null
}

export type ContractRenderClient = {
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

export type ContractRenderBusiness = {
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

export type ContractRenderDataInput = {
  contract: ContractRenderContract
  client: ContractRenderClient | null
  business: ContractRenderBusiness
  // Already translated by the caller: the status is a domain enum and this function stays free of
  // the i18n singleton so it can be exercised without one.
  statusLabel: string
  locale: string
}

export function buildContractRenderData({
  contract,
  client,
  business,
  statusLabel,
  locale
}: ContractRenderDataInput): TemplateRenderData {
  return {
    values: {
      "client.name": text(client?.name),
      "client.email": text(client?.email),
      "client.phone": text(client?.phone),
      "client.website": text(client?.website),
      "client.taxId": text(client?.taxId),
      "client.addressLine1": text(client?.addressLine1),
      "client.addressLine2": text(client?.addressLine2),
      "client.city": text(client?.city),
      "client.state": text(client?.state),
      "client.postalCode": text(client?.postalCode),
      "client.country": text(client?.country),
      "client.currency": text(client?.currency),
      "contract.number": contract.number,
      "contract.title": contract.title,
      "contract.status": statusLabel,
      "contract.effectiveFrom": day(contract.effectiveFrom, locale),
      "contract.effectiveUntil": day(contract.effectiveUntil, locale),
      "contract.issuedAt": day(contract.issuedAt, locale),
      "contract.terminationReason": text(contract.terminationReason),
      "business.name": text(business.name),
      "business.email": text(business.email),
      "business.phone": text(business.phone),
      "business.website": text(business.website),
      "business.taxId": text(business.taxId),
      "business.addressLine1": text(business.addressLine1),
      "business.addressLine2": text(business.addressLine2),
      "business.city": text(business.city),
      "business.state": text(business.state),
      "business.postalCode": text(business.postalCode),
      "business.country": text(business.country)
    }
  }
}

function text(value: string | null | undefined): string {
  return value ?? ""
}

function day(value: Date | null, locale: string): string {
  return value ? formatDay(value, locale) : ""
}
