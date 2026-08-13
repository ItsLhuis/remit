import { z } from "zod"

import i18n from "@/lib/i18n/i18n"

export const DATA_EXPORT_SCOPE_VALUES = ["instance", "client"] as const
export type DataExportScope = (typeof DATA_EXPORT_SCOPE_VALUES)[number]

export const DATA_EXPORT_STATUS_VALUES = ["pending", "running", "ready", "failed"] as const
export type DataExportStatus = (typeof DATA_EXPORT_STATUS_VALUES)[number]

export const requestDataExportSchema = z
  .object({
    scope: z.enum(DATA_EXPORT_SCOPE_VALUES, {
      message: i18n.t("settings.data.validation.scopeInvalid")
    }),
    clientId: z.uuid(i18n.t("settings.data.validation.clientInvalid")).nullable()
  })
  // The database says the same thing in `chk_data_exports_scope_client`; this refinement exists so the
  // owner gets the field-level message instead of a constraint violation surfacing as a generic
  // failure, and so a client-scoped request cannot reach the reads with nothing to scope them by.
  .refine((value) => value.scope === "instance" || value.clientId !== null, {
    message: i18n.t("settings.data.validation.clientRequired"),
    path: ["clientId"]
  })

export type RequestDataExportValues = z.infer<typeof requestDataExportSchema>

export const dataExportIdSchema = z.object({
  exportId: z.uuid(i18n.t("settings.data.validation.exportInvalid"))
})
