import { type ApiTokenScope } from "@/features/api"

import { type ApiTokenStatus } from "./services/apiTokenLifecycle"

// Carries neither the token nor its hash: the value was shown once at creation, and the hash is a
// lookup key with no use in a browser.
export type ApiTokenListItem = {
  id: string
  name: string
  tokenPrefix: string
  scopes: ApiTokenScope[]
  status: ApiTokenStatus
  createdAt: Date
  lastUsedAt: Date | null
  expiresAt: Date | null
}

export type ApiTokensPageData = {
  tokens: ApiTokenListItem[]
  locale: string
  timeZone: string
}
