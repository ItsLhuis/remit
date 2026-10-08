import { eq } from "drizzle-orm"

import { on } from "@/lib/events"

import { database } from "@/database"
import { leads } from "@/database/schema"

// Through the server barrel rather than the client-safe root one: this file is bundled into the
// worker process, and `features/leads/index.ts` re-exports the feature's React components.
import { formatLeadName } from "@/features/leads/server"

import { type ActivityRecord, record } from "./record"

export function subscribeLeadActivity(): void {
  // A conversion writes this row and, through `createClient`, a `client.created` row too. They are two
  // facts about two records with two click-throughs — a pursuit ended, and a client now exists — which
  // is the same shape as a settling payment writing both a `payment` and an `invoice` row. Only the
  // intermediate lead stages are refused: five of them per lead would crowd out everything else, and
  // the leads board already shows and filters on that status.
  on("lead.converted", ({ leadId }) => record("lead.converted", () => buildLeadConverted(leadId)))
}

async function buildLeadConverted(leadId: string): Promise<ActivityRecord | null> {
  const row = await database.query.leads.findFirst({
    where: eq(leads.id, leadId),
    columns: { firstName: true, lastName: true, company: true, email: true }
  })

  if (!row) return null

  return {
    entityType: "lead",
    entityId: leadId,
    action: "converted",
    messageKey: "activity.messages.leadConverted",
    messageArgs: {
      name: formatLeadName({
        firstName: row.firstName ?? "",
        lastName: row.lastName ?? "",
        company: row.company ?? "",
        email: row.email
      })
    }
  }
}
