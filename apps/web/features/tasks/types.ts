import { type TaskFormInputValues, type TaskPriority, type TaskStatus } from "./schemas"

export type TaskItem = {
  id: string
  projectId: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  dueAt: Date | null
  completedAt: Date | null
  position: number
  hourlyRateCents: number | null
  currency: string
  createdAt: Date
  updatedAt: Date
}

export type TaskDefaults = {
  defaultCurrency: string
  defaultLocale: string
}

export type TaskBoardData = {
  projectId: string
  projectName: string
  currency: string
  tasks: TaskItem[]
  defaults: TaskDefaults
}

export type TaskFormData = TaskFormInputValues & {
  id: string
}
