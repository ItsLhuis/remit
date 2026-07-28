import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

import {
  isValidAmount,
  parseAmountToCents,
  readArrayParam,
  readDateAt,
  readIntParam,
  readNumberAt,
  readSortParam,
  readStringParam,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE
} from "@/lib/utils"

const PROPOSAL_DESCRIPTION_MAX_LENGTH = 500
const PROPOSAL_UNIT_MAX_LENGTH = 50
const PROPOSAL_NOTES_MAX_LENGTH = 5000
const QUANTITY_PATTERN = /^\d+(\.\d{1,2})?$/

export const PROPOSAL_STATUS_VALUES = ["draft", "sent", "accepted", "rejected"] as const
export type ProposalStatus = (typeof PROPOSAL_STATUS_VALUES)[number]

export const PROPOSAL_DISCOUNT_KINDS = ["none", "percentage", "fixed"] as const
export type ProposalDiscountKind = (typeof PROPOSAL_DISCOUNT_KINDS)[number]

export const proposalStatusSchema = z.enum(PROPOSAL_STATUS_VALUES)

const requiredAmountSchema = z
  .string()
  .trim()
  .min(1, i18n.t("proposals.validation.amountRequired"))
  .refine((value) => isValidAmount(value), {
    message: i18n.t("proposals.validation.amountInvalid")
  })
  .transform((value) => parseAmountToCents(value) ?? 0)

const optionalAmountSchema = z
  .string()
  .trim()
  .refine((value) => isValidAmount(value), {
    message: i18n.t("proposals.validation.amountInvalid")
  })
  .transform((value) => parseAmountToCents(value))

const quantitySchema = z
  .string()
  .trim()
  .refine((value) => QUANTITY_PATTERN.test(value) && Number(value) > 0, {
    message: i18n.t("proposals.validation.quantityInvalid")
  })
  .transform((value) => Number(value))

const optionalPercentageSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || (/^\d+(\.\d{1,2})?$/.test(value) && Number(value) <= 100), {
    message: i18n.t("proposals.validation.percentageInvalid")
  })
  .transform((value) => (value === "" ? null : Number(value)))

const optionalDateSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: i18n.t("proposals.validation.dateInvalid")
  })
  // Pinned to UTC midnight for the same reason as tasks' due date: handing the bare "YYYY-MM-DD" to
  // `new Date` reads it in the server's local zone, so an instance west of UTC would persist the
  // previous day (see `money-and-dates.md`).
  .transform((value) => (value === "" ? null : new Date(`${value}T00:00:00.000Z`)))

const optionalUuidSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || z.uuid().safeParse(value).success, {
    message: i18n.t("proposals.validation.taxRateInvalid")
  })
  .transform((value) => (value === "" ? null : value))

const discountKindSchema = z.enum(PROPOSAL_DISCOUNT_KINDS)

// `chk_line_items_discount_shape` and `chk_proposals_discount_shape` demand that exactly the columns
// matching the discount kind are populated. This refinement is that constraint restated at the trust
// boundary, so an inconsistent shape is a field error rather than a database exception.
function refineDiscountShape<
  TValues extends {
    discountKind: ProposalDiscountKind
    discountPercentage: number | null
    discountAmount: number | null
  }
>(values: TValues, context: z.RefinementCtx): void {
  if (values.discountKind === "percentage" && values.discountPercentage === null) {
    context.addIssue({
      code: "custom",
      path: ["discountPercentage"],
      message: i18n.t("proposals.validation.discountPercentageRequired")
    })
  }

  if (values.discountKind === "fixed" && values.discountAmount === null) {
    context.addIssue({
      code: "custom",
      path: ["discountAmount"],
      message: i18n.t("proposals.validation.discountAmountRequired")
    })
  }
}

export const proposalLineItemSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(1, i18n.t("proposals.validation.descriptionRequired"))
      .max(
        PROPOSAL_DESCRIPTION_MAX_LENGTH,
        i18n.t("proposals.validation.descriptionTooLong", {
          count: PROPOSAL_DESCRIPTION_MAX_LENGTH
        })
      ),
    unit: z
      .string()
      .trim()
      .max(
        PROPOSAL_UNIT_MAX_LENGTH,
        i18n.t("proposals.validation.unitTooLong", { count: PROPOSAL_UNIT_MAX_LENGTH })
      ),
    quantity: quantitySchema,
    unitPrice: requiredAmountSchema,
    discountKind: discountKindSchema,
    discountPercentage: optionalPercentageSchema,
    discountAmount: optionalAmountSchema,
    taxRateId: optionalUuidSchema
  })
  .superRefine(refineDiscountShape)

export type ProposalLineItemInputValues = z.input<typeof proposalLineItemSchema>
export type ProposalLineItemValues = z.infer<typeof proposalLineItemSchema>

const proposalFieldsShape = {
  currency: z
    .string()
    .trim()
    .length(3, i18n.t("proposals.validation.currencyInvalid"))
    .transform((value) => value.toUpperCase()),
  templateId: optionalUuidSchema,
  validUntil: optionalDateSchema,
  notes: z
    .string()
    .trim()
    .max(
      PROPOSAL_NOTES_MAX_LENGTH,
      i18n.t("proposals.validation.notesTooLong", { count: PROPOSAL_NOTES_MAX_LENGTH })
    ),
  discountKind: discountKindSchema,
  discountPercentage: optionalPercentageSchema,
  discountAmount: optionalAmountSchema,
  lineItems: z
    .array(proposalLineItemSchema)
    .min(1, i18n.t("proposals.validation.lineItemsRequired"))
}

export const proposalFormSchema = z.object(proposalFieldsShape).superRefine(refineDiscountShape)

export type ProposalFormInputValues = z.input<typeof proposalFormSchema>
export type ProposalFormValues = z.infer<typeof proposalFormSchema>

export const createProposalSchema = z
  .object({
    ...proposalFieldsShape,
    projectId: z.uuid(i18n.t("proposals.validation.projectRequired"))
  })
  .superRefine(refineDiscountShape)

export type CreateProposalValues = z.infer<typeof createProposalSchema>

export const updateProposalSchema = z
  .object({
    ...proposalFieldsShape,
    id: z.uuid(i18n.t("proposals.validation.idInvalid"))
  })
  .superRefine(refineDiscountShape)

export type UpdateProposalValues = z.infer<typeof updateProposalSchema>

export const proposalIdSchema = z.object({
  id: z.uuid(i18n.t("proposals.validation.idInvalid"))
})

export type ProposalIdValues = z.infer<typeof proposalIdSchema>

export const proposalListParamsSchema = z.object({
  projectId: z.uuid(i18n.t("proposals.validation.projectRequired"))
})

export type ProposalListParams = z.infer<typeof proposalListParamsSchema>

export const PROPOSAL_SORT_FIELDS = [
  "number",
  "project",
  "client",
  "validUntil",
  "total",
  "created"
] as const

export type ProposalSortField = (typeof PROPOSAL_SORT_FIELDS)[number]

const proposalSortItemSchema = z.object({
  id: z.enum(PROPOSAL_SORT_FIELDS),
  desc: z.boolean()
})

// The soonest-closing validity window first, because the overview exists to surface the proposals
// still waiting on a client. Every read path that falls back to a default order uses this one.
export const PROPOSAL_DEFAULT_SORT = [{ id: "validUntil", desc: false }] as const

export const proposalListQuerySchema = z.object({
  search: z.string().trim().default(""),
  statuses: z.array(z.enum(PROPOSAL_STATUS_VALUES)).default([]),
  clientIds: z.array(z.uuid()).default([]),
  totalMin: z.number().int().nonnegative().nullable().default(null),
  totalMax: z.number().int().nonnegative().nullable().default(null),
  validUntilFrom: z.coerce.date().nullable().catch(null),
  validUntilTo: z.coerce.date().nullable().catch(null),
  page: z.number().int().positive().catch(1),
  perPage: z.number().int().positive().max(MAX_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE),
  sort: z.array(proposalSortItemSchema).catch([...PROPOSAL_DEFAULT_SORT])
})

export type ProposalListQuery = z.infer<typeof proposalListQuerySchema>

export function parseProposalListQuery(input: unknown): ProposalListQuery {
  const total = readArrayParam(input, "total")
  const validUntil = readArrayParam(input, "validUntil")

  return proposalListQuerySchema.parse({
    search: readStringParam(input, "search"),
    statuses: readArrayParam(input, "status").filter((value): value is ProposalStatus =>
      (PROPOSAL_STATUS_VALUES as readonly string[]).includes(value)
    ),
    clientIds: readArrayParam(input, "client").filter((value) => z.uuid().safeParse(value).success),
    totalMin: readNumberAt(total, 0),
    totalMax: readNumberAt(total, 1),
    validUntilFrom: readDateAt(validUntil, 0),
    validUntilTo: readDateAt(validUntil, 1),
    page: readIntParam(input, "page", 1),
    perPage: readIntParam(input, "perPage", DEFAULT_PAGE_SIZE),
    sort: readSortParam(input, [...PROPOSAL_DEFAULT_SORT])
  })
}
