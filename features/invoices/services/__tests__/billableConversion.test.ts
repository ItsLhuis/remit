import { describe, expect, test } from "vitest"

import {
  planBillableConversion,
  type BillableExpenseRow,
  type BillableTimeEntryRow
} from "../billableConversion"

const HOUR_UNIT = "hour"

function makeTimeEntry(overrides: Partial<BillableTimeEntryRow> = {}): BillableTimeEntryRow {
  return {
    id: "entry-1",
    clientId: "client-1",
    projectId: "project-1",
    projectName: "Website rebuild",
    taskId: null,
    taskTitle: null,
    description: "",
    durationSeconds: 3600,
    hourlyRateSnapshotCents: 10_000,
    currency: "EUR",
    ...overrides
  }
}

function makeExpense(overrides: Partial<BillableExpenseRow> = {}): BillableExpenseRow {
  return {
    id: "expense-1",
    clientId: "client-1",
    projectId: "project-1",
    description: "Stock photography",
    rebillableCents: 5000,
    descriptionSuffix: null,
    currency: "EUR",
    ...overrides
  }
}

describe("parentage and currency", () => {
  test("refuses the selection when it spans two currencies", () => {
    const timeEntries = [makeTimeEntry({ currency: "EUR" })]
    const expenses = [makeExpense({ currency: "USD" })]

    const plan = planBillableConversion({
      timeEntries,
      expenses,
      grouping: "entry",
      hourUnit: HOUR_UNIT
    })

    expect(plan).toEqual({ outcome: "currencyMismatch", currencies: ["EUR", "USD"] })
  })

  test("carries the single currency through when every row agrees", () => {
    const plan = planBillableConversion({
      timeEntries: [makeTimeEntry({ currency: "USD" })],
      expenses: [makeExpense({ currency: "USD" })],
      grouping: "entry",
      hourUnit: HOUR_UNIT
    })

    expect(plan).toMatchObject({ outcome: "billable", currency: "USD" })
  })

  test("refuses the selection when it spans two clients", () => {
    const timeEntries = [makeTimeEntry({ clientId: "client-1" })]
    const expenses = [makeExpense({ clientId: "client-2" })]

    const plan = planBillableConversion({
      timeEntries,
      expenses,
      grouping: "entry",
      hourUnit: HOUR_UNIT
    })

    expect(plan).toEqual({ outcome: "clientMismatch" })
  })

  test("names no project when one client's rows span two of them", () => {
    const timeEntries = [
      makeTimeEntry({ id: "a", projectId: "project-1" }),
      makeTimeEntry({ id: "b", projectId: "project-2" })
    ]

    const plan = planBillableConversion({
      timeEntries,
      expenses: [],
      grouping: "entry",
      hourUnit: HOUR_UNIT
    })

    expect(plan).toMatchObject({ outcome: "billable", clientId: "client-1", projectId: null })
  })

  test("names the project when every row agrees on it", () => {
    const plan = planBillableConversion({
      timeEntries: [makeTimeEntry()],
      expenses: [makeExpense()],
      grouping: "entry",
      hourUnit: HOUR_UNIT
    })

    expect(plan).toMatchObject({ outcome: "billable", projectId: "project-1" })
  })

  test("reports nothing billable when the selection is empty", () => {
    const plan = planBillableConversion({
      timeEntries: [],
      expenses: [],
      grouping: "entry",
      hourUnit: HOUR_UNIT
    })

    expect(plan).toEqual({ outcome: "nothingBillable" })
  })
})

describe("rounding", () => {
  test("rounds the summed seconds once rather than each entry separately", () => {
    const timeEntries = [
      makeTimeEntry({ id: "a", durationSeconds: 18 }),
      makeTimeEntry({ id: "b", durationSeconds: 18 }),
      makeTimeEntry({ id: "c", durationSeconds: 18 })
    ]

    const plan = planBillableConversion({
      timeEntries,
      expenses: [],
      grouping: "project",
      hourUnit: HOUR_UNIT
    })

    // 54s summed is 0.015h, which rounds to 0.02. Rounding each 18s (0.005h) first would give
    // 0.01 three times over and bill 0.03.
    expect(plan).toMatchObject({
      outcome: "billable",
      lines: [expect.objectContaining({ quantity: 0.02 })]
    })
  })

  test("rounds an exact half hundredth of an hour up", () => {
    const plan = planBillableConversion({
      timeEntries: [makeTimeEntry({ durationSeconds: 90 })],
      expenses: [],
      grouping: "entry",
      hourUnit: HOUR_UNIT
    })

    expect(plan).toMatchObject({
      outcome: "billable",
      lines: [expect.objectContaining({ quantity: 0.03 })]
    })
  })

  test("rounds below a half hundredth of an hour down", () => {
    const plan = planBillableConversion({
      timeEntries: [makeTimeEntry({ durationSeconds: 89 })],
      expenses: [],
      grouping: "entry",
      hourUnit: HOUR_UNIT
    })

    expect(plan).toMatchObject({
      outcome: "billable",
      lines: [expect.objectContaining({ quantity: 0.02 })]
    })
  })

  test("reports an entry too short to bill as unbillable instead of clamping it up", () => {
    const plan = planBillableConversion({
      timeEntries: [makeTimeEntry({ id: "tiny", durationSeconds: 10 })],
      expenses: [makeExpense()],
      grouping: "entry",
      hourUnit: HOUR_UNIT
    })

    expect(plan).toMatchObject({
      outcome: "billable",
      timeEntryIds: [],
      unbillableTimeEntryIds: ["tiny"]
    })
  })

  test("reports nothing billable when every group rounds to zero hours", () => {
    const plan = planBillableConversion({
      timeEntries: [makeTimeEntry({ durationSeconds: 10 })],
      expenses: [],
      grouping: "entry",
      hourUnit: HOUR_UNIT
    })

    expect(plan).toEqual({ outcome: "nothingBillable" })
  })
})

describe("rate", () => {
  test("splits one group into separate lines when the snapshot rates differ", () => {
    const timeEntries = [
      makeTimeEntry({ id: "a", hourlyRateSnapshotCents: 10_000 }),
      makeTimeEntry({ id: "b", hourlyRateSnapshotCents: 12_000 })
    ]

    const plan = planBillableConversion({
      timeEntries,
      expenses: [],
      grouping: "project",
      hourUnit: HOUR_UNIT
    })

    expect(plan).toMatchObject({
      outcome: "billable",
      lines: [
        expect.objectContaining({ unitPriceCents: 10_000 }),
        expect.objectContaining({ unitPriceCents: 12_000 })
      ]
    })
  })

  test("bills an entry that resolved to no rate as a zero-cent line rather than refusing it", () => {
    const plan = planBillableConversion({
      timeEntries: [makeTimeEntry({ hourlyRateSnapshotCents: 0 })],
      expenses: [],
      grouping: "entry",
      hourUnit: HOUR_UNIT
    })

    expect(plan).toMatchObject({
      outcome: "billable",
      lines: [expect.objectContaining({ unitPriceCents: 0, quantity: 1 })]
    })
  })
})

describe("grouping", () => {
  test("bills one line per entry when grouped by entry", () => {
    const timeEntries = [
      makeTimeEntry({ id: "a", description: "Layout" }),
      makeTimeEntry({ id: "b", description: "Copy" })
    ]

    const plan = planBillableConversion({
      timeEntries,
      expenses: [],
      grouping: "entry",
      hourUnit: HOUR_UNIT
    })

    expect(plan).toMatchObject({
      outcome: "billable",
      lines: [
        expect.objectContaining({ description: "Layout", sourceTimeEntryId: "a" }),
        expect.objectContaining({ description: "Copy", sourceTimeEntryId: "b" })
      ]
    })
  })

  test("collapses entries of one task into a single line named for the task", () => {
    const timeEntries = [
      makeTimeEntry({ id: "a", taskId: "task-1", taskTitle: "Homepage", durationSeconds: 3600 }),
      makeTimeEntry({ id: "b", taskId: "task-1", taskTitle: "Homepage", durationSeconds: 1800 })
    ]

    const plan = planBillableConversion({
      timeEntries,
      expenses: [],
      grouping: "task",
      hourUnit: HOUR_UNIT
    })

    expect(plan).toMatchObject({
      outcome: "billable",
      lines: [expect.objectContaining({ description: "Homepage", quantity: 1.5 })]
    })
  })

  test("names a task group after the project when the entries carry no task", () => {
    const plan = planBillableConversion({
      timeEntries: [makeTimeEntry({ taskId: null, taskTitle: null })],
      expenses: [],
      grouping: "task",
      hourUnit: HOUR_UNIT
    })

    expect(plan).toMatchObject({
      outcome: "billable",
      lines: [expect.objectContaining({ description: "Website rebuild" })]
    })
  })

  test("falls back to the task title when an entry has no description of its own", () => {
    const plan = planBillableConversion({
      timeEntries: [makeTimeEntry({ description: "   ", taskTitle: "Homepage" })],
      expenses: [],
      grouping: "entry",
      hourUnit: HOUR_UNIT
    })

    expect(plan).toMatchObject({
      outcome: "billable",
      lines: [expect.objectContaining({ description: "Homepage" })]
    })
  })
})

describe("provenance", () => {
  test("leaves a grouped line without a source entry while still billing every entry in it", () => {
    const timeEntries = [
      makeTimeEntry({ id: "a", taskId: "task-1", taskTitle: "Homepage" }),
      makeTimeEntry({ id: "b", taskId: "task-1", taskTitle: "Homepage" })
    ]

    const plan = planBillableConversion({
      timeEntries,
      expenses: [],
      grouping: "task",
      hourUnit: HOUR_UNIT
    })

    expect(plan).toMatchObject({
      outcome: "billable",
      lines: [expect.objectContaining({ sourceTimeEntryId: null })],
      timeEntryIds: ["a", "b"]
    })
  })

  test("names the source expense on every expense line", () => {
    const plan = planBillableConversion({
      timeEntries: [],
      expenses: [makeExpense({ id: "expense-9" })],
      grouping: "entry",
      hourUnit: HOUR_UNIT
    })

    expect(plan).toMatchObject({
      outcome: "billable",
      lines: [expect.objectContaining({ sourceExpenseId: "expense-9", sourceTimeEntryId: null })]
    })
  })
})

describe("expenses", () => {
  test("bills the already marked-up amount as one line of quantity one", () => {
    const plan = planBillableConversion({
      timeEntries: [],
      expenses: [makeExpense({ rebillableCents: 11_500 })],
      grouping: "entry",
      hourUnit: HOUR_UNIT
    })

    expect(plan).toMatchObject({
      outcome: "billable",
      lines: [expect.objectContaining({ quantity: 1, unitPriceCents: 11_500, unit: null })]
    })
  })

  test("says so in the description when a markup was applied", () => {
    const plan = planBillableConversion({
      timeEntries: [],
      expenses: [makeExpense({ descriptionSuffix: "(incl. 15% markup)" })],
      grouping: "entry",
      hourUnit: HOUR_UNIT
    })

    expect(plan).toMatchObject({
      outcome: "billable",
      lines: [expect.objectContaining({ description: "Stock photography (incl. 15% markup)" })]
    })
  })

  test("keeps the description untouched when no markup was applied", () => {
    const plan = planBillableConversion({
      timeEntries: [],
      expenses: [makeExpense({ descriptionSuffix: null })],
      grouping: "entry",
      hourUnit: HOUR_UNIT
    })

    expect(plan).toMatchObject({
      outcome: "billable",
      lines: [expect.objectContaining({ description: "Stock photography" })]
    })
  })

  test("never groups two expenses together even when they share a description", () => {
    const expenses = [
      makeExpense({ id: "a", description: "Taxi" }),
      makeExpense({ id: "b", description: "Taxi" })
    ]

    const plan = planBillableConversion({
      timeEntries: [],
      expenses,
      grouping: "project",
      hourUnit: HOUR_UNIT
    })

    expect(plan).toMatchObject({ outcome: "billable", expenseIds: ["a", "b"] })
    expect(plan).toMatchObject({ lines: [expect.anything(), expect.anything()] })
  })
})
