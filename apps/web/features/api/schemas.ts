import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

import { MAX_PAGE_SIZE } from "@/lib/utils"

// The public API's resources, in the order the settings surface lists their scopes.
export const API_RESOURCES = [
  "clients",
  "projects",
  "invoices",
  "time_entries",
  "expenses"
] as const

export type ApiResource = (typeof API_RESOURCES)[number]

// Restated from `database/schema/enums.ts`'s `apiTokenScope`, which a feature cannot be imported
// into; `__tests__/openapi.integration.test.ts` fails when the two lists disagree.
export const API_TOKEN_SCOPES = [
  "clients:read",
  "projects:read",
  "invoices:read",
  "time_entries:read",
  "expenses:read"
] as const satisfies readonly `${ApiResource}:read`[]

export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number]

export const API_DEFAULT_PAGE_SIZE = 25

// Strict on purpose: an unknown parameter is refused rather than ignored, so a caller who sends
// `?status=paid` learns that v1 does not filter instead of silently receiving every row.
export const apiListParamsSchema = z.strictObject(
  {
    page: z.coerce
      .number(i18n.t("api.validation.pageInvalid"))
      .int(i18n.t("api.validation.pageInvalid"))
      .positive(i18n.t("api.validation.pageInvalid"))
      .default(1),
    perPage: z.coerce
      .number(i18n.t("api.validation.perPageInvalid", { max: MAX_PAGE_SIZE }))
      .int(i18n.t("api.validation.perPageInvalid", { max: MAX_PAGE_SIZE }))
      .min(1, i18n.t("api.validation.perPageInvalid", { max: MAX_PAGE_SIZE }))
      .max(MAX_PAGE_SIZE, i18n.t("api.validation.perPageInvalid", { max: MAX_PAGE_SIZE }))
      .default(API_DEFAULT_PAGE_SIZE)
  },
  { error: i18n.t("api.validation.unknownParameter") }
)

export type ApiListParams = z.infer<typeof apiListParamsSchema>

export const apiResourceIdSchema = z.object({
  id: z.uuid(i18n.t("api.validation.idInvalid"))
})
