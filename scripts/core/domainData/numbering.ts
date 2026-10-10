import { z } from "zod"

export const DEMO_SEED_AUDIT_EVENT = "instance.seed_demo.completed"

export type NumberingCounters = {
  invoice: number
  proposal: number
  contract: number
  creditNote: number
}

const countersSchema = z.object({
  invoice: z.number().int().min(1),
  proposal: z.number().int().min(1),
  contract: z.number().int().min(1),
  creditNote: z.number().int().min(1)
})

const seedNumberingSchema = z.object({
  numbering: z.object({ before: countersSchema, after: countersSchema })
})

export type SeedNumbering = z.infer<typeof seedNumberingSchema>["numbering"]

const COUNTER_NAMES = ["invoice", "proposal", "contract", "creditNote"] as const

// The demo seed numbers its documents from 1 (`INV-0001`, ...), whatever the counters say. Each
// counter therefore has to end up past the highest number the seed used, or the first real document
// after seeding would claim a number a demo document already holds; a counter already further on is
// left where it is.
export function advanceCountersPastSeed(
  current: NumberingCounters,
  seededCounts: NumberingCounters
): NumberingCounters {
  return mapCounters((name) => Math.max(current[name], seededCounts[name] + 1))
}

// The counters a reset may put back, and only these: a counter that still holds exactly the value
// the seed left it at has issued no number since the seed, so every number above its pre-seed value
// belonged to a demo document and never reached anyone. A counter that moved on may have issued a
// real number that is now in a client's inbox, and re-issuing it is the accounting hazard ADR-0025
// refuses — so it stays.
export function selectRewindableCounters(
  current: NumberingCounters,
  seed: SeedNumbering
): Partial<NumberingCounters> {
  const rewound: Partial<NumberingCounters> = {}

  for (const name of COUNTER_NAMES) {
    if (current[name] === seed.after[name] && seed.after[name] !== seed.before[name]) {
      rewound[name] = seed.before[name]
    }
  }

  return rewound
}

// The seed's own audit entry is the record of what it advanced. Metadata that does not parse rewinds
// nothing, which is the safe direction: a counter left too high skips numbers, one rewound too far
// re-issues them.
export function parseSeedNumbering(metadata: unknown): SeedNumbering | null {
  const parsed = seedNumberingSchema.safeParse(metadata)

  return parsed.success ? parsed.data.numbering : null
}

function mapCounters(read: (name: keyof NumberingCounters) => number): NumberingCounters {
  return {
    invoice: read("invoice"),
    proposal: read("proposal"),
    contract: read("contract"),
    creditNote: read("creditNote")
  }
}
