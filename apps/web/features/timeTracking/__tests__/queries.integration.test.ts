import { beforeEach, describe, expect, test, vi } from "vitest"

import { makeClient, makeInvoice, makeProject, makeTask, makeTimeEntry } from "@/tests/factories"

import { parseTimeEntryListQuery } from "../schemas"

const mocks = vi.hoisted(() => ({
  getSession: vi.fn()
}))

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mocks.getSession
    }
  }
}))

vi.mock("@/lib/auth/session", () => ({
  getSession: mocks.getSession
}))

const JANUARY = new Date("2026-01-15T09:00:00.000Z")
const AUGUST = new Date("2026-08-15T09:00:00.000Z")

async function listWith(searchParams: Record<string, string>) {
  const { listTimeEntries } = await import("../queries")

  return listTimeEntries(parseTimeEntryListQuery(searchParams))
}

describe("time entry filters", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.getSession.mockResolvedValue(null)
  })

  test("returns only entries on the selected project", async () => {
    const wanted = await makeProject()
    const other = await makeProject()

    await makeTimeEntry({ projectId: wanted.id })
    await makeTimeEntry({ projectId: other.id })

    const result = await listWith({ project: wanted.id })

    expect(result.rowCount).toBe(1)
    expect(result.rows[0]?.projectId).toBe(wanted.id)
  })

  test("returns only entries on the selected task", async () => {
    const project = await makeProject()
    const task = await makeTask({ projectId: project.id })

    await makeTimeEntry({ projectId: project.id, taskId: task.id })
    await makeTimeEntry({ projectId: project.id, taskId: null })

    const result = await listWith({ task: task.id })

    expect(result.rowCount).toBe(1)
    expect(result.rows[0]?.taskId).toBe(task.id)
  })

  test("returns only billable entries when the billable filter is applied", async () => {
    const project = await makeProject()

    await makeTimeEntry({ projectId: project.id, billable: true })
    await makeTimeEntry({ projectId: project.id, billable: false })

    const result = await listWith({ billable: "billable" })

    expect(result.rowCount).toBe(1)
    expect(result.rows[0]?.billable).toBe(true)
  })

  test("returns every entry when both billable options are selected", async () => {
    const project = await makeProject()

    await makeTimeEntry({ projectId: project.id, billable: true })
    await makeTimeEntry({ projectId: project.id, billable: false })

    const result = await listWith({ billable: "billable,nonBillable" })

    expect(result.rowCount).toBe(2)
  })

  test("returns only entries with no invoice when filtering to unbilled", async () => {
    const project = await makeProject()
    const invoice = await makeInvoice({ projectId: project.id })

    await makeTimeEntry({ projectId: project.id, invoicedInId: invoice.id })
    await makeTimeEntry({ projectId: project.id, invoicedInId: null })

    const result = await listWith({ invoiced: "unbilled" })

    expect(result.rowCount).toBe(1)
    expect(result.rows[0]?.invoicedInId).toBeNull()
  })

  test("returns only entries started inside the selected range", async () => {
    const project = await makeProject()

    await makeTimeEntry({ projectId: project.id, startedAt: JANUARY })
    await makeTimeEntry({ projectId: project.id, startedAt: AUGUST })

    const result = await listWith({
      started: `${Date.UTC(2026, 7, 1)},${Date.UTC(2026, 7, 31)}`
    })

    expect(result.rowCount).toBe(1)
    expect(result.rows[0]?.startedAt).toEqual(AUGUST)
  })

  test("matches the search term against the description", async () => {
    const project = await makeProject()

    await makeTimeEntry({ projectId: project.id, description: "Accessibility audit" })
    await makeTimeEntry({ projectId: project.id, description: "Invoice chase" })

    const result = await listWith({ search: "audit" })

    expect(result.rowCount).toBe(1)
    expect(result.rows[0]?.description).toBe("Accessibility audit")
  })

  test("hides soft-deleted entries by default and shows them on request", async () => {
    const project = await makeProject()

    await makeTimeEntry({ projectId: project.id })
    await makeTimeEntry({ projectId: project.id, deletedAt: new Date() })

    const active = await listWith({})
    const deleted = await listWith({ status: "deleted" })

    expect(active.rowCount).toBe(1)
    expect(deleted.rowCount).toBe(1)
    expect(deleted.rows[0]?.deletedAt).not.toBeNull()
  })

  test("prices each row from its own snapshot rather than a current rate", async () => {
    const client = await makeClient({ defaultHourlyRateCents: 99_999 })
    const project = await makeProject({ clientId: client.id, hourlyRateCents: 99_999 })

    await makeTimeEntry({
      projectId: project.id,
      durationSeconds: 5400,
      hourlyRateSnapshotCents: 12_000
    })

    const result = await listWith({})

    expect(result.rows[0]?.amountCents).toBe(18_000)
  })

  test("combines filters rather than widening the result set", async () => {
    const project = await makeProject()
    const task = await makeTask({ projectId: project.id })

    await makeTimeEntry({ projectId: project.id, taskId: task.id, billable: true })
    await makeTimeEntry({ projectId: project.id, taskId: task.id, billable: false })
    await makeTimeEntry({ projectId: project.id, taskId: null, billable: true })

    const result = await listWith({ task: task.id, billable: "billable" })

    expect(result.rowCount).toBe(1)
  })
})
