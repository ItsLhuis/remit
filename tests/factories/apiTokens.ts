import { type InferInsertModel } from "drizzle-orm"

import { issueApiToken } from "@/lib/apiToken"

import { apiTokens } from "@/database/schema"

import { database } from "@/tests/integration/database"

// Returns the plaintext token beside the row, because a test is the one caller that needs both: the
// row is what the database holds, the token is what an integration would send.
export async function makeApiToken(
  overrides: Partial<InferInsertModel<typeof apiTokens>> &
    Pick<InferInsertModel<typeof apiTokens>, "createdByUserId">
) {
  const issued = issueApiToken()

  const [row] = await database
    .insert(apiTokens)
    .values({
      name: "Integration test token",
      tokenHash: issued.tokenHash,
      tokenPrefix: issued.tokenPrefix,
      scopes: [
        "clients:read",
        "projects:read",
        "invoices:read",
        "time_entries:read",
        "expenses:read"
      ],
      ...overrides
    })
    .returning()

  if (!row) throw new Error("makeApiToken: insert failed")

  return { ...row, token: issued.token }
}
