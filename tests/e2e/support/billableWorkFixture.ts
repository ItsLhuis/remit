import { randomUUID } from "node:crypto"

import { loadAppContext } from "./appContext"

type SeededBillableWork = {
  projectId: string
  entryDescription: string
}

// Seeded through the database rather than the UI: this flow is about the conversion, the send and
// the payment, and driving the timer and the client and project forms first would make a failure
// anywhere in those three surfaces read as a failure of this one. Every value the conversion
// depends on — the frozen rate snapshot, the ended timer, the project currency — is set explicitly
// so the invoice total is a number this spec can predict.
export async function seedBillableTimeEntry(): Promise<SeededBillableWork> {
  const { database, schema } = await loadAppContext()

  const suffix = randomUUID().slice(0, 8)

  const [client] = await database
    .insert(schema.clients)
    .values({
      name: `E2E billing client ${suffix}`,
      email: `e2e-billing-${suffix}@example.com`,
      currency: "EUR"
    })
    .returning({ id: schema.clients.id })

  if (!client) throw new Error("seedBillableTimeEntry: client insert failed")

  const [project] = await database
    .insert(schema.projects)
    .values({
      clientId: client.id,
      name: `E2E billing project ${suffix}`,
      status: "active",
      currency: "EUR"
    })
    .returning({ id: schema.projects.id })

  if (!project) throw new Error("seedBillableTimeEntry: project insert failed")

  const entryDescription = `E2E billable work ${suffix}`
  const startedAt = new Date("2026-07-01T09:00:00.000Z")

  await database.insert(schema.timeEntries).values({
    projectId: project.id,
    startedAt,
    endedAt: new Date(startedAt.getTime() + 7_200_000),
    durationSeconds: 7200,
    billable: true,
    hourlyRateSnapshotCents: 10_000,
    description: entryDescription,
    source: "manual"
  })

  return { projectId: project.id, entryDescription }
}
