import { isIP } from "node:net"

import { WEBHOOK_URL_MAX_LENGTH } from "../schemas"

import { isAddressAllowed, toBareHostname } from "./addressPolicy"

export type WebhookUrlRefusal = "too_long" | "invalid" | "scheme" | "credentials" | "address"

export type WebhookUrlEvaluation =
  | { ok: true; url: URL; allowPrivate: boolean }
  | { ok: false; reason: WebhookUrlRefusal }

// The static half of the SSRF defence: what can be decided from the URL alone, before any DNS. It
// runs when an endpoint is saved and again before every delivery, because the operator's allowlist
// can change between the two. The dynamic half — what a hostname resolves to — lives in
// `safePost.ts`, which pins the address it checked.
//
// `allowedHosts` is `REMIT_WEBHOOK_ALLOWED_HOSTS`: exact hostnames the operator has declared to be
// legitimate private receivers, such as an automation server on the same network. Only they may be
// reached over plain HTTP or at a private address; everything else must be HTTPS to a public one.
export function evaluateWebhookUrl(
  raw: string,
  allowedHosts: readonly string[]
): WebhookUrlEvaluation {
  if (raw.length > WEBHOOK_URL_MAX_LENGTH) return { ok: false, reason: "too_long" }

  let url: URL

  try {
    url = new URL(raw)
  } catch {
    return { ok: false, reason: "invalid" }
  }

  const hostname = toBareHostname(url.hostname.toLowerCase())

  if (!hostname) return { ok: false, reason: "invalid" }

  const allowPrivate = allowedHosts.includes(hostname)

  if (url.protocol !== "https:" && !(url.protocol === "http:" && allowPrivate)) {
    return { ok: false, reason: "scheme" }
  }

  // Credentials in the URL would be stored and sent on every delivery, and shown in the list.
  if (url.username || url.password) return { ok: false, reason: "credentials" }

  if (isIP(hostname) !== 0 && !isAddressAllowed(hostname, { allowPrivate })) {
    return { ok: false, reason: "address" }
  }

  return { ok: true, url, allowPrivate }
}
