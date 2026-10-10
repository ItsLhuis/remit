import { type DomainDeleteCounts } from "../domainData/deleteDomainRows"
import { type NumberingCounters } from "../domainData/numbering"

export type ResetDataCliOptions = {
  dryRun: boolean
  help: boolean
  yes: boolean
}

export type ResetDataTablePreview = {
  decision: "delete" | "keep"
  reason: string
  rows: number
  table: string
}

export type ResetDataPlan = {
  // What the operator has to type to confirm. The business name when the instance has one, so the
  // phrase names the instance being emptied rather than a word that is the same everywhere.
  confirmationPhrase: string
  deletableRowTotal: number
  previews: ResetDataTablePreview[]
}

export type QueueDrainOutcome =
  | { status: "drained" }
  | { status: "failed"; reason: string }
  | { status: "skipped" }

export type StorageDrainOutcome = {
  queued: number
  deleted: number
}

export type RunResetDataResult = {
  deletedCounts: DomainDeleteCounts
  numberingRewound: Partial<NumberingCounters>
  plan: ResetDataPlan
  queueDrain: QueueDrainOutcome
  storage: StorageDrainOutcome
  wrote: boolean
}
