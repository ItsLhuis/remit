// The pure services entry rather than the feature barrel: that barrel re-exports components, which
// reach `lib/auth` and validate the environment at import time — a runtime dependency a pure service
// must not acquire (ADR-0007).
import {
  buildBusinessMergeValues,
  buildClientMergeValues,
  mergeDay,
  mergeText,
  type MergeBusiness,
  type MergeClient,
  type TemplateRenderData
} from "@/features/templates/services"

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

export type ContractRenderClient = MergeClient

export type ContractRenderBusiness = MergeBusiness

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
      ...buildClientMergeValues(client),
      "contract.number": contract.number,
      "contract.title": contract.title,
      "contract.status": statusLabel,
      "contract.effectiveFrom": mergeDay(contract.effectiveFrom, locale),
      "contract.effectiveUntil": mergeDay(contract.effectiveUntil, locale),
      "contract.issuedAt": mergeDay(contract.issuedAt, locale),
      "contract.terminationReason": mergeText(contract.terminationReason),
      ...buildBusinessMergeValues(business)
    }
  }
}
