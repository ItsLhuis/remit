import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

import {
  isSafeHttpUrl,
  readArrayParam,
  readDateAt,
  readIntParam,
  readNumberAt,
  readSortParam,
  readStringParam,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE
} from "@/lib/utils"

const CLIENT_NAME_MAX_LENGTH = 160
const CLIENT_EMAIL_MAX_LENGTH = 320
const CLIENT_TEXT_MAX_LENGTH = 255
const CLIENT_NOTES_MAX_LENGTH = 5000
export const CLIENT_STATUS_FILTERS = ["active", "deleted", "all"] as const

const optionalTextSchema = (maxLength = CLIENT_TEXT_MAX_LENGTH) =>
  z
    .string()
    .trim()
    .max(maxLength, i18n.t("clients.validation.textTooLong", { count: maxLength }))

const optionalEmailSchema = z
  .string()
  .trim()
  .max(
    CLIENT_EMAIL_MAX_LENGTH,
    i18n.t("clients.validation.emailTooLong", { count: CLIENT_EMAIL_MAX_LENGTH })
  )
  .refine((value) => z.email().safeParse(value).success, {
    message: i18n.t("clients.validation.emailInvalid")
  })

const optionalUrlSchema = optionalTextSchema().refine(
  (value) => value === "" || (z.url().safeParse(value).success && isSafeHttpUrl(value)),
  {
    message: i18n.t("clients.validation.websiteInvalid")
  }
)

const optionalCountrySchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => value === "" || /^[A-Z]{2}$/.test(value), {
    message: i18n.t("clients.validation.countryInvalid")
  })

const currencySchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z]{3}$/.test(value), {
    message: i18n.t("clients.validation.currencyInvalid")
  })

const clientStatusFilterSchema = z.enum(CLIENT_STATUS_FILTERS).catch("active")

export const clientFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, i18n.t("clients.validation.nameRequired"))
    .max(
      CLIENT_NAME_MAX_LENGTH,
      i18n.t("clients.validation.nameTooLong", { count: CLIENT_NAME_MAX_LENGTH })
    ),
  email: optionalEmailSchema,
  phone: optionalTextSchema(),
  currency: currencySchema,
  taxId: optionalTextSchema(),
  addressLine1: optionalTextSchema(),
  addressLine2: optionalTextSchema(),
  city: optionalTextSchema(),
  state: optionalTextSchema(),
  postalCode: optionalTextSchema(),
  country: optionalCountrySchema,
  notes: optionalTextSchema(CLIENT_NOTES_MAX_LENGTH),
  website: optionalUrlSchema
})

export type ClientFormValues = z.infer<typeof clientFormSchema>
export type ClientFormInputValues = z.input<typeof clientFormSchema>

export const createClientSchema = clientFormSchema

export type CreateClientValues = z.infer<typeof createClientSchema>

export const updateClientSchema = clientFormSchema.extend({
  id: z.uuid(i18n.t("clients.validation.idInvalid"))
})

export type UpdateClientValues = z.infer<typeof updateClientSchema>

export const clientIdSchema = z.object({
  id: z.uuid(i18n.t("clients.validation.idInvalid"))
})

export type ClientIdValues = z.infer<typeof clientIdSchema>

export const CLIENT_HEALTH_VALUES = ["owing", "settled", "dormant"] as const
export const CLIENT_SORT_FIELDS = ["name", "currency", "joined", "outstanding"] as const

export type ClientHealthValue = (typeof CLIENT_HEALTH_VALUES)[number]
export type ClientSortField = (typeof CLIENT_SORT_FIELDS)[number]

const clientSortItemSchema = z.object({
  id: z.enum(CLIENT_SORT_FIELDS),
  desc: z.boolean()
})

export const clientListQuerySchema = z.object({
  search: z.string().trim().default(""),
  status: clientStatusFilterSchema.default("active"),
  currencies: z.array(z.string().trim()).default([]),
  healths: z.array(z.enum(CLIENT_HEALTH_VALUES)).default([]),
  outstandingMin: z.number().int().nonnegative().nullable().default(null),
  outstandingMax: z.number().int().nonnegative().nullable().default(null),
  joinedFrom: z.coerce.date().nullable().catch(null),
  joinedTo: z.coerce.date().nullable().catch(null),
  page: z.number().int().positive().catch(1),
  perPage: z.number().int().positive().max(MAX_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE),
  sort: z.array(clientSortItemSchema).catch([{ id: "name", desc: false }])
})

export type ClientListQuery = z.infer<typeof clientListQuerySchema>
export type ClientStatusFilter = (typeof CLIENT_STATUS_FILTERS)[number]

export function parseClientListQuery(input: unknown): ClientListQuery {
  const outstanding = readArrayParam(input, "outstanding")
  const joined = readArrayParam(input, "joined")

  return clientListQuerySchema.parse({
    search: readStringParam(input, "search"),
    status: readStringParam(input, "status") || "active",
    currencies: readArrayParam(input, "currency").map((value) => value.toUpperCase()),
    healths: readArrayParam(input, "health").filter((value): value is ClientHealthValue =>
      (CLIENT_HEALTH_VALUES as readonly string[]).includes(value)
    ),
    outstandingMin: readNumberAt(outstanding, 0),
    outstandingMax: readNumberAt(outstanding, 1),
    joinedFrom: readDateAt(joined, 0),
    joinedTo: readDateAt(joined, 1),
    page: readIntParam(input, "page", 1),
    perPage: readIntParam(input, "perPage", DEFAULT_PAGE_SIZE),
    sort: readSortParam(input, [{ id: "name", desc: false }])
  })
}
