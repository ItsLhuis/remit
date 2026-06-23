import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

import { isValidAmount, parseAmountToCents } from "@/lib/utils"

export const TASK_TITLE_MAX_LENGTH = 200
export const TASK_DESCRIPTION_MAX_LENGTH = 5000

export const TASK_STATUS_VALUES = ["backlog", "todo", "in_progress", "done", "cancelled"] as const
export type TaskStatus = (typeof TASK_STATUS_VALUES)[number]

export const TASK_PRIORITY_VALUES = ["low", "normal", "high", "urgent"] as const
export type TaskPriority = (typeof TASK_PRIORITY_VALUES)[number]

export const TASK_VIEW_VALUES = ["kanban", "table"] as const
export type TaskView = (typeof TASK_VIEW_VALUES)[number]

const taskStatusSchema = z.enum(TASK_STATUS_VALUES)
const taskPrioritySchema = z.enum(TASK_PRIORITY_VALUES)

const optionalAmountSchema = z
  .string()
  .trim()
  .refine((value) => isValidAmount(value), {
    message: i18n.t("tasks.validation.amountInvalid")
  })
  .transform((value) => parseAmountToCents(value))

const optionalDateSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: i18n.t("tasks.validation.dateInvalid")
  })
  .transform((value) => (value === "" ? null : new Date(`${value}T00:00:00.000Z`)))

const optionalDescriptionSchema = z
  .string()
  .trim()
  .max(
    TASK_DESCRIPTION_MAX_LENGTH,
    i18n.t("tasks.validation.descriptionTooLong", { count: TASK_DESCRIPTION_MAX_LENGTH })
  )

const taskFieldsShape = {
  title: z
    .string()
    .trim()
    .min(1, i18n.t("tasks.validation.titleRequired"))
    .max(
      TASK_TITLE_MAX_LENGTH,
      i18n.t("tasks.validation.titleTooLong", { count: TASK_TITLE_MAX_LENGTH })
    ),
  description: optionalDescriptionSchema,
  status: taskStatusSchema.default("todo"),
  priority: taskPrioritySchema.default("normal"),
  dueDate: optionalDateSchema,
  hourlyRate: optionalAmountSchema
}

export const taskFormSchema = z.object(taskFieldsShape)

export type TaskFormInputValues = z.input<typeof taskFormSchema>
export type TaskFormValues = z.infer<typeof taskFormSchema>

export const createTaskSchema = z.object({
  ...taskFieldsShape,
  projectId: z.uuid(i18n.t("tasks.validation.projectRequired"))
})

export type CreateTaskValues = z.infer<typeof createTaskSchema>

export const updateTaskSchema = z.object({
  ...taskFieldsShape,
  id: z.uuid(i18n.t("tasks.validation.idInvalid"))
})

export type UpdateTaskValues = z.infer<typeof updateTaskSchema>

export const updateTaskStatusSchema = z.object({
  id: z.uuid(i18n.t("tasks.validation.idInvalid")),
  status: taskStatusSchema
})

export type UpdateTaskStatusValues = z.infer<typeof updateTaskStatusSchema>

export const reorderTaskSchema = z.object({
  id: z.uuid(i18n.t("tasks.validation.idInvalid")),
  toIndex: z.number().int().min(0, i18n.t("tasks.validation.positionInvalid"))
})

export type ReorderTaskValues = z.infer<typeof reorderTaskSchema>

export const taskIdSchema = z.object({
  id: z.uuid(i18n.t("tasks.validation.idInvalid"))
})

export type TaskIdValues = z.infer<typeof taskIdSchema>

export const taskBoardParamsSchema = z.object({
  projectId: z.uuid(i18n.t("tasks.validation.projectRequired"))
})

export type TaskBoardParams = z.infer<typeof taskBoardParamsSchema>
