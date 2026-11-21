import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

import {
  isValidAmount,
  parseAmountToCents,
  readArrayParam,
  readDateAt,
  readIntParam,
  readSortParam,
  readStringParam,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE
} from "@/lib/utils"

const TIME_ENTRY_DESCRIPTION_MAX_LENGTH = 2000

const DATE_TIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

export const TIME_ENTRY_SOURCE_VALUES = ["timer", "manual"] as const
export type TimeEntrySource = (typeof TIME_ENTRY_SOURCE_VALUES)[number]

export const TIME_ENTRY_STATUS_FILTERS = ["active", "deleted", "all"] as const
export type TimeEntryStatusFilter = (typeof TIME_ENTRY_STATUS_FILTERS)[number]

export const TIME_ENTRY_BILLABLE_VALUES = ["billable", "nonBillable"] as const
export type TimeEntryBillableValue = (typeof TIME_ENTRY_BILLABLE_VALUES)[number]

export const TIME_ENTRY_INVOICED_VALUES = ["unbilled", "invoiced"] as const
export type TimeEntryInvoicedValue = (typeof TIME_ENTRY_INVOICED_VALUES)[number]

export const TIME_ENTRY_SORT_FIELDS = ["started", "duration", "project"] as const
export type TimeEntrySortField = (typeof TIME_ENTRY_SORT_FIELDS)[number]

const optionalAmountSchema = z
  .string()
  .trim()
  .refine((value) => isValidAmount(value), {
    message: i18n.t("timeTracking.validation.amountInvalid")
  })
  .transform((value) => parseAmountToCents(value))

const optionalDescriptionSchema = z
  .string()
  .trim()
  .max(
    TIME_ENTRY_DESCRIPTION_MAX_LENGTH,
    i18n.t("timeTracking.validation.descriptionTooLong", {
      count: TIME_ENTRY_DESCRIPTION_MAX_LENGTH
    })
  )

const optionalTaskIdSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || z.uuid().safeParse(value).success, {
    message: i18n.t("timeTracking.validation.taskInvalid")
  })
  .transform((value) => (value === "" ? null : value))

// The control the form binds is a `datetime-local` input, which has no zone of its own. The client
// converts its value to an instant with `fromDateTimeLocalValue` before calling the action, so this
// shape only ever validates what the browser holds — the action re-validates the instant itself.
const dateTimeLocalSchema = z
  .string()
  .trim()
  .refine((value) => DATE_TIME_LOCAL_PATTERN.test(value), {
    message: i18n.t("timeTracking.validation.dateTimeInvalid")
  })

const instantSchema = z.iso
  .datetime({ message: i18n.t("timeTracking.validation.dateTimeInvalid") })
  .transform((value) => new Date(value))

const timeEntryFieldsShape = {
  projectId: z.uuid(i18n.t("timeTracking.validation.projectRequired")),
  taskId: optionalTaskIdSchema,
  description: optionalDescriptionSchema,
  billable: z.boolean(),
  hourlyRate: optionalAmountSchema
}

// Lexicographic comparison is exact for two `datetime-local` values, which are fixed-width and share
// the browser's zone. It is a convenience check only: the action recomputes the duration from the
// instants and refuses a negative one, which is the comparison that actually guards the write.
export const timeEntryFormSchema = z
  .object({
    ...timeEntryFieldsShape,
    startedAt: dateTimeLocalSchema,
    endedAt: dateTimeLocalSchema
  })
  .superRefine((values, context) => {
    if (values.endedAt >= values.startedAt) return

    context.addIssue({
      code: "custom",
      path: ["endedAt"],
      message: i18n.t("timeTracking.validation.endBeforeStart")
    })
  })

export type TimeEntryFormInputValues = z.input<typeof timeEntryFormSchema>

export const startTimerSchema = z.object(timeEntryFieldsShape)

export type StartTimerInputValues = z.input<typeof startTimerSchema>
export type StartTimerValues = z.infer<typeof startTimerSchema>

export const createManualTimeEntrySchema = z.object({
  ...timeEntryFieldsShape,
  startedAt: instantSchema,
  endedAt: instantSchema
})

export type CreateManualTimeEntryValues = z.infer<typeof createManualTimeEntrySchema>

export const updateTimeEntrySchema = z.object({
  ...timeEntryFieldsShape,
  id: z.uuid(i18n.t("timeTracking.validation.idInvalid")),
  startedAt: instantSchema,
  endedAt: instantSchema
})

export type UpdateTimeEntryValues = z.infer<typeof updateTimeEntrySchema>

export const timeEntryIdSchema = z.object({
  id: z.uuid(i18n.t("timeTracking.validation.idInvalid"))
})

export type TimeEntryIdValues = z.infer<typeof timeEntryIdSchema>

export const timeEntryIdsSchema = z.object({
  ids: z.array(z.uuid(i18n.t("timeTracking.validation.idInvalid")))
})

const timeEntrySortItemSchema = z.object({
  id: z.enum(TIME_ENTRY_SORT_FIELDS),
  desc: z.boolean()
})

export const timeEntryListQuerySchema = z.object({
  search: z.string().trim().default(""),
  status: z.enum(TIME_ENTRY_STATUS_FILTERS).catch("active"),
  projectIds: z.array(z.uuid()).catch([]),
  taskIds: z.array(z.uuid()).catch([]),
  billable: z.array(z.enum(TIME_ENTRY_BILLABLE_VALUES)).default([]),
  invoiced: z.array(z.enum(TIME_ENTRY_INVOICED_VALUES)).default([]),
  startedFrom: z.date().nullable().catch(null),
  startedTo: z.date().nullable().catch(null),
  page: z.number().int().positive().catch(1),
  perPage: z.number().int().positive().max(MAX_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE),
  sort: z.array(timeEntrySortItemSchema).catch([{ id: "started", desc: true }])
})

export type TimeEntryListQuery = z.infer<typeof timeEntryListQuerySchema>

export function parseTimeEntryListQuery(input: unknown): TimeEntryListQuery {
  const started = readArrayParam(input, "started")

  return timeEntryListQuerySchema.parse({
    search: readStringParam(input, "search"),
    status: readStringParam(input, "status") || "active",
    projectIds: readArrayParam(input, "project"),
    taskIds: readArrayParam(input, "task"),
    billable: readArrayParam(input, "billable").filter((value): value is TimeEntryBillableValue =>
      (TIME_ENTRY_BILLABLE_VALUES as readonly string[]).includes(value)
    ),
    invoiced: readArrayParam(input, "invoiced").filter((value): value is TimeEntryInvoicedValue =>
      (TIME_ENTRY_INVOICED_VALUES as readonly string[]).includes(value)
    ),
    startedFrom: readDateAt(started, 0),
    startedTo: readDateAt(started, 1),
    page: readIntParam(input, "page", 1),
    perPage: readIntParam(input, "perPage", DEFAULT_PAGE_SIZE),
    sort: readSortParam(input, [{ id: "started", desc: true }])
  })
}
