import { eq } from "drizzle-orm"

import { on } from "@/lib/events"

import { database } from "@/database"
import { contracts } from "@/database/schema"

import { type ActivityRecord, record } from "./record"

export function subscribeContractActivity(): void {
  on("contract.signed", ({ contractId }) =>
    record("contract.signed", () => buildContractSigned(contractId))
  )
}

async function buildContractSigned(contractId: string): Promise<ActivityRecord | null> {
  const row = await database.query.contracts.findFirst({
    where: eq(contracts.id, contractId),
    columns: { title: true }
  })

  if (!row) return null

  return {
    entityType: "contract",
    entityId: contractId,
    action: "signed",
    messageKey: "activity.messages.contractSigned",
    messageArgs: { title: row.title }
  }
}
