import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, readIntParam, readStringParam } from "@/lib/utils"

export const TRASH_ENTITY_KINDS = [
  "client",
  "clientContact",
  "contract",
  "creditNote",
  "expense",
  "invoice",
  "lead",
  "payment",
  "project",
  "proposal",
  "recurringInvoice",
  "task",
  "taxRate",
  "template",
  "timeEntry"
] as const

export type TrashEntityKind = (typeof TRASH_ENTITY_KINDS)[number]

export const restoreTrashedRecordSchema = z.object({
  kind: z.enum(TRASH_ENTITY_KINDS, i18n.t("trash.validation.kindInvalid")),
  id: z.uuid(i18n.t("trash.validation.idInvalid"))
})

export type RestoreTrashedRecordValues = z.infer<typeof restoreTrashedRecordSchema>

// The trash shares `/settings/data` with the export history table, so its paging parameters carry a
// prefix (`useDataTable`'s `urlKeyPrefix`); without one, paging either table would page both.
export const TRASH_URL_KEY_PREFIX = "trash_"

const trashListQuerySchema = z.object({
  page: z.number().int().positive().catch(1),
  perPage: z.number().int().positive().max(MAX_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE),
  // Set when an activity-feed row links to a deleted record: the trash narrows to that one record.
  record: z
    .object({ kind: z.enum(TRASH_ENTITY_KINDS), id: z.uuid() })
    .nullable()
    .catch(null)
})

export type TrashListQuery = z.infer<typeof trashListQuerySchema>

export function parseTrashListQuery(input: unknown): TrashListQuery {
  const kind = readStringParam(input, `${TRASH_URL_KEY_PREFIX}kind`)
  const id = readStringParam(input, `${TRASH_URL_KEY_PREFIX}record`)

  return trashListQuerySchema.parse({
    page: readIntParam(input, `${TRASH_URL_KEY_PREFIX}page`, 1),
    perPage: readIntParam(input, `${TRASH_URL_KEY_PREFIX}perPage`, DEFAULT_PAGE_SIZE),
    record: kind && id ? { kind, id } : null
  })
}

// Empty means "never purge", which is why the field is a string the server turns into `null` rather
// than a number with a sentinel value: a retention window nobody has set and one set to zero days
// are opposite instructions.
const retentionDaysField = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 3650),
    i18n.t("trash.retention.validation.rangeInvalid")
  )
  .transform((value) => (value === "" ? null : Number(value)))

export const retentionPolicyFormSchema = z
  .object({
    trashDays: retentionDaysField,
    financialDays: retentionDaysField
  })
  .refine(
    ({ trashDays, financialDays }) =>
      trashDays === null || financialDays === null || financialDays >= trashDays,
    { message: i18n.t("trash.retention.validation.orderInvalid"), path: ["financialDays"] }
  )

export type RetentionPolicyFormInputValues = z.input<typeof retentionPolicyFormSchema>
