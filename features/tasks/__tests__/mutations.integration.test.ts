import { and, asc, eq, isNull } from "drizzle-orm"

import { beforeEach, describe, expect, test, vi } from "vitest"

import { auditLogs, tasks } from "@/database/schema"

import { makeProject, makeTask, makeUser } from "@/tests/factories"
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
  getCurrentRole: mocks.getCurrentRole
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

const ownerId = "00000000-0000-4000-8000-000000000a01"
const ownerEmail = "owner-tasks@example.com"

async function listColumn(projectId: string) {
  return database
    .select({ id: tasks.id, position: tasks.position })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), isNull(tasks.deletedAt)))
    .orderBy(asc(tasks.position), asc(tasks.createdAt))
}

describe("task mutations", () => {
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

  test("creates a task with a sparse starting position and integer-cent rate", async () => {
    const { createTask } = await import("../mutations")

    const project = await makeProject()

    const result = await createTask({
      projectId: project.id,
      title: "Draft the brief",
      description: "Outline the work",
      status: "todo",
      priority: "high",
      dueDate: "2026-03-01",
      hourlyRate: "90.50"
    })
    const [taskRow] = await database.select().from(tasks)
    const auditRows = await database.select().from(auditLogs)

    expect("data" in result).toBe(true)
    expect(taskRow).toEqual(
      expect.objectContaining({
        title: "Draft the brief",
        status: "todo",
        priority: "high",
        position: 1000,
        hourlyRateCents: 9050,
        deletedAt: null
      })
    )
    expect(auditRows[0]?.event).toBe("task.created")
    expect(auditRows[0]?.targetEntityType).toBe("task")
    expect(mocks.emit).toHaveBeenCalledWith("task.created", {
      taskId: taskRow?.id,
      projectId: project.id,
      userId: ownerId
    })
  })

  test("appends new tasks within a status column at increasing positions", async () => {
    const { createTask } = await import("../mutations")

    const project = await makeProject()

    await createTask({
      projectId: project.id,
      title: "First",
      description: "",
      status: "todo",
      priority: "normal",
      dueDate: "",
      hourlyRate: ""
    })
    await createTask({
      projectId: project.id,
      title: "Second",
      description: "",
      status: "todo",
      priority: "normal",
      dueDate: "",
      hourlyRate: ""
    })

    const column = await listColumn(project.id)

    expect(column.map((task) => task.position)).toEqual([1000, 2000])
  })

  test("marks a task done and records the completion time", async () => {
    const { updateTaskStatus } = await import("../mutations")

    const task = await makeTask({ status: "in_progress" })

    const result = await updateTaskStatus({ id: task.id, status: "done" })
    const [taskRow] = await database.select().from(tasks).where(eq(tasks.id, task.id))

    expect("data" in result).toBe(true)
    expect(taskRow?.status).toBe("done")
    expect(taskRow?.completedAt).toBeInstanceOf(Date)
    expect(mocks.emit).toHaveBeenCalledWith("task.status_changed", {
      taskId: task.id,
      projectId: task.projectId,
      userId: ownerId,
      from: "in_progress",
      to: "done"
    })
  })

  test("rejects a no-op status change", async () => {
    const { updateTaskStatus } = await import("../mutations")

    const task = await makeTask({ status: "todo" })

    const result = await updateTaskStatus({ id: task.id, status: "todo" })

    expect(result).toEqual({ error: "That status change is not allowed" })
  })

  test("reorders within a column using the integer midpoint when a gap exists", async () => {
    const { reorderTask } = await import("../mutations")

    const project = await makeProject()
    const first = await makeTask({ projectId: project.id, status: "todo", position: 1000 })
    const second = await makeTask({ projectId: project.id, status: "todo", position: 2000 })
    const third = await makeTask({ projectId: project.id, status: "todo", position: 3000 })

    await reorderTask({ id: third.id, toIndex: 0 })

    const column = await listColumn(project.id)

    expect(column.map((task) => task.id)).toEqual([third.id, first.id, second.id])
  })

  test("repacks the column when adjacent positions leave no integer gap", async () => {
    const { reorderTask } = await import("../mutations")

    const project = await makeProject()
    const first = await makeTask({ projectId: project.id, status: "todo", position: 1 })
    const second = await makeTask({ projectId: project.id, status: "todo", position: 2 })
    const third = await makeTask({ projectId: project.id, status: "todo", position: 3 })

    await reorderTask({ id: third.id, toIndex: 1 })

    const column = await listColumn(project.id)

    expect(column).toEqual([
      { id: first.id, position: 1000 },
      { id: third.id, position: 2000 },
      { id: second.id, position: 3000 }
    ])
  })

  test("soft deletes a task and hides it from the project board", async () => {
    const { softDeleteTask } = await import("../mutations")
    const { listTasksByProject } = await import("../queries")

    const task = await makeTask({ title: "Doomed" })

    const result = await softDeleteTask({ id: task.id })
    const remaining = await listTasksByProject(task.projectId)

    expect(result).toEqual({ data: { id: task.id } })
    expect(remaining).toHaveLength(0)
    expect(mocks.emit).toHaveBeenCalledWith("task.deleted", {
      taskId: task.id,
      projectId: task.projectId,
      userId: ownerId
    })
  })

  test("prevents assistants from deleting tasks", async () => {
    const { softDeleteTask } = await import("../mutations")

    const task = await makeTask({ title: "Protected" })
    mocks.getCurrentRole.mockResolvedValueOnce("assistant")

    const result = await softDeleteTask({ id: task.id })
    const remaining = await database.select().from(tasks).where(isNull(tasks.deletedAt))

    expect(result).toEqual({ error: "You do not have permission to do that" })
    expect(remaining).toHaveLength(1)
  })
})
