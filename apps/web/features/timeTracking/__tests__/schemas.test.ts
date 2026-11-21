import { describe, expect, test } from "vitest"

import {
  createManualTimeEntrySchema,
  parseTimeEntryListQuery,
  startTimerSchema,
  timeEntryFormSchema,
  type TimeEntryFormInputValues
} from "../schemas"

const PROJECT_ID = "00000000-0000-4000-8000-000000000001"
const TASK_ID = "00000000-0000-4000-8000-000000000002"

const formInput: TimeEntryFormInputValues = {
  projectId: PROJECT_ID,
  taskId: "",
  description: "Design review",
  startedAt: "2026-08-05T09:00",
  endedAt: "2026-08-05T10:30",
  billable: true,
  hourlyRate: ""
}

describe("timeEntryFormSchema", () => {
  test("accepts the values TimeEntryForm holds", () => {
    const result = timeEntryFormSchema.safeParse(formInput)

    expect(result.success).toBe(true)
  })

  test("rejects an end that precedes its start", () => {
    const result = timeEntryFormSchema.safeParse({
      ...formInput,
      startedAt: "2026-08-05T10:30",
      endedAt: "2026-08-05T09:00"
    })

    expect(result.success).toBe(false)
  })

  test("accepts an entry that crosses midnight", () => {
    const result = timeEntryFormSchema.safeParse({
      ...formInput,
      startedAt: "2026-08-05T23:30",
      endedAt: "2026-08-06T00:45"
    })

    expect(result.success).toBe(true)
  })

  test("rejects a date without a time", () => {
    const result = timeEntryFormSchema.safeParse({ ...formInput, startedAt: "2026-08-05" })

    expect(result.success).toBe(false)
  })
})

// The form resolves with `raw: true`, so what reaches the action is the *input* shape, and the
// action schema is what transforms it. These two tests are that contract: adding a transform to the
// shared field shape without keeping `raw: true` on the form breaks them rather than the running UI.
describe("createManualTimeEntrySchema", () => {
  test("accepts the raw form values once the datetimes are instants", () => {
    const result = createManualTimeEntrySchema.safeParse({
      ...formInput,
      startedAt: "2026-08-05T09:00:00.000Z",
      endedAt: "2026-08-05T10:30:00.000Z"
    })

    expect(result.success).toBe(true)
  })

  test("turns a blank rate into no override and a blank task into no task", () => {
    const result = createManualTimeEntrySchema.parse({
      ...formInput,
      startedAt: "2026-08-05T09:00:00.000Z",
      endedAt: "2026-08-05T10:30:00.000Z"
    })

    expect(result.hourlyRate).toBeNull()
    expect(result.taskId).toBeNull()
  })

  test("parses a decimal rate into whole cents", () => {
    const result = createManualTimeEntrySchema.parse({
      ...formInput,
      hourlyRate: "82.50",
      startedAt: "2026-08-05T09:00:00.000Z",
      endedAt: "2026-08-05T10:30:00.000Z"
    })

    expect(result.hourlyRate).toBe(8250)
  })

  test("keeps an explicit zero rate as an override rather than dropping it", () => {
    const result = createManualTimeEntrySchema.parse({
      ...formInput,
      hourlyRate: "0",
      startedAt: "2026-08-05T09:00:00.000Z",
      endedAt: "2026-08-05T10:30:00.000Z"
    })

    expect(result.hourlyRate).toBe(0)
  })

  test("rejects a datetime that is not an instant", () => {
    const result = createManualTimeEntrySchema.safeParse({
      ...formInput,
      startedAt: "2026-08-05T09:00",
      endedAt: "2026-08-05T10:30"
    })

    expect(result.success).toBe(false)
  })
})

describe("startTimerSchema", () => {
  test("accepts a scope with a task selected", () => {
    const result = startTimerSchema.safeParse({
      projectId: PROJECT_ID,
      taskId: TASK_ID,
      description: "",
      billable: false,
      hourlyRate: ""
    })

    expect(result.success).toBe(true)
  })

  test("rejects a start with no project", () => {
    const result = startTimerSchema.safeParse({
      projectId: "",
      taskId: "",
      description: "",
      billable: true,
      hourlyRate: ""
    })

    expect(result.success).toBe(false)
  })
})

describe("parseTimeEntryListQuery", () => {
  test("defaults to active entries newest first when no parameters are given", () => {
    const result = parseTimeEntryListQuery({})

    expect(result.status).toBe("active")
    expect(result.sort).toEqual([{ id: "started", desc: true }])
  })

  test("reads the comma-separated filter parameters the data table writes", () => {
    const result = parseTimeEntryListQuery({
      project: `${PROJECT_ID},${TASK_ID}`,
      billable: "billable",
      invoiced: "unbilled"
    })

    expect(result.projectIds).toEqual([PROJECT_ID, TASK_ID])
    expect(result.billable).toEqual(["billable"])
    expect(result.invoiced).toEqual(["unbilled"])
  })

  test("drops a filter value that is not one of its options", () => {
    const result = parseTimeEntryListQuery({ billable: "maybe", invoiced: "someday" })

    expect(result.billable).toEqual([])
    expect(result.invoiced).toEqual([])
  })

  test("reads the started range as epoch milliseconds", () => {
    const from = Date.UTC(2026, 7, 1)
    const to = Date.UTC(2026, 7, 31)

    const result = parseTimeEntryListQuery({ started: `${from},${to}` })

    expect(result.startedFrom).toEqual(new Date(from))
    expect(result.startedTo).toEqual(new Date(to))
  })

  test("falls back to the defaults when the parameters are malformed", () => {
    const result = parseTimeEntryListQuery({ status: "nonsense", sort: "not json", page: "-4" })

    expect(result.status).toBe("active")
    expect(result.sort).toEqual([{ id: "started", desc: true }])
    expect(result.page).toBe(1)
  })
})
