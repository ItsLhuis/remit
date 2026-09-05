import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

import {
  isSafeHttpUrl,
  isValidAmount,
  readArrayParam,
  readDateAt,
  readIntParam,
  readNumberAt,
  readSortParam,
  readStringParam,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE
} from "@/lib/utils"

import { IMAGE_UPLOAD_MAX_BYTES, IMAGE_UPLOAD_MIME_TYPES } from "@/lib/storage"

const CLIENT_NAME_MAX_LENGTH = 160
const CLIENT_EMAIL_MAX_LENGTH = 320
const CLIENT_TEXT_MAX_LENGTH = 255
const CLIENT_NOTES_MAX_LENGTH = 5000
const CLIENT_PORTAL_TOKEN_MAX_LENGTH = 128
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

// Both checks are load-bearing: `z.url()` accepts any well-formed URL, `javascript:` and `data:`
// included, and a client website is rendered into an `href`. `isSafeHttpUrl` is what narrows it to
// http and https (`lib/utils/url.ts`), so dropping either half reopens the sink.
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

// Held as the string the control shows rather than transformed to cents, because `clientFormSchema`
// is also the action's schema: a transform here would make the server re-parse a number where it
// expects a string (`forms.md`). `toClientWriteValues` is where it becomes cents.
const optionalHourlyRateSchema = z
  .string()
  .trim()
  .refine((value) => isValidAmount(value), {
    message: i18n.t("clients.validation.hourlyRateInvalid")
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
  website: optionalUrlSchema,
  defaultHourlyRate: optionalHourlyRateSchema
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

// Bounded, not shaped: the stored token is always 43 base64url characters, but validating that here
// would turn a malformed token into a distinguishable rejection. Anything within the bound falls
// through to the same constant-time miss as a well-formed token that does not exist.
const clientPortalTokenValueSchema = z
  .string()
  .trim()
  .min(1, i18n.t("clients.public.validation.tokenInvalid"))
  .max(CLIENT_PORTAL_TOKEN_MAX_LENGTH, i18n.t("clients.public.validation.tokenInvalid"))

export const clientPortalTokenSchema = z.object({ token: clientPortalTokenValueSchema })

const clientContactFieldsShape = {
  name: z
    .string()
    .trim()
    .min(1, i18n.t("clients.validation.contactNameRequired"))
    .max(
      CLIENT_NAME_MAX_LENGTH,
      i18n.t("clients.validation.contactNameTooLong", { count: CLIENT_NAME_MAX_LENGTH })
    ),
  email: optionalEmailSchema,
  phone: optionalTextSchema(),
  role: optionalTextSchema(),
  isPrimary: z.boolean()
}

export const clientContactFormSchema = z.object(clientContactFieldsShape)

export type ClientContactFormValues = z.infer<typeof clientContactFormSchema>

export const createClientContactSchema = z.object({
  ...clientContactFieldsShape,
  clientId: z.uuid(i18n.t("clients.validation.idInvalid"))
})

export const updateClientContactSchema = z.object({
  ...clientContactFieldsShape,
  id: z.uuid(i18n.t("clients.validation.contactIdInvalid"))
})

export const clientContactIdSchema = z.object({
  id: z.uuid(i18n.t("clients.validation.contactIdInvalid"))
})

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

// The client image is minted under this prefix by `app/api/upload/[type]/route.ts`'s `client-image`
// variant. Restated as a literal for the same reason `EXPENSE_RECEIPT_KEY_PREFIX` is: the route must
// not import a feature, and this refusal is what stops a caller pointing the column at an object it
// did not upload through that variant.
const CLIENT_IMAGE_KEY_PREFIX = "clients/"

export const confirmClientImageUploadSchema = z.object({
  clientId: z.uuid(i18n.t("clients.validation.idInvalid")),
  objectKey: z
    .string()
    .trim()
    .min(1, i18n.t("clients.errors.invalidImageFileType"))
    .startsWith(CLIENT_IMAGE_KEY_PREFIX, i18n.t("clients.errors.invalidImageFileType")),
  filename: z
    .string()
    .trim()
    .min(1, i18n.t("clients.validation.imageFilenameRequired"))
    .max(255, i18n.t("clients.validation.imageFilenameRequired")),
  contentType: z.enum(IMAGE_UPLOAD_MIME_TYPES, i18n.t("clients.errors.invalidImageFileType")),
  sizeBytes: z
    .number()
    .int(i18n.t("clients.validation.imageSizeInvalid"))
    .positive(i18n.t("clients.validation.imageSizeInvalid"))
    .max(IMAGE_UPLOAD_MAX_BYTES, i18n.t("clients.validation.imageTooLarge"))
})

export type ConfirmClientImageUploadValues = z.infer<typeof confirmClientImageUploadSchema>

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
