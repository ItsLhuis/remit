import { type LookupAddress, type LookupOptions } from "node:dns"
import { lookup } from "node:dns/promises"
import { request as httpRequest } from "node:http"
import { request as httpsRequest } from "node:https"
import { isIP } from "node:net"

import { isAddressAllowed, toBareHostname, type AddressPolicy } from "./services/addressPolicy"
import { classifyHttpStatus, type WebhookAttemptOutcome } from "./services/deliveryPolicy"

export type WebhookResolver = (hostname: string) => Promise<LookupAddress[]>

export type SafePostInput = {
  url: URL
  allowPrivate: boolean
  body: string
  headers: Record<string, string>
  // Injected by tests to resolve a name to a chosen address without touching real DNS.
  resolve?: WebhookResolver
  timeoutMs?: number
}

export type SafePostResult = {
  outcome: WebhookAttemptOutcome
  statusCode: number | null
}

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number
) => void

const DEFAULT_TIMEOUT_MS = 10 * 1000

class BlockedAddressError extends Error {}

const resolveWithSystemDns: WebhookResolver = (hostname) =>
  lookup(hostname, { all: true, verbatim: true })

// The one way Remit sends a request to a user-supplied URL, and the dynamic half of the SSRF defence
// (ADR-0039). Each property below closes a specific hole; none is redundant.
//
// - The address is checked *where the socket connects*, through the request's own `lookup` hook,
//   and the socket is opened to exactly the address that passed. Checking a name and then letting
//   the HTTP client resolve it again is the DNS-rebinding gap: a hostname can answer with a public
//   address to the check and a private one to the connection.
// - If any address a name resolves to is refused, the whole request is refused, so a name that
//   answers with one public and one private record cannot be used to reach the private one.
// - An IP-literal host never reaches `lookup` (Node skips it), so it is checked up front.
// - Redirects are never followed: `node:http` does not follow them, and a 3xx is classified as a
//   permanent failure rather than chased to a host nobody checked.
// - One total timeout, through the request's abort signal, rather than a socket idle timeout that a
//   slow-drip response could keep resetting.
// - The response body is never read. The status line is all Remit needs, and not reading the body
//   is a stricter size cap than any byte limit.
//
// TLS still verifies the certificate against the hostname, not the pinned address, because the
// request is made to the URL and only the connection's address is supplied.
export async function safePost(input: SafePostInput): Promise<SafePostResult> {
  const hostname = toBareHostname(input.url.hostname)
  const policy: AddressPolicy = { allowPrivate: input.allowPrivate }

  if (isIP(hostname) !== 0 && !isAddressAllowed(hostname, policy)) {
    return { outcome: "blocked", statusCode: null }
  }

  const send = input.url.protocol === "https:" ? httpsRequest : httpRequest

  return new Promise<SafePostResult>((settle) => {
    const request = send(
      input.url,
      {
        method: "POST",
        headers: { ...input.headers, "content-length": String(Buffer.byteLength(input.body)) },
        agent: false,
        signal: AbortSignal.timeout(input.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        lookup: createPinnedLookup(input.resolve ?? resolveWithSystemDns, policy)
      },
      (response) => {
        const statusCode = response.statusCode ?? 0

        response.destroy()

        settle({ outcome: classifyHttpStatus(statusCode), statusCode })
      }
    )

    request.on("error", (error) => settle({ outcome: toFailureOutcome(error), statusCode: null }))
    request.end(input.body)
  })
}

function createPinnedLookup(resolve: WebhookResolver, policy: AddressPolicy) {
  return (hostname: string, options: LookupOptions, callback: LookupCallback): void => {
    resolve(hostname).then(
      (addresses) => {
        const first = addresses[0]

        if (!first || addresses.some((entry) => !isAddressAllowed(entry.address, policy))) {
          callback(new BlockedAddressError("Webhook address refused"), "", 0)

          return
        }

        if (options.all) {
          callback(null, addresses)

          return
        }

        callback(null, first.address, first.family)
      },
      (error: NodeJS.ErrnoException) => callback(error, "", 0)
    )
  }
}

function toFailureOutcome(error: Error): WebhookAttemptOutcome {
  if (error instanceof BlockedAddressError) return "blocked"

  if (error.name === "AbortError" || error.name === "TimeoutError") return "timeout"

  return "network_error"
}
