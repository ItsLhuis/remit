import { describe, expect, test } from "vitest"

import {
  assessLateFee,
  toLateFeePolicy,
  type LateFeeCandidate,
  type LateFeePolicy,
  type LateFeePolicyRow
} from "../lateFee"

const NOW = new Date("2026-08-20T12:00:00.000Z")

function makeInvoice(overrides?: Partial<LateFeeCandidate>): LateFeeCandidate {
  return {
    status: "sent",
    dueDate: new Date("2026-08-10T00:00:00.000Z"),
    paidAt: null,
    totalCents: 100_000,
    amountPaidCents: 0,
    lateFeeCents: null,
    ...overrides
  }
}

function makePercentagePolicy(overrides?: Partial<Extract<LateFeePolicy, { kind: "percentage" }>>) {
  return {
    enabled: true,
    kind: "percentage",
    percentage: 5,
    graceDays: 0,
    maxCents: null,
    ...overrides
  } satisfies LateFeePolicy
}

function makePolicyRow(overrides?: Partial<LateFeePolicyRow>): LateFeePolicyRow {
  return {
    lateFeeEnabled: true,
    lateFeeType: "percentage",
    lateFeePercentage: "5.00",
    lateFeeAmountCents: null,
    lateFeeGraceDays: 0,
    lateFeeMaxCents: null,
    ...overrides
  }
}

describe("toLateFeePolicy", () => {
  test("reports the policy off when no settings row exists", () => {
    expect(toLateFeePolicy(null)).toEqual({ enabled: false })
  })

  test("reports the policy off when the switch is off even though an amount is configured", () => {
    const row = makePolicyRow({ lateFeeEnabled: false })

    expect(toLateFeePolicy(row)).toEqual({ enabled: false })
  })

  test("reads the percentage as a number when the type is percentage", () => {
    const row = makePolicyRow({ lateFeePercentage: "7.50", lateFeeGraceDays: 3 })

    expect(toLateFeePolicy(row)).toEqual({
      enabled: true,
      kind: "percentage",
      percentage: 7.5,
      graceDays: 3,
      maxCents: null
    })
  })

  test("reads the flat amount when the type is fixed", () => {
    const row = makePolicyRow({
      lateFeeType: "fixed",
      lateFeePercentage: null,
      lateFeeAmountCents: 4_000,
      lateFeeMaxCents: 10_000
    })

    expect(toLateFeePolicy(row)).toEqual({
      enabled: true,
      kind: "fixed",
      amountCents: 4_000,
      graceDays: 0,
      maxCents: 10_000
    })
  })

  test("reports the policy off when the type names an amount column that is null", () => {
    const row = makePolicyRow({ lateFeePercentage: null })

    expect(toLateFeePolicy(row)).toEqual({ enabled: false })
  })
})

describe("assessLateFee", () => {
  test("charges nothing when the policy is off", () => {
    expect(assessLateFee(makeInvoice(), { enabled: false }, NOW)).toEqual({
      charge: false,
      reason: "policy_off"
    })
  })

  test("charges a percentage of the outstanding balance once the due date has passed", () => {
    const result = assessLateFee(makeInvoice(), makePercentagePolicy(), NOW)

    expect(result).toEqual({ charge: true, feeCents: 5_000, daysLate: 10 })
  })

  test("charges the flat amount when the policy is fixed", () => {
    const policy: LateFeePolicy = {
      enabled: true,
      kind: "fixed",
      amountCents: 4_000,
      graceDays: 0,
      maxCents: null
    }

    expect(assessLateFee(makeInvoice(), policy, NOW)).toEqual({
      charge: true,
      feeCents: 4_000,
      daysLate: 10
    })
  })

  test("prices the percentage on what is still owed rather than on the face value", () => {
    const invoice = makeInvoice({ amountPaidCents: 80_000 })

    const result = assessLateFee(invoice, makePercentagePolicy(), NOW)

    expect(result).toEqual({ charge: true, feeCents: 1_000, daysLate: 10 })
  })

  test("rounds the percentage to whole cents exactly once", () => {
    const invoice = makeInvoice({ totalCents: 3_333 })

    const result = assessLateFee(invoice, makePercentagePolicy({ percentage: 7.5 }), NOW)

    expect(result).toEqual({ charge: true, feeCents: 250, daysLate: 10 })
  })

  test("charges nothing on the last day of the grace period", () => {
    const policy = makePercentagePolicy({ graceDays: 10 })

    expect(assessLateFee(makeInvoice(), policy, NOW)).toEqual({
      charge: false,
      reason: "within_grace"
    })
  })

  test("charges on the day after the grace period ends", () => {
    const policy = makePercentagePolicy({ graceDays: 9 })

    expect(assessLateFee(makeInvoice(), policy, NOW)).toEqual({
      charge: true,
      feeCents: 5_000,
      daysLate: 10
    })
  })

  test("charges nothing on the due date itself when no grace is configured", () => {
    const invoice = makeInvoice({ dueDate: new Date("2026-08-20T00:00:00.000Z") })

    expect(assessLateFee(invoice, makePercentagePolicy(), NOW)).toEqual({
      charge: false,
      reason: "within_grace"
    })
  })

  test("clamps the fee to the configured cap", () => {
    const policy = makePercentagePolicy({ maxCents: 2_500 })

    expect(assessLateFee(makeInvoice(), policy, NOW)).toEqual({
      charge: true,
      feeCents: 2_500,
      daysLate: 10
    })
  })

  test("charges nothing on an invoice that already carries a fee", () => {
    const invoice = makeInvoice({ lateFeeCents: 5_000 })

    expect(assessLateFee(invoice, makePercentagePolicy(), NOW)).toEqual({
      charge: false,
      reason: "already_assessed"
    })
  })

  test("charges nothing on an invoice whose fee was waived to zero", () => {
    const invoice = makeInvoice({ lateFeeCents: 0 })

    expect(assessLateFee(invoice, makePercentagePolicy(), NOW)).toEqual({
      charge: false,
      reason: "already_assessed"
    })
  })

  test("charges nothing on a draft", () => {
    const invoice = makeInvoice({ status: "draft" })

    expect(assessLateFee(invoice, makePercentagePolicy(), NOW)).toEqual({
      charge: false,
      reason: "not_issued"
    })
  })

  test("charges nothing on a settled invoice", () => {
    const invoice = makeInvoice({
      status: "paid",
      paidAt: new Date("2026-08-15T00:00:00.000Z"),
      amountPaidCents: 100_000
    })

    expect(assessLateFee(invoice, makePercentagePolicy(), NOW)).toEqual({
      charge: false,
      reason: "settled"
    })
  })

  test("charges nothing when the invoice has no due date", () => {
    const invoice = makeInvoice({ dueDate: null })

    expect(assessLateFee(invoice, makePercentagePolicy(), NOW)).toEqual({
      charge: false,
      reason: "no_due_date"
    })
  })

  test("charges nothing when the balance is already covered", () => {
    const invoice = makeInvoice({ amountPaidCents: 100_000 })

    expect(assessLateFee(invoice, makePercentagePolicy(), NOW)).toEqual({
      charge: false,
      reason: "nothing_outstanding"
    })
  })

  test("charges nothing when the total is zero", () => {
    const invoice = makeInvoice({ totalCents: 0 })

    expect(assessLateFee(invoice, makePercentagePolicy(), NOW)).toEqual({
      charge: false,
      reason: "nothing_outstanding"
    })
  })

  test("charges nothing when the percentage prices below half a cent", () => {
    const invoice = makeInvoice({ totalCents: 4 })

    expect(assessLateFee(invoice, makePercentagePolicy({ percentage: 5 }), NOW)).toEqual({
      charge: false,
      reason: "rounds_to_zero"
    })
  })

  test("charges nothing when the cap is zero", () => {
    const policy = makePercentagePolicy({ maxCents: 0 })

    expect(assessLateFee(makeInvoice(), policy, NOW)).toEqual({
      charge: false,
      reason: "rounds_to_zero"
    })
  })
})
