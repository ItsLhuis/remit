import { act } from "react"

import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { afterEach, expect, test, vi } from "vitest"

import { TooltipProvider } from "@/components/ui"

import { type TaskItem } from "../../../types"
import { TaskKanban } from "../TaskKanban"

const dnd = vi.hoisted(() => ({
  props: null as Record<string, (event: unknown) => unknown> | null
}))

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
    ready: true,
    locales: {}
  })
}))

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children, ...props }: { children: React.ReactNode }) => {
    dnd.props = props as Record<string, (event: unknown) => unknown>

    return children
  },
  DragOverlay: ({ children }: { children: React.ReactNode }) => children,
  closestCorners: vi.fn(),
  KeyboardSensor: class {},
  PointerSensor: class {},
  useSensor: () => ({}),
  useSensors: () => [],
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false })
}))

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => children,
  verticalListSortingStrategy: vi.fn(),
  sortableKeyboardCoordinates: vi.fn(),
  arrayMove: <T,>(items: T[], from: number, to: number) => {
    const next = [...items]
    const [moved] = next.splice(from, 1)

    next.splice(to, 0, moved)

    return next
  },
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false
  })
}))

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => undefined } }
}))

afterEach(() => {
  cleanup()

  dnd.props = null
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

function renderBoard(
  overrides: { tasks?: TaskItem[]; search?: string; priorities?: TaskItem["priority"][] } = {}
) {
  const onPersistMove = vi.fn().mockResolvedValue(true)
  const onPersistCreate = vi.fn().mockResolvedValue(true)

  render(
    <TooltipProvider>
      <TaskKanban
        tasks={overrides.tasks ?? [makeTask()]}
        locale="en"
        projectId="project-1"
        currency="EUR"
        search={overrides.search ?? ""}
        priorities={overrides.priorities ?? []}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onPersistMove={onPersistMove}
        onPersistCreate={onPersistCreate}
      />
    </TooltipProvider>
  )

  return { onPersistMove, onPersistCreate }
}

function getColumnCount(status: string): string | null {
  const header = screen.getByText(`tasks.status.${status}`).closest("div")

  if (!header) throw new Error(`Column header not found for ${status}`)

  return within(header).getByText(/^\d+$/).textContent
}

test("renders a column for every task status", () => {
  renderBoard()

  for (const status of ["backlog", "todo", "in_progress", "done", "cancelled"]) {
    expect(screen.getByText(`tasks.status.${status}`)).toBeInTheDocument()
  }
})

test("places each task in the column matching its status", () => {
  renderBoard({
    tasks: [
      makeTask({ id: "a", title: "Todo task", status: "todo" }),
      makeTask({ id: "b", title: "Running task", status: "in_progress" })
    ]
  })

  expect(screen.getByText("Todo task")).toBeInTheDocument()
  expect(screen.getByText("Running task")).toBeInTheDocument()
  expect(getColumnCount("todo")).toBe("1")
  expect(getColumnCount("in_progress")).toBe("1")
  expect(getColumnCount("done")).toBe("0")
})

test("shows the drop-zone empty state for every column without tasks", () => {
  renderBoard({ tasks: [makeTask({ status: "todo" })] })

  expect(screen.getAllByText("tasks.columns.dropHint")).toHaveLength(4)
})

test("persists a move with the target status and index when a task is dropped in another column", async () => {
  const { onPersistMove } = renderBoard({ tasks: [makeTask({ id: "t1", status: "todo" })] })

  await act(async () => {
    dnd.props?.onDragStart({ active: { id: "t1" } })
  })
  await act(async () => {
    dnd.props?.onDragOver({ active: { id: "t1" }, over: { id: "done" } })
  })
  await act(async () => {
    await dnd.props?.onDragEnd({ active: { id: "t1" }, over: { id: "done" } })
  })

  expect(onPersistMove).toHaveBeenCalledWith({
    id: "t1",
    fromStatus: "todo",
    toStatus: "done",
    toIndex: 0
  })
})

test("fires no mutation when a task is dropped in its original position", async () => {
  const { onPersistMove } = renderBoard({ tasks: [makeTask({ id: "t1", status: "todo" })] })

  await act(async () => {
    dnd.props?.onDragStart({ active: { id: "t1" } })
  })
  await act(async () => {
    await dnd.props?.onDragEnd({ active: { id: "t1" }, over: { id: "t1" } })
  })

  expect(onPersistMove).not.toHaveBeenCalled()
})

test("creates a task in the column where quick add is used", async () => {
  const user = userEvent.setup()

  const { onPersistCreate } = renderBoard({ tasks: [makeTask({ status: "todo" })] })

  const todoColumn = screen.getByText("tasks.status.todo").closest('[data-slot="card"]')

  if (!todoColumn) throw new Error("Todo column not found")

  await user.click(
    within(todoColumn as HTMLElement).getByRole("button", { name: "tasks.quickAdd.button" })
  )

  const input = within(todoColumn as HTMLElement).getByPlaceholderText("tasks.quickAdd.placeholder")

  await user.type(input, "Write the spec{Enter}")

  await waitFor(() => expect(onPersistCreate).toHaveBeenCalledWith("todo", "Write the spec"))
})

test("hides tasks whose title does not match the search term", () => {
  renderBoard({
    tasks: [makeTask({ id: "a", title: "Alpha" }), makeTask({ id: "b", title: "Beta" })],
    search: "alph"
  })

  expect(screen.getByText("Alpha")).toBeInTheDocument()
  expect(screen.queryByText("Beta")).not.toBeInTheDocument()
})

test("hides tasks whose priority is not in the active priority filter", () => {
  renderBoard({
    tasks: [
      makeTask({ id: "h", title: "High one", priority: "high" }),
      makeTask({ id: "l", title: "Low one", priority: "low" })
    ],
    priorities: ["high"]
  })

  expect(screen.getByText("High one")).toBeInTheDocument()
  expect(screen.queryByText("Low one")).not.toBeInTheDocument()
})

test("persists a status change through the keyboard-only card menu flow", async () => {
  const user = userEvent.setup()

  const { onPersistMove } = renderBoard({
    tasks: [makeTask({ id: "t1", title: "Task one", status: "todo" })]
  })

  const card = screen.getByText("Task one").closest('[data-slot="card"]')

  if (!card) throw new Error("Task card not found")

  within(card as HTMLElement)
    .getByRole("button", { name: "tasks.card.actions" })
    .focus()

  await user.keyboard("{Enter}")
  await user.keyboard("{ArrowDown}")
  await user.keyboard("{ArrowRight}")
  await user.keyboard("{Enter}")

  await waitFor(() =>
    expect(onPersistMove).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t1", fromStatus: "todo", toStatus: "backlog" })
    )
  )
})
