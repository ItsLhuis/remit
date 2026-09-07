import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

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
