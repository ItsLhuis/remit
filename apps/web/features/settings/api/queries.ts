import { desc } from "drizzle-orm"

import { database } from "@/database"
import { apiTokens } from "@/database/schema"

import { type ApiTokenScope } from "@/features/api"

import { getApiTokenStatus } from "./services/apiTokenLifecycle"
import { type ApiTokenListItem, type ApiTokensPageData } from "./types"

type ApiTokenRow = {
  id: string
  name: string
  tokenPrefix: string
  scopes: ApiTokenScope[]
  createdAt: Date
  lastUsedAt: Date | null
  expiresAt: Date | null
  revokedAt: Date | null
}

// `token_hash` is deliberately absent: nothing a browser renders needs it.
export const apiTokenListColumns = {
  id: apiTokens.id,
  name: apiTokens.name,
  tokenPrefix: apiTokens.tokenPrefix,
  scopes: apiTokens.scopes,
  createdAt: apiTokens.createdAt,
  lastUsedAt: apiTokens.lastUsedAt,
  expiresAt: apiTokens.expiresAt,
  revokedAt: apiTokens.revokedAt
}

export async function getApiTokensPageData(): Promise<ApiTokensPageData> {
  const [rows, instanceSettings] = await Promise.all([
    database.select(apiTokenListColumns).from(apiTokens).orderBy(desc(apiTokens.createdAt)),
    database.query.settings.findFirst({ columns: { defaultLocale: true, defaultTimezone: true } })
  ])

  const now = new Date()

  return {
    tokens: rows.map((row) => toApiTokenListItem(row, now)),
    locale: instanceSettings?.defaultLocale ?? "en",
    timeZone: instanceSettings?.defaultTimezone ?? "UTC"
  }
}

export function toApiTokenListItem(row: ApiTokenRow, now: Date): ApiTokenListItem {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.tokenPrefix,
    scopes: row.scopes,
    status: getApiTokenStatus(row, now),
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt
  }
}
