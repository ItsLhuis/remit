import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

import { readIntParam, readStringParam, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/utils"

// A hand restatement of the `entity_type` database enum rather than a read of the Drizzle enum
// object, because this module is client-safe and that import would pull drizzle-orm into the browser
// bundle. types.ts carries the compile-time tie that stops the two drifting.
export const ACTIVITY_ENTITY_TYPES = [
  "client",
  "project",
  "proposal",
  "invoice",
  "contract",
  "task",
  "time_entry",
  "expense",
  "payment"
] as const

export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number]

export const ACTIVITY_READ_FILTERS = ["all", "unread"] as const

export type ActivityReadFilter = (typeof ACTIVITY_READ_FILTERS)[number]

export const activityIdsSchema = z.object({
  ids: z
    .array(z.uuid(i18n.t("activity.errors.idInvalid")))
    .min(1, i18n.t("activity.errors.idInvalid"))
    // Bounded by the largest page the feed can render, which is the only place a bulk selection can
    // come from. Without it a caller could hand the action an unbounded `IN (...)` list.
    .max(MAX_PAGE_SIZE, i18n.t("activity.errors.idInvalid"))
})

export const activityIdSchema = z.object({
  id: z.uuid(i18n.t("activity.errors.idInvalid"))
})

// `message_args` is `jsonb`, so nothing at the database level constrains its shape. Narrowing it
// back to ICU-formattable scalars on read is what stops a malformed row rendering as
// "[object Object]" inside an otherwise correct message.
export const activityMessageArgsSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()])
)

export type ActivityMessageArgs = z.infer<typeof activityMessageArgsSchema>

export const activityEntityFilterSchema = z.object({
  entityType: z.enum(ACTIVITY_ENTITY_TYPES),
  entityId: z.uuid(i18n.t("activity.errors.idInvalid"))
})

export const activityListQuerySchema = z.object({
  entityType: z.enum(ACTIVITY_ENTITY_TYPES).nullable().catch(null),
  read: z.enum(ACTIVITY_READ_FILTERS).catch("all"),
  page: z.number().int().positive().catch(1),
  perPage: z.number().int().positive().max(MAX_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE)
})

export type ActivityListQuery = z.infer<typeof activityListQuerySchema>

export function parseActivityListQuery(input: unknown): ActivityListQuery {
  return activityListQuerySchema.parse({
    entityType: readStringParam(input, "type") || null,
    read: readStringParam(input, "read") || "all",
    page: readIntParam(input, "page", 1),
    perPage: readIntParam(input, "perPage", DEFAULT_PAGE_SIZE)
  })
}
