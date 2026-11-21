import { describe, expect, test } from "vitest"

import { shouldGenerateInvoice, type RecurringInvoiceState } from "../shouldGenerateInvoice"

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

const makeSchedule = (overrides: Partial<RecurringInvoiceState> = {}): RecurringInvoiceState => ({
  status: "active",
  nextRunAt: utc("2026-08-05"),
  endAfterCount: null,
  endByDate: null,
  occurrencesGenerated: 0,
  ...overrides
})

describe("due-ness", () => {
  test("generates when the run date is today", () => {
    const decision = shouldGenerateInvoice(makeSchedule(), utc("2026-08-05"))

    expect(decision).toEqual({ action: "generate" })
  })

  test("generates when the run date has already passed", () => {
    const decision = shouldGenerateInvoice(makeSchedule(), utc("2026-08-09"))

    expect(decision).toEqual({ action: "generate" })
  })

  test("skips when the run date is still ahead", () => {
    const decision = shouldGenerateInvoice(makeSchedule(), utc("2026-08-04"))

    expect(decision).toEqual({ action: "skip", reason: "not_due" })
  })

  test("generates when the run day has arrived but the clock has not passed midnight UTC", () => {
    const decision = shouldGenerateInvoice(makeSchedule(), new Date("2026-08-05T00:05:00.000Z"))

    expect(decision).toEqual({ action: "generate" })
  })

  test("does not generate a day early for a host clock late in the previous day", () => {
    const decision = shouldGenerateInvoice(makeSchedule(), new Date("2026-08-04T23:59:59.000Z"))

    expect(decision).toEqual({ action: "skip", reason: "not_due" })
  })
})

describe("status", () => {
  test.each(["paused", "completed", "cancelled"] as const)("skips a %s schedule", (status) => {
    const decision = shouldGenerateInvoice(makeSchedule({ status }), utc("2026-08-09"))

    expect(decision).toEqual({ action: "skip", reason: "inactive" })
  })
})

describe("end conditions", () => {
  test("completes when the occurrence limit has been reached", () => {
    const schedule = makeSchedule({ endAfterCount: 3, occurrencesGenerated: 3 })

    expect(shouldGenerateInvoice(schedule, utc("2026-08-05"))).toEqual({
      action: "complete",
      reason: "occurrence_limit"
    })
  })

  test("generates the final occurrence allowed by the limit", () => {
    const schedule = makeSchedule({ endAfterCount: 3, occurrencesGenerated: 2 })

    expect(shouldGenerateInvoice(schedule, utc("2026-08-05"))).toEqual({ action: "generate" })
  })

  test("completes when the next run falls after the end date", () => {
    const schedule = makeSchedule({ nextRunAt: utc("2026-09-01"), endByDate: utc("2026-08-31") })

    expect(shouldGenerateInvoice(schedule, utc("2026-09-01"))).toEqual({
      action: "complete",
      reason: "end_date"
    })
  })

  test("generates when the next run falls on the end date itself", () => {
    const schedule = makeSchedule({ nextRunAt: utc("2026-08-31"), endByDate: utc("2026-08-31") })

    expect(shouldGenerateInvoice(schedule, utc("2026-08-31"))).toEqual({ action: "generate" })
  })

  // The schema permits a schedule with neither end field set, and that is the common case: it runs
  // until someone pauses or cancels it.
  test("generates indefinitely when no end condition is configured", () => {
    const schedule = makeSchedule({ occurrencesGenerated: 500 })

    expect(shouldGenerateInvoice(schedule, utc("2030-01-01"))).toEqual({ action: "generate" })
  })

  test("completes rather than skipping when an exhausted schedule is not yet due", () => {
    const schedule = makeSchedule({ endAfterCount: 1, occurrencesGenerated: 1 })

    expect(shouldGenerateInvoice(schedule, utc("2026-08-01"))).toEqual({
      action: "complete",
      reason: "occurrence_limit"
    })
  })

  test("reports an inactive schedule as inactive before considering its end condition", () => {
    const schedule = makeSchedule({
      status: "cancelled",
      endAfterCount: 1,
      occurrencesGenerated: 1
    })

    expect(shouldGenerateInvoice(schedule, utc("2026-08-05"))).toEqual({
      action: "skip",
      reason: "inactive"
    })
  })
})
