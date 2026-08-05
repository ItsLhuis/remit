import { eq } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, timeEntries } from "@/database/schema"

import {
  makeClient,
  makeInvoice,
  makeProject,
  makeSettings,
  makeTask,
  makeTimeEntry,
  makeUser
} from "@/tests/factories"
import { database } from "@/tests/integration/database"

const mocks = vi.hoisted(() => ({
  emit: vi.fn(),
  getCurrentRole: vi.fn(),
  getSession: vi.fn(),
  headers: vi.fn(),
  loggerError: vi.fn(),
  revalidatePath: vi.fn()
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}))

vi.mock("next/headers", () => ({
  headers: mocks.headers
}))

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mocks.getSession
    }
  }
}))

vi.mock("@/lib/auth/session", () => ({
  getCurrentRole: mocks.getCurrentRole,
  getSession: mocks.getSession
}))

vi.mock("@/lib/events", () => ({
  emit: mocks.emit
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    fatal: vi.fn(),
    warn: vi.fn()
  }
}))

const ownerId = "00000000-0000-4000-8000-000000000b01"
const ownerEmail = "owner-time@example.com"

const STARTED_AT = "2026-08-05T09:00:00.000Z"
const ENDED_AT = "2026-08-05T10:30:00.000Z"

function manualInput(projectId: string, overrides?: Record<string, unknown>) {
  return {
    projectId,
    taskId: "",
    description: "Design review",
    startedAt: STARTED_AT,
    endedAt: ENDED_AT,
    billable: true,
    hourlyRate: "",
    ...overrides
  }
}

describe("time entry mutations", () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    await makeUser({ id: ownerId, email: ownerEmail })

    mocks.headers.mockResolvedValue(
      new Headers({
        "user-agent": "Vitest",
        "x-forwarded-for": "203.0.113.50, 198.51.100.2"
      })
    )
    mocks.getSession.mockResolvedValue({
      user: { id: ownerId, email: ownerEmail }
    })
    mocks.getCurrentRole.mockResolvedValue("owner")
  })

  test("snapshots the entry override when one is given", async () => {
    const { createManualTimeEntry } = await import("../mutations")

    await makeSettings({ defaultHourlyRateCents: 1000 })
    const client = await makeClient({ defaultHourlyRateCents: 2000 })
    const project = await makeProject({ clientId: client.id, hourlyRateCents: 3000 })
    const task = await makeTask({ projectId: project.id, hourlyRateCents: 4000 })

    const result = await createManualTimeEntry(
      manualInput(project.id, { taskId: task.id, hourlyRate: "50.00" })
    )
    const [row] = await database.select().from(timeEntries)

    expect("data" in result).toBe(true)
    expect(row?.hourlyRateOverrideCents).toBe(5000)
    expect(row?.hourlyRateSnapshotCents).toBe(5000)
  })

  test("snapshots the task rate when the entry has no override", async () => {
    const { createManualTimeEntry } = await import("../mutations")

    await makeSettings({ defaultHourlyRateCents: 1000 })
    const client = await makeClient({ defaultHourlyRateCents: 2000 })
    const project = await makeProject({ clientId: client.id, hourlyRateCents: 3000 })
    const task = await makeTask({ projectId: project.id, hourlyRateCents: 4000 })

    await createManualTimeEntry(manualInput(project.id, { taskId: task.id }))
    const [row] = await database.select().from(timeEntries)

    expect(row?.hourlyRateSnapshotCents).toBe(4000)
  })

  test("snapshots the project rate when neither the entry nor the task carries one", async () => {
    const { createManualTimeEntry } = await import("../mutations")

    await makeSettings({ defaultHourlyRateCents: 1000 })
    const client = await makeClient({ defaultHourlyRateCents: 2000 })
    const project = await makeProject({ clientId: client.id, hourlyRateCents: 3000 })

    await createManualTimeEntry(manualInput(project.id))
    const [row] = await database.select().from(timeEntries)

    expect(row?.hourlyRateSnapshotCents).toBe(3000)
  })

  test("snapshots the client rate when the project has none", async () => {
    const { createManualTimeEntry } = await import("../mutations")

    await makeSettings({ defaultHourlyRateCents: 1000 })
    const client = await makeClient({ defaultHourlyRateCents: 2000 })
    const project = await makeProject({ clientId: client.id, hourlyRateCents: null })

    await createManualTimeEntry(manualInput(project.id))
    const [row] = await database.select().from(timeEntries)

    expect(row?.hourlyRateSnapshotCents).toBe(2000)
  })

  test("snapshots the instance default when no other rate is configured", async () => {
    const { createManualTimeEntry } = await import("../mutations")

    await makeSettings({ defaultHourlyRateCents: 1000 })
    const client = await makeClient({ defaultHourlyRateCents: null })
    const project = await makeProject({ clientId: client.id, hourlyRateCents: null })

    await createManualTimeEntry(manualInput(project.id))
    const [row] = await database.select().from(timeEntries)

    expect(row?.hourlyRateSnapshotCents).toBe(1000)
  })

  test("snapshots no rate when the instance has never configured one", async () => {
    const { createManualTimeEntry } = await import("../mutations")

    await makeSettings({ defaultHourlyRateCents: null })
    const client = await makeClient({ defaultHourlyRateCents: null })
    const project = await makeProject({ clientId: client.id, hourlyRateCents: null })

    await createManualTimeEntry(manualInput(project.id))
    const [row] = await database.select().from(timeEntries)

    expect(row?.hourlyRateSnapshotCents).toBe(0)
  })

  test("stores the duration of a manual entry in whole seconds", async () => {
    const { createManualTimeEntry } = await import("../mutations")

    const project = await makeProject()

    await createManualTimeEntry(manualInput(project.id))
    const [row] = await database.select().from(timeEntries)

    expect(row?.durationSeconds).toBe(5400)
    expect(row?.source).toBe("manual")
  })

  test("stores the true elapsed duration for an entry crossing midnight", async () => {
    const { createManualTimeEntry } = await import("../mutations")

    const project = await makeProject()

    await createManualTimeEntry(
      manualInput(project.id, {
        startedAt: "2026-08-05T23:30:00.000Z",
        endedAt: "2026-08-06T00:45:00.000Z"
      })
    )
    const [row] = await database.select().from(timeEntries)

    expect(row?.durationSeconds).toBe(4500)
  })

  test("refuses a manual entry that ends before it starts", async () => {
    const { createManualTimeEntry } = await import("../mutations")

    const project = await makeProject()

    const result = await createManualTimeEntry(
      manualInput(project.id, { startedAt: ENDED_AT, endedAt: STARTED_AT })
    )
    const rows = await database.select().from(timeEntries)

    expect("error" in result).toBe(true)
    expect(rows).toHaveLength(0)
  })

  test("refuses a task that belongs to a different project", async () => {
    const { createManualTimeEntry } = await import("../mutations")

    const project = await makeProject()
    const otherTask = await makeTask()

    const result = await createManualTimeEntry(manualInput(project.id, { taskId: otherTask.id }))
    const rows = await database.select().from(timeEntries)

    expect("error" in result).toBe(true)
    expect(rows).toHaveLength(0)
  })

  test("emits time.logged once a manual entry is stored", async () => {
    const { createManualTimeEntry } = await import("../mutations")

    const project = await makeProject()

    await createManualTimeEntry(manualInput(project.id))
    const [row] = await database.select().from(timeEntries)

    expect(mocks.emit).toHaveBeenCalledWith("time.logged", {
      timeEntryId: row?.id,
      projectId: project.id,
      taskId: null,
      userId: ownerId,
      durationSeconds: 5400,
      billable: true
    })
  })

  test("starts a timer with no end and no duration", async () => {
    const { startTimer } = await import("../mutations")

    const project = await makeProject({ hourlyRateCents: 7500 })

    const result = await startTimer({
      projectId: project.id,
      taskId: "",
      description: "Kickoff",
      billable: true,
      hourlyRate: ""
    })
    const [row] = await database.select().from(timeEntries)
    const auditRows = await database.select().from(auditLogs)

    expect("data" in result).toBe(true)
    expect(row?.endedAt).toBeNull()
    expect(row?.durationSeconds).toBeNull()
    expect(row?.hourlyRateSnapshotCents).toBe(7500)
    expect(row?.source).toBe("timer")
    expect(auditRows[0]?.event).toBe("time_entry.timer_started")
    expect(auditRows[0]?.ipAddress).toBe("203.0.113.50")
    expect(mocks.emit).not.toHaveBeenCalled()
  })

  test("refuses a second running timer for the same user", async () => {
    const { startTimer } = await import("../mutations")

    const project = await makeProject()

    await startTimer({
      projectId: project.id,
      taskId: "",
      description: "First",
      billable: true,
      hourlyRate: ""
    })
    const result = await startTimer({
      projectId: project.id,
      taskId: "",
      description: "Second",
      billable: true,
      hourlyRate: ""
    })
    const rows = await database.select().from(timeEntries)

    expect("error" in result).toBe(true)
    expect(rows).toHaveLength(1)
  })

  test("allows a new timer once the running one has been stopped", async () => {
    const { startTimer, stopTimer } = await import("../mutations")

    const project = await makeProject()
    const started = await startTimer({
      projectId: project.id,
      taskId: "",
      description: "First",
      billable: true,
      hourlyRate: ""
    })

    if ("error" in started) throw new Error(started.error)

    await stopTimer({ id: started.data.id })
    const result = await startTimer({
      projectId: project.id,
      taskId: "",
      description: "Second",
      billable: true,
      hourlyRate: ""
    })
    const rows = await database.select().from(timeEntries)

    expect("data" in result).toBe(true)
    expect(rows).toHaveLength(2)
  })

  test("stops a running timer and records its elapsed duration", async () => {
    const { startTimer, stopTimer } = await import("../mutations")

    const project = await makeProject()
    const started = await startTimer({
      projectId: project.id,
      taskId: "",
      description: "Kickoff",
      billable: true,
      hourlyRate: ""
    })

    if ("error" in started) throw new Error(started.error)

    const result = await stopTimer({ id: started.data.id })
    const [row] = await database.select().from(timeEntries)

    expect("data" in result).toBe(true)
    expect(row?.endedAt).not.toBeNull()
    expect(row?.durationSeconds).toBeGreaterThanOrEqual(0)
    expect(mocks.emit).toHaveBeenCalledWith(
      "time.logged",
      expect.objectContaining({ timeEntryId: started.data.id, projectId: project.id })
    )
  })

  test("refuses to stop a timer that is not running", async () => {
    const { stopTimer } = await import("../mutations")

    const entry = await makeTimeEntry({ userId: ownerId })

    const result = await stopTimer({ id: entry.id })

    expect("error" in result).toBe(true)
  })

  test("re-resolves the snapshot when an entry is edited", async () => {
    const { createManualTimeEntry, updateTimeEntry } = await import("../mutations")

    const project = await makeProject({ hourlyRateCents: 3000 })
    const created = await createManualTimeEntry(manualInput(project.id))

    if ("error" in created) throw new Error(created.error)

    const [before] = await database.select().from(timeEntries)

    await updateTimeEntry({
      ...manualInput(project.id, { hourlyRate: "12.00" }),
      id: before?.id ?? ""
    })
    const [after] = await database.select().from(timeEntries)

    expect(before?.hourlyRateSnapshotCents).toBe(3000)
    expect(after?.hourlyRateSnapshotCents).toBe(1200)
    expect(after?.hourlyRateOverrideCents).toBe(1200)
  })

  test("refuses to edit an entry that has already been invoiced", async () => {
    const { updateTimeEntry } = await import("../mutations")

    const project = await makeProject()
    const invoice = await makeInvoice({ projectId: project.id })
    const entry = await makeTimeEntry({ projectId: project.id, invoicedInId: invoice.id })

    const result = await updateTimeEntry({ ...manualInput(project.id), id: entry.id })

    expect("error" in result).toBe(true)
  })

  test("refuses to delete an entry that has already been invoiced", async () => {
    const { softDeleteTimeEntry } = await import("../mutations")

    const project = await makeProject()
    const invoice = await makeInvoice({ projectId: project.id })
    const entry = await makeTimeEntry({ projectId: project.id, invoicedInId: invoice.id })

    const result = await softDeleteTimeEntry({ id: entry.id })
    const [row] = await database.select().from(timeEntries).where(eq(timeEntries.id, entry.id))

    expect("error" in result).toBe(true)
    expect(row?.deletedAt).toBeNull()
  })

  test("soft deletes an uninvoiced entry", async () => {
    const { softDeleteTimeEntry } = await import("../mutations")

    const entry = await makeTimeEntry()

    const result = await softDeleteTimeEntry({ id: entry.id })
    const [row] = await database.select().from(timeEntries).where(eq(timeEntries.id, entry.id))

    expect("data" in result).toBe(true)
    expect(row?.deletedAt).not.toBeNull()
  })

  test("refuses a write from a role without permission", async () => {
    const { createManualTimeEntry } = await import("../mutations")

    mocks.getCurrentRole.mockResolvedValue("accountant")

    const project = await makeProject()

    const result = await createManualTimeEntry(manualInput(project.id))
    const rows = await database.select().from(timeEntries)

    expect("error" in result).toBe(true)
    expect(rows).toHaveLength(0)
  })

  test("refuses a delete from a role that is not the owner", async () => {
    const { softDeleteTimeEntry } = await import("../mutations")

    mocks.getCurrentRole.mockResolvedValue("assistant")

    const entry = await makeTimeEntry()

    const result = await softDeleteTimeEntry({ id: entry.id })

    expect("error" in result).toBe(true)
  })
})
