export type ClientHealth = "owing" | "settled" | "dormant"

export type ClientHealthInput = {
  outstandingBalanceCents: number
  invoiceCount: number
}

export function getClientHealth({
  outstandingBalanceCents,
  invoiceCount
}: ClientHealthInput): ClientHealth {
  if (outstandingBalanceCents > 0) return "owing"

  if (invoiceCount > 0) return "settled"

  return "dormant"
}
