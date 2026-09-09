import { randomUUID } from "node:crypto"

import { loadAppContext } from "./appContext"

type SeededRecurringSchedule = {
  scheduleId: string
  projectId: string
  // The day the sweep will see as due, in the `YYYY-MM-DD` form `runScheduleSweep` builds its
  // occurrence key from. The re-delivery step needs the same key the first run carried.
  occurrenceKey: string
  projectName: string
  lineDescription: string
  invoicePrefix: string
}

const MONTHLY_FEE_CENTS = 250_000

// Seeded through the database rather than the schedule form: this flow is about what the overnight
// sweep does to a schedule that has come due, and the day it comes due is a column no form lets a
// person set in the past. Everything the generation reads is set explicitly so the invoice it
// writes is one this spec can predict.
export async function seedDueRecurringSchedule(): Promise<SeededRecurringSchedule> {
  const { database, schema } = await loadAppContext()

  const suffix = randomUUID().slice(0, 8)
  const clientName = `E2E recurring client ${suffix}`
  const projectName = `E2E recurring project ${suffix}`
  const lineDescription = `E2E retainer ${suffix}`

  const [client] = await database
    .insert(schema.clients)
    .values({
      name: clientName,
      email: `e2e-recurring-${suffix}@example.test`,
      currency: "EUR"
    })
    .returning({ id: schema.clients.id })

  if (!client) throw new Error("seedDueRecurringSchedule: client insert failed")

  // The schedule bills a project rather than the client directly, because the invoice detail route
  // is nested under one: a client-only schedule generates an invoice the UI can only ever render as
  // plain text, and this flow has to open the invoice to read its status.
  const [project] = await database
    .insert(schema.projects)
    .values({
      clientId: client.id,
      name: projectName,
      status: "active",
      currency: "EUR"
    })
    .returning({ id: schema.projects.id })

  if (!project) throw new Error("seedDueRecurringSchedule: project insert failed")

  // Yesterday, not today: `shouldGenerateInvoice` compares whole UTC days, so a schedule dated today
  // is already due, but dating it in the past also proves the sweep picks up a run it missed rather
  // than only the one it is standing on.
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const nextRunAt = new Date(
    Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate())
  )

  const [schedule] = await database
    .insert(schema.recurringInvoices)
    .values({
      clientId: client.id,
      projectId: project.id,
      name: `E2E monthly retainer ${suffix}`,
      status: "active",
      cadence: "monthly",
      cadenceDay: nextRunAt.getUTCDate(),
      nextRunAt,
      currency: "EUR",
      autoSend: false,
      lineItemsBlueprint: [
        {
          description: lineDescription,
          unit: null,
          quantity: 1,
          unitPriceCents: MONTHLY_FEE_CENTS,
          taxRateId: null,
          taxPercentage: 0,
          discountType: null,
          discountPercentage: null,
          discountAmountCents: null
        }
      ]
    })
    .returning({ id: schema.recurringInvoices.id })

  if (!schedule) throw new Error("seedDueRecurringSchedule: schedule insert failed")

  const settingsRow = await database.query.settings.findFirst({
    columns: { invoicePrefix: true }
  })

  return {
    scheduleId: schedule.id,
    projectId: project.id,
    occurrenceKey: nextRunAt.toISOString().slice(0, 10),
    projectName,
    lineDescription,
    invoicePrefix: settingsRow?.invoicePrefix ?? "INV-"
  }
}
