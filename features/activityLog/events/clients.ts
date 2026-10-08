import { eq } from "drizzle-orm"

import { on } from "@/lib/events"

import { database } from "@/database"
import { clients } from "@/database/schema"

import { type ActivityRecord, record } from "./record"

export function subscribeClientActivity(): void {
  on("client.created", ({ clientId }) =>
    record("client.created", () => buildClientCreated(clientId))
  )
}

async function buildClientCreated(clientId: string): Promise<ActivityRecord | null> {
  const row = await database.query.clients.findFirst({
    where: eq(clients.id, clientId),
    columns: { name: true }
  })

  if (!row) return null

  return {
    entityType: "client",
    entityId: clientId,
    action: "created",
    messageKey: "activity.messages.clientCreated",
    messageArgs: { name: row.name }
  }
}
