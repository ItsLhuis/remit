import { eq } from "drizzle-orm"

import { on } from "@/lib/events"

import { database } from "@/database"
import { proposals } from "@/database/schema"

import { type ActivityRecord, record } from "./record"

export function subscribeProposalActivity(): void {
  on("proposal.sent", ({ proposalId }) =>
    record("proposal.sent", () => buildProposalActivity(proposalId, "sent", "proposalSent"))
  )

  on("proposal.accepted", ({ proposalId }) =>
    record("proposal.accepted", () =>
      buildProposalActivity(proposalId, "accepted", "proposalAccepted")
    )
  )

  on("proposal.rejected", ({ proposalId }) =>
    record("proposal.rejected", () =>
      buildProposalActivity(proposalId, "rejected", "proposalRejected")
    )
  )
}

async function buildProposalActivity(
  proposalId: string,
  action: string,
  message: "proposalSent" | "proposalAccepted" | "proposalRejected"
): Promise<ActivityRecord | null> {
  const row = await database.query.proposals.findFirst({
    where: eq(proposals.id, proposalId),
    columns: { number: true }
  })

  if (!row) return null

  return {
    entityType: "proposal",
    entityId: proposalId,
    action,
    messageKey: `activity.messages.${message}`,
    messageArgs: { number: row.number }
  }
}
