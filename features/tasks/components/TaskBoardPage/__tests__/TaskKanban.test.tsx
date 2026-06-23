import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, expect, test, vi } from "vitest"

import { TooltipProvider } from "@/components/ui"

import { type TaskItem } from "../../../types"
import { TaskKanban } from "../TaskKanban"

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

afterEach(() => {
  cleanup()
})

function makeTask(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: "task-1",
    projectId: "project-1",
    title: "Draft the brief",
    description: "",
    status: "todo",
    priority: "normal",
    dueAt: null,
    completedAt: null,
    position: 1000,
    hourlyRateCents: null,
    currency: "EUR",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides
  }
}

test("changes a task status through the keyboard-only menu flow", async () => {
  const user = userEvent.setup()
  const onChangeStatus = vi.fn()

  const task = makeTask()

  render(
    <TooltipProvider>
      <TaskKanban
        tasks={[task]}
        locale="en"
        onChangeStatus={onChangeStatus}
        onMove={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    </TooltipProvider>
  )

  const trigger = screen.getByRole("button", { name: "tasks.card.actions" })

  trigger.focus()

  await user.keyboard("{Enter}")
  await user.keyboard("{ArrowDown}")
  await user.keyboard("{Enter}")

  expect(onChangeStatus).toHaveBeenCalledWith(task.id, "in_progress")
})
