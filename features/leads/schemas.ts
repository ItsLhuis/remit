import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/utils"

const LEAD_TEXT_MAX_LENGTH = 255
const LEAD_EMAIL_MAX_LENGTH = 320
const LEAD_NOTES_MAX_LENGTH = 5000
const LEAD_LOST_REASON_MAX_LENGTH = 1000

export const LEAD_STATUS_VALUES = [
  "new",
  "contacted",
  "qualified",
  "proposal_sent",
  "won",
  "lost"
] as const

export type LeadStatus = (typeof LEAD_STATUS_VALUES)[number]

export const LEAD_STATUS_FILTERS = ["active", "deleted", "all"] as const
export type LeadStatusFilter = (typeof LEAD_STATUS_FILTERS)[number]

export const LEAD_SORT_FIELDS = ["name", "company", "status", "created"] as const
export type LeadSortField = (typeof LEAD_SORT_FIELDS)[number]

const optionalTextSchema = (maxLength = LEAD_TEXT_MAX_LENGTH) =>
  z
    .string()
    .trim()
    .max(maxLength, i18n.t("leads.validation.textTooLong", { count: maxLength }))

const requiredEmailSchema = z
  .string()
  .trim()
  .min(1, i18n.t("leads.validation.emailRequired"))
  .max(
    LEAD_EMAIL_MAX_LENGTH,
    i18n.t("leads.validation.emailTooLong", { count: LEAD_EMAIL_MAX_LENGTH })
  )
  .refine((value) => z.email().safeParse(value).success, {
    message: i18n.t("leads.validation.emailInvalid")
  })

const leadStatusSchema = z.enum(LEAD_STATUS_VALUES)

const leadProfileSchema = z
  .object({
    firstName: optionalTextSchema(),
    lastName: optionalTextSchema(),
    company: optionalTextSchema(),
    email: requiredEmailSchema,
    phone: optionalTextSchema(),
    source: optionalTextSchema(),
    notes: optionalTextSchema(LEAD_NOTES_MAX_LENGTH),
    lostReason: optionalTextSchema(LEAD_LOST_REASON_MAX_LENGTH)
  })
  .refine(
    (values) =>
      values.firstName.length > 0 || values.lastName.length > 0 || values.company.length > 0,
    {
      message: i18n.t("leads.validation.nameRequired"),
      path: ["firstName"]
    }
  )

export const leadFormSchema = leadProfileSchema
export type LeadFormValues = z.infer<typeof leadFormSchema>

export const createLeadSchema = z
  .object({
    firstName: optionalTextSchema(),
    lastName: optionalTextSchema(),
    company: optionalTextSchema(),
    email: requiredEmailSchema,
    phone: optionalTextSchema(),
    source: optionalTextSchema(),
    notes: optionalTextSchema(LEAD_NOTES_MAX_LENGTH),
    lostReason: optionalTextSchema(LEAD_LOST_REASON_MAX_LENGTH),
    status: leadStatusSchema.default("new")
  })
  .refine(
    (values) =>
      values.firstName.length > 0 || values.lastName.length > 0 || values.company.length > 0,
    {
      message: i18n.t("leads.validation.nameRequired"),
      path: ["firstName"]
    }
  )
  .refine((values) => values.status !== "lost" || values.lostReason.length > 0, {
    message: i18n.t("leads.validation.lostReasonRequired"),
    path: ["lostReason"]
  })

export type CreateLeadValues = z.infer<typeof createLeadSchema>

export const updateLeadSchema = z
  .object({
    id: z.uuid(i18n.t("leads.validation.idInvalid")),
    firstName: optionalTextSchema(),
    lastName: optionalTextSchema(),
    company: optionalTextSchema(),
    email: requiredEmailSchema,
    phone: optionalTextSchema(),
    source: optionalTextSchema(),
    notes: optionalTextSchema(LEAD_NOTES_MAX_LENGTH),
    lostReason: optionalTextSchema(LEAD_LOST_REASON_MAX_LENGTH)
  })
  .refine(
    (values) =>
      values.firstName.length > 0 || values.lastName.length > 0 || values.company.length > 0,
    {
      message: i18n.t("leads.validation.nameRequired"),
      path: ["firstName"]
    }
  )

export type UpdateLeadValues = z.infer<typeof updateLeadSchema>

export const updateLeadStatusSchema = z
  .object({
    id: z.uuid(i18n.t("leads.validation.idInvalid")),
    status: leadStatusSchema,
    lostReason: optionalTextSchema(LEAD_LOST_REASON_MAX_LENGTH).default("")
  })
  .refine((values) => values.status !== "lost" || values.lostReason.length > 0, {
    message: i18n.t("leads.validation.lostReasonRequired"),
    path: ["lostReason"]
  })

export type UpdateLeadStatusValues = z.infer<typeof updateLeadStatusSchema>

export const convertLeadSchema = z.object({
  id: z.uuid(i18n.t("leads.validation.idInvalid")),
  name: z
    .string()
    .trim()
    .min(1, i18n.t("leads.validation.clientNameRequired"))
    .max(
      LEAD_TEXT_MAX_LENGTH,
      i18n.t("leads.validation.textTooLong", { count: LEAD_TEXT_MAX_LENGTH })
    ),
  currency: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => /^[A-Z]{3}$/.test(value), {
      message: i18n.t("leads.validation.currencyInvalid")
    })
})

export type ConvertLeadValues = z.infer<typeof convertLeadSchema>

export const leadIdSchema = z.object({
  id: z.uuid(i18n.t("leads.validation.idInvalid"))
})

export type LeadIdValues = z.infer<typeof leadIdSchema>

const leadSortItemSchema = z.object({
  id: z.enum(LEAD_SORT_FIELDS),
  desc: z.boolean()
})

const leadStatusFilterSchema = z.enum(LEAD_STATUS_FILTERS).catch("active")

export const leadListQuerySchema = z.object({
  search: z.string().trim().default(""),
  status: leadStatusFilterSchema.default("active"),
  stages: z.array(z.enum(LEAD_STATUS_VALUES)).default([]),
  page: z.number().int().positive().catch(1),
  perPage: z.number().int().positive().max(MAX_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE),
  sort: z.array(leadSortItemSchema).catch([{ id: "created", desc: true }])
})

export type LeadListQuery = z.infer<typeof leadListQuerySchema>

export function parseLeadListQuery(input: unknown): LeadListQuery {
  return leadListQuerySchema.parse({
    search: readStringParam(input, "search"),
    status: readStringParam(input, "status") || "active",
    stages: readArrayParam(input, "stage").filter((value): value is LeadStatus =>
      (LEAD_STATUS_VALUES as readonly string[]).includes(value)
    ),
    page: readIntParam(input, "page", 1),
    perPage: readIntParam(input, "perPage", DEFAULT_PAGE_SIZE),
    sort: readSortParam(input)
  })
}

function readStringParam(input: unknown, key: string): string {
  if (input instanceof URLSearchParams) return input.get(key) ?? ""

  if (typeof input !== "object" || input === null) return ""

  const value = (input as Record<string, unknown>)[key]

  if (Array.isArray(value)) {
    const first = value[0]

    return typeof first === "string" ? first : ""
  }

  return typeof value === "string" ? value : ""
}

function readArrayParam(input: unknown, key: string): string[] {
  const raw = readStringParam(input, key)

  if (!raw) return []

  return raw.split(",").flatMap((value) => {
    const trimmed = value.trim()

    return trimmed ? [trimmed] : []
  })
}

function readIntParam(input: unknown, key: string, fallback: number): number {
  const parsed = Number.parseInt(readStringParam(input, key), 10)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function readSortParam(input: unknown): unknown {
  const raw = readStringParam(input, "sort")

  if (!raw) return [{ id: "created", desc: true }]

  try {
    return JSON.parse(raw)
  } catch {
    return [{ id: "created", desc: true }]
  }
}
