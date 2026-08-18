import { describe, expect, test } from "vitest"

import { summarizeLeadPipeline } from "../summarizeLeadPipeline"

describe("summarizeLeadPipeline", () => {
  test("returns all six stages in working order for an instance with no leads", () => {
    const pipeline = summarizeLeadPipeline([])

    expect(pipeline.stages.map((stage) => stage.id)).toEqual([
      "new",
      "contacted",
      "qualified",
      "proposal_sent",
      "won",
      "lost"
    ])
    expect(pipeline.totalCount).toBe(0)
  })

  test("reports no win rate until a lead has reached a decision", () => {
    const pipeline = summarizeLeadPipeline([
      { status: "new", count: 3 },
      { status: "contacted", count: 2 }
    ])

    expect(pipeline.winRatePercentage).toBeNull()
    expect(pipeline.openCount).toBe(5)
  })

  test("excludes leads still being worked from the win rate", () => {
    const pipeline = summarizeLeadPipeline([
      { status: "won", count: 3 },
      { status: "lost", count: 1 },
      { status: "new", count: 20 }
    ])

    expect(pipeline.winRatePercentage).toBe(75)
  })

  test("counts a proposal-sent lead as still open", () => {
    expect(summarizeLeadPipeline([{ status: "proposal_sent", count: 4 }]).openCount).toBe(4)
  })

  test("reports each stage's share of every lead on the instance", () => {
    const pipeline = summarizeLeadPipeline([
      { status: "new", count: 1 },
      { status: "won", count: 3 }
    ])

    expect(pipeline.stages.find((stage) => stage.id === "won")?.sharePercentage).toBe(75)
  })

  test("ignores a status the enum no longer carries rather than failing on it", () => {
    const pipeline = summarizeLeadPipeline([{ status: "archived", count: 5 }])

    expect(pipeline.totalCount).toBe(5)
    expect(pipeline.stages.every((stage) => stage.count === 0)).toBe(true)
  })
})
