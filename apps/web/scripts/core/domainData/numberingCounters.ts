import { desc, eq } from "drizzle-orm"

import {
  DEMO_SEED_AUDIT_EVENT,
  parseSeedNumbering,
  selectRewindableCounters,
  type NumberingCounters
} from "./numbering"

type Database = typeof import("@/database").database
type Schema = typeof import("@/database/schema")
type CounterDatabase = Pick<Database, "select" | "update">

export async function readNumberingCounters(
  database: CounterDatabase,
  schema: Schema
): Promise<{ settingsId: string; counters: NumberingCounters } | null> {
  const [row] = await database
    .select({
      id: schema.settings.id,
      invoice: schema.settings.nextInvoiceNumber,
      proposal: schema.settings.nextProposalNumber,
      contract: schema.settings.nextContractNumber,
      creditNote: schema.settings.nextCreditNoteNumber
    })
    .from(schema.settings)
    .limit(1)

  if (!row) return null

  const { id, ...counters } = row

  return { settingsId: id, counters }
}

export async function writeNumberingCounters(
  database: CounterDatabase,
  schema: Schema,
  settingsId: string,
  counters: Partial<NumberingCounters>
): Promise<void> {
  if (Object.keys(counters).length === 0) return

  await database
    .update(schema.settings)
    .set({
      nextInvoiceNumber: counters.invoice,
      nextProposalNumber: counters.proposal,
      nextContractNumber: counters.contract,
      nextCreditNoteNumber: counters.creditNote
    })
    .where(eq(schema.settings.id, settingsId))
}

// Puts back what the most recent demo seed advanced, counter by counter, under the rule in
// `numbering.ts`'s `selectRewindableCounters`. Runs inside the reset's (or the reseed's) transaction,
// after the documents are gone, and returns what it rewound so the audit entry can say so.
export async function rewindSeededNumbering(
  database: CounterDatabase,
  schema: Schema
): Promise<Partial<NumberingCounters>> {
  const current = await readNumberingCounters(database, schema)

  if (!current) return {}

  const [seedEntry] = await database
    .select({ metadata: schema.auditLogs.metadata })
    .from(schema.auditLogs)
    .where(eq(schema.auditLogs.event, DEMO_SEED_AUDIT_EVENT))
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(1)

  const seed = parseSeedNumbering(seedEntry?.metadata)

  if (!seed) return {}

  const rewound = selectRewindableCounters(current.counters, seed)

  await writeNumberingCounters(database, schema, current.settingsId, rewound)

  return rewound
}
