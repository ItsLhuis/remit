// The lead lifecycle in the order it is worked, matching the `lead_status` enum in
// database/schema/enums.ts. Declared here rather than imported so this file stays free of the
// database module (architecture.md, purity rule); the query is what maps a row onto one of these.
export const PIPELINE_STAGE_IDS = [
  "new",
  "contacted",
  "qualified",
  "proposal_sent",
  "won",
  "lost"
] as const

export type PipelineStageId = (typeof PIPELINE_STAGE_IDS)[number]

export type LeadStatusCount = {
  status: string
  count: number
}

export type PipelineStage = {
  id: PipelineStageId
  count: number
  sharePercentage: number
}

export type LeadPipeline = {
  stages: PipelineStage[]
  totalCount: number
  openCount: number
  wonCount: number
  // Won as a share of leads that reached a decision. Leads still being worked are excluded from
  // both sides: counting them as losses would make the rate fall every time a lead arrives.
  winRatePercentage: number | null
}

const OPEN_STAGE_IDS: readonly PipelineStageId[] = [
  "new",
  "contacted",
  "qualified",
  "proposal_sent"
]

export function summarizeLeadPipeline(rows: readonly LeadStatusCount[]): LeadPipeline {
  const counts = new Map<string, number>()

  let totalCount = 0

  for (const row of rows) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + row.count)
    totalCount += row.count
  }

  const wonCount = counts.get("won") ?? 0
  const lostCount = counts.get("lost") ?? 0
  const decidedCount = wonCount + lostCount

  return {
    stages: PIPELINE_STAGE_IDS.map((id) => {
      const count = counts.get(id) ?? 0

      return {
        id,
        count,
        sharePercentage: totalCount === 0 ? 0 : Math.round((count / totalCount) * 1000) / 10
      }
    }),
    totalCount,
    openCount: OPEN_STAGE_IDS.reduce((total, id) => total + (counts.get(id) ?? 0), 0),
    wonCount,
    winRatePercentage: decidedCount === 0 ? null : Math.round((wonCount / decidedCount) * 1000) / 10
  }
}
