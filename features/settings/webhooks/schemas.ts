import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

import { WEBHOOK_EVENTS, WEBHOOK_URL_MAX_LENGTH } from "@/features/webhooks"

// Shape only. Whether the URL may be reached — scheme, embedded credentials, private addresses — is
// decided on the server by `features/webhooks/services/webhookUrl.ts`'s `evaluateWebhookUrl`,
// because the answer depends on the operator's `REMIT_WEBHOOK_ALLOWED_HOSTS`, which a browser does
// not have.
export const createWebhookEndpointSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, i18n.t("settings.webhooks.validation.urlRequired"))
    .max(WEBHOOK_URL_MAX_LENGTH, i18n.t("settings.webhooks.validation.urlTooLong")),
  events: z
    .array(z.enum(WEBHOOK_EVENTS, i18n.t("settings.webhooks.validation.eventInvalid")))
    .min(1, i18n.t("settings.webhooks.validation.eventsRequired"))
})

export type CreateWebhookEndpointInputValues = z.input<typeof createWebhookEndpointSchema>

export const webhookEndpointIdSchema = z.object({
  endpointId: z.uuid(i18n.t("settings.webhooks.validation.endpointIdInvalid"))
})

export const setWebhookEndpointActiveSchema = z.object({
  endpointId: z.uuid(i18n.t("settings.webhooks.validation.endpointIdInvalid")),
  active: z.boolean()
})
