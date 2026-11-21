import { type ApiTokenScope } from "@/features/api"

import { type ApiTokenStatus } from "./services/apiTokenLifecycle"

type StatusPresentation = {
  variant: "success" | "secondary" | "warning"
  icon: "CircleCheck" | "Ban" | "Clock"
}

export const apiTokenStatusPresentation: Record<ApiTokenStatus, StatusPresentation> = {
  active: { variant: "success", icon: "CircleCheck" },
  revoked: { variant: "secondary", icon: "Ban" },
  expired: { variant: "warning", icon: "Clock" }
}

// Keyed by resource rather than by the scope string itself, because i18next reads a `:` in a key as
// its namespace separator and `settings.api.scopes.clients:read` would resolve nowhere.
export const apiTokenScopeLabelKeys = {
  "clients:read": "settings.api.scopes.clients",
  "projects:read": "settings.api.scopes.projects",
  "invoices:read": "settings.api.scopes.invoices",
  "time_entries:read": "settings.api.scopes.timeEntries",
  "expenses:read": "settings.api.scopes.expenses"
} as const satisfies Record<ApiTokenScope, string>
