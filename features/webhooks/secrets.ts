import { mintPublicToken } from "@/lib/publicToken"

import { WEBHOOK_SECRET_PREFIX } from "./services/signature"

// A Standard Webhooks secret is `whsec_` followed by the base64 of the key bytes. The bytes come
// from `mintPublicToken`, the one CSPRNG minter behind every bearer credential in the instance, so
// a signing key can never carry less entropy than a document link.
export function mintWebhookSecret(): string {
  const keyBytes = Buffer.from(mintPublicToken(), "base64url")

  return `${WEBHOOK_SECRET_PREFIX}${keyBytes.toString("base64")}`
}
