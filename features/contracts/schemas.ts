import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

import {
  readArrayParam,
  readIntParam,
  readSortParam,
  readStringParam,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE
} from "@/lib/utils"

import { blocksSchema } from "@/features/templates"

export const CONTRACT_STATUS_VALUES = ["draft", "sent", "signed", "expired", "terminated"] as const

export const contractStatusSchema = z.enum(CONTRACT_STATUS_VALUES)

export type ContractStatus = z.infer<typeof contractStatusSchema>

export const contractIdSchema = z.object({ id: z.uuid(i18n.t("contracts.validation.idInvalid")) })

export type ContractIdValues = z.infer<typeof contractIdSchema>

const contractBaseSchema = z.object({
  title: z.string().trim().min(1, i18n.t("contracts.validation.titleRequired")).max(200),
  projectId: z.uuid().nullable(),
  clientId: z.uuid().nullable(),
  templateId: z.uuid().nullable(),
  blocks: blocksSchema,
  effectiveFrom: z.coerce.date().nullable(),
  effectiveUntil: z.coerce.date().nullable()
})

function refineContractParentAndDates(
  values: z.infer<typeof contractBaseSchema>,
  ctx: z.RefinementCtx
): void {
  if (!values.projectId && !values.clientId) {
    ctx.addIssue({
      code: "custom",
      path: ["clientId"],
      message: i18n.t("contracts.validation.parentRequired")
    })
  }

  if (
    values.effectiveFrom &&
    values.effectiveUntil &&
    values.effectiveUntil.getTime() < values.effectiveFrom.getTime()
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["effectiveUntil"],
      message: i18n.t("contracts.validation.effectiveRangeInvalid")
    })
  }
}

export const createContractSchema = contractBaseSchema.superRefine(refineContractParentAndDates)

export type CreateContractValues = z.infer<typeof createContractSchema>

export const updateContractSchema = contractBaseSchema
  .extend({ id: z.uuid(i18n.t("contracts.validation.idInvalid")) })
  .superRefine(refineContractParentAndDates)

export type UpdateContractValues = z.infer<typeof updateContractSchema>

export const sendContractSchema = contractIdSchema

export type SendContractValues = z.infer<typeof sendContractSchema>

export const terminateContractSchema = z.object({
  id: z.uuid(i18n.t("contracts.validation.idInvalid")),
  terminationReason: z
    .string()
    .trim()
    .min(1, i18n.t("contracts.validation.terminationReasonRequired"))
    .max(1000)
})

export type TerminateContractValues = z.infer<typeof terminateContractSchema>

// The dialog collects only the reason; the contract it applies to is the one already on screen.
export const terminateContractReasonSchema = terminateContractSchema.omit({ id: true })

export type TerminateContractReasonValues = z.infer<typeof terminateContractReasonSchema>

export const createContractFromProposalSchema = z.object({
  proposalId: z.uuid(i18n.t("contracts.validation.proposalIdInvalid")),
  title: z.string().trim().min(1, i18n.t("contracts.validation.titleRequired")).max(200)
})

export type CreateContractFromProposalValues = z.infer<typeof createContractFromProposalSchema>

const optionalContractDateSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: i18n.t("contracts.validation.effectiveRangeInvalid")
  })
  // Pinned to UTC midnight: handing the bare "YYYY-MM-DD" to `new Date` reads it in the server's
  // local zone, so an instance west of UTC would persist the previous day (`money-and-dates.md`).
  .transform((value) => (value === "" ? null : new Date(`${value}T00:00:00.000Z`)))

const optionalContractUuidSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || z.uuid().safeParse(value).success, {
    message: i18n.t("contracts.validation.idInvalid")
  })
  .transform((value) => (value === "" ? null : value))

// The form's own shape: every field is the string a control actually holds, transformed into the
// nullable values createContractSchema expects. A select with nothing chosen is "", never null, so
// the two schemas cannot share one definition.
export const contractFormSchema = z
  .object({
    title: z.string().trim().min(1, i18n.t("contracts.validation.titleRequired")).max(200),
    projectId: optionalContractUuidSchema,
    clientId: optionalContractUuidSchema,
    templateId: optionalContractUuidSchema,
    blocks: blocksSchema,
    effectiveFrom: optionalContractDateSchema,
    effectiveUntil: optionalContractDateSchema
  })
  .superRefine(refineContractParentAndDates)

export type ContractFormInputValues = z.input<typeof contractFormSchema>
export type ContractFormValues = z.infer<typeof contractFormSchema>

export const CONTRACT_SORT_FIELDS = ["number", "title", "parent", "effective", "created"] as const

export type ContractSortField = (typeof CONTRACT_SORT_FIELDS)[number]

const contractSortItemSchema = z.object({
  id: z.enum(CONTRACT_SORT_FIELDS),
  desc: z.boolean()
})

// Newest first, unlike the proposal overview's soonest-closing order: a contract's effective window
// is optional, so the only field every row is guaranteed to sort by is when it was drafted.
export const CONTRACT_DEFAULT_SORT = [{ id: "created", desc: true }] as const

export const contractListQuerySchema = z.object({
  search: z.string().trim().default(""),
  statuses: z.array(z.enum(CONTRACT_STATUS_VALUES)).default([]),
  clientIds: z.array(z.uuid()).default([]),
  page: z.number().int().positive().catch(1),
  perPage: z.number().int().positive().max(MAX_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE),
  sort: z.array(contractSortItemSchema).catch([...CONTRACT_DEFAULT_SORT])
})

export type ContractListQuery = z.infer<typeof contractListQuerySchema>

export function parseContractListQuery(input: unknown): ContractListQuery {
  return contractListQuerySchema.parse({
    search: readStringParam(input, "search"),
    statuses: readArrayParam(input, "status").filter((value): value is ContractStatus =>
      (CONTRACT_STATUS_VALUES as readonly string[]).includes(value)
    ),
    clientIds: readArrayParam(input, "client").filter((value) => z.uuid().safeParse(value).success),
    page: readIntParam(input, "page", 1),
    perPage: readIntParam(input, "perPage", DEFAULT_PAGE_SIZE),
    sort: readSortParam(input, [...CONTRACT_DEFAULT_SORT])
  })
}

export const contractParentSchema = z.object({
  projectId: z.uuid().nullable().catch(null),
  clientId: z.uuid().nullable().catch(null),
  proposalId: z.uuid().nullable().catch(null)
})

export type ContractParentValues = z.infer<typeof contractParentSchema>
