export type ContractNumberInput = {
  prefix: string
  nextNumber: number
  paddingWidth: number
}

// A number wider than the configured padding is never truncated — `CTR-` at width 4 yields
// `CTR-0042` but still yields `CTR-100000` once the counter outgrows the pad. Truncating would mint
// a duplicate against the `contracts.number` unique index.
export function formatContractNumber({
  prefix,
  nextNumber,
  paddingWidth
}: ContractNumberInput): string {
  return `${prefix}${String(nextNumber).padStart(paddingWidth, "0")}`
}
