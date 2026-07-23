import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

import {
  isValidAmount,
  parseAmountToCents,
  readArrayParam,
  readIntParam,
  readSortParam,
  readStringParam,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE
} from "@/lib/utils"

const PROJECT_NAME_MAX_LENGTH = 200
const PROJECT_DESCRIPTION_MAX_LENGTH = 5000

export const PROJECT_STATUS_VALUES = ["active", "completed", "on_hold", "cancelled"] as const
export type ProjectStatus = (typeof PROJECT_STATUS_VALUES)[number]

export const PROJECT_STATUS_FILTERS = ["active", "deleted", "all"] as const
export type ProjectStatusFilter = (typeof PROJECT_STATUS_FILTERS)[number]

export const PROJECT_SORT_FIELDS = ["name", "client", "status", "created"] as const
export type ProjectSortField = (typeof PROJECT_SORT_FIELDS)[number]

const projectStatusSchema = z.enum(PROJECT_STATUS_VALUES)

const optionalAmountSchema = z
  .string()
  .trim()
  .refine((value) => isValidAmount(value), {
    message: i18n.t("projects.validation.amountInvalid")
  })
  .transform((value) => parseAmountToCents(value))

const optionalDateSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: i18n.t("projects.validation.dateInvalid")
  })
  // The explicit `T00:00:00.000Z` pins a date-only input to UTC midnight. Handing the bare
  // "YYYY-MM-DD" to `new Date` would be read in the server's local zone, so a project west of UTC
  // would persist the previous day (see `money-and-dates.md`: dates are stored in UTC).
  .transform((value) => (value === "" ? null : new Date(`${value}T00:00:00.000Z`)))

const optionalDescriptionSchema = z
  .string()
  .trim()
  .max(
    PROJECT_DESCRIPTION_MAX_LENGTH,
    i18n.t("projects.validation.descriptionTooLong", { count: PROJECT_DESCRIPTION_MAX_LENGTH })
  )

const projectFieldsShape = {
  clientId: z.uuid(i18n.t("projects.validation.clientRequired")),
  name: z
    .string()
    .trim()
    .min(1, i18n.t("projects.validation.nameRequired"))
    .max(
      PROJECT_NAME_MAX_LENGTH,
      i18n.t("projects.validation.nameTooLong", { count: PROJECT_NAME_MAX_LENGTH })
    ),
  budget: optionalAmountSchema,
  hourlyRate: optionalAmountSchema,
  startDate: optionalDateSchema,
  endDate: optionalDateSchema,
  description: optionalDescriptionSchema
}

function isDateOrderValid(values: { startDate: Date | null; endDate: Date | null }): boolean {
  return values.startDate === null || values.endDate === null || values.endDate >= values.startDate
}

const dateOrderError = {
  message: i18n.t("projects.validation.endBeforeStart"),
  path: ["endDate"]
}

export const projectFormSchema = z
  .object(projectFieldsShape)
  .refine(isDateOrderValid, dateOrderError)

export type ProjectFormInputValues = z.input<typeof projectFormSchema>
export type ProjectFormValues = z.infer<typeof projectFormSchema>

export const createProjectSchema = z
  .object({ ...projectFieldsShape, status: projectStatusSchema.default("active") })
  .refine(isDateOrderValid, dateOrderError)

export type CreateProjectValues = z.infer<typeof createProjectSchema>

export const updateProjectSchema = z
  .object({ ...projectFieldsShape, id: z.uuid(i18n.t("projects.validation.idInvalid")) })
  .refine(isDateOrderValid, dateOrderError)

export type UpdateProjectValues = z.infer<typeof updateProjectSchema>

export const updateProjectStatusSchema = z.object({
  id: z.uuid(i18n.t("projects.validation.idInvalid")),
  status: projectStatusSchema
})

export type UpdateProjectStatusValues = z.infer<typeof updateProjectStatusSchema>

export const projectIdSchema = z.object({
  id: z.uuid(i18n.t("projects.validation.idInvalid"))
})

export type ProjectIdValues = z.infer<typeof projectIdSchema>

const projectSortItemSchema = z.object({
  id: z.enum(PROJECT_SORT_FIELDS),
  desc: z.boolean()
})

const projectStatusFilterSchema = z.enum(PROJECT_STATUS_FILTERS).catch("active")

export const projectListQuerySchema = z.object({
  search: z.string().trim().default(""),
  status: projectStatusFilterSchema.default("active"),
  stages: z.array(z.enum(PROJECT_STATUS_VALUES)).default([]),
  page: z.number().int().positive().catch(1),
  perPage: z.number().int().positive().max(MAX_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE),
  sort: z.array(projectSortItemSchema).catch([{ id: "created", desc: true }])
})

export type ProjectListQuery = z.infer<typeof projectListQuerySchema>

export function parseProjectListQuery(input: unknown): ProjectListQuery {
  return projectListQuerySchema.parse({
    search: readStringParam(input, "search"),
    status: readStringParam(input, "status") || "active",
    stages: readArrayParam(input, "stage").filter((value): value is ProjectStatus =>
      (PROJECT_STATUS_VALUES as readonly string[]).includes(value)
    ),
    page: readIntParam(input, "page", 1),
    perPage: readIntParam(input, "perPage", DEFAULT_PAGE_SIZE),
    sort: readSortParam(input, [{ id: "created", desc: true }])
  })
}
