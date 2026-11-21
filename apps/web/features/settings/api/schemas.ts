import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

import { API_TOKEN_SCOPES } from "@/features/api"

const API_TOKEN_NAME_MAX_LENGTH = 80

// Offered rather than free-form: a date picker would invite a token that expires in eleven years,
// and these four cover every case an owner has argued for (a trial, a quarter, a year, and a
// standing integration they will revoke by hand).
export const API_TOKEN_EXPIRY_OPTIONS = ["30", "90", "365", "never"] as const

export type ApiTokenExpiryOption = (typeof API_TOKEN_EXPIRY_OPTIONS)[number]

export const createApiTokenSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, i18n.t("settings.api.validation.nameRequired"))
    .max(
      API_TOKEN_NAME_MAX_LENGTH,
      i18n.t("settings.api.validation.nameTooLong", { max: API_TOKEN_NAME_MAX_LENGTH })
    ),
  scopes: z
    .array(z.enum(API_TOKEN_SCOPES, i18n.t("settings.api.validation.scopeInvalid")))
    .min(1, i18n.t("settings.api.validation.scopesRequired")),
  expiry: z.enum(API_TOKEN_EXPIRY_OPTIONS, i18n.t("settings.api.validation.expiryInvalid"))
})

export type CreateApiTokenInputValues = z.input<typeof createApiTokenSchema>

export const revokeApiTokenSchema = z.object({
  tokenId: z.uuid(i18n.t("settings.api.validation.tokenIdInvalid"))
})
